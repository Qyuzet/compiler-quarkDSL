import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile } from "fs/promises";
import path from "path";
import { searchCodebase, formatSearchResults } from "@/lib/codebase-search";
import { getDynamicCodebaseIndex } from "@/lib/dynamic-indexer";
import type { CodebaseIndex } from "@/lib/codebase-search";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Detect if running on Vercel
const isVercel = process.env.VERCEL === "1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Load pre-built index for Vercel deployment
let cachedIndex: CodebaseIndex | null = null;
async function getPrebuiltIndex(): Promise<CodebaseIndex | null> {
  if (cachedIndex) return cachedIndex;

  try {
    const indexPath = path.join(process.cwd(), "public", "codebase-index.json");
    const content = await readFile(indexPath, "utf-8");
    cachedIndex = JSON.parse(content);
    return cachedIndex;
  } catch {
    return null;
  }
}

// Helper to send SSE events
function sendEvent(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown
) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const { message, conversationHistory } = await request.json();

  // Create a streaming response using SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!message) {
          sendEvent(controller, "error", { message: "Message is required" });
          controller.close();
          return;
        }

        if (!process.env.GEMINI_API_KEY) {
          sendEvent(controller, "error", { message: "API key not configured" });
          controller.close();
          return;
        }

        // Phase 1: Reasoning
        sendEvent(controller, "phase", {
          phase: "reasoning",
          text: "Analyzing your question...",
        });

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Stream the classification reasoning
        const classificationPrompt = `Analyze this question about QuarkDSL and decide what sources to use.

Question: "${message}"

Think step by step in 2-3 sentences, then give your decision.
Format:
THINKING: <your analysis>
DECISION: CODE or DOCS`;

        const classifyResult = await model.generateContentStream(
          classificationPrompt
        );
        let classificationText = "";

        for await (const chunk of classifyResult.stream) {
          const text = chunk.text();
          classificationText += text;
          // Stream the reasoning text live
          const thinkingMatch = classificationText.match(
            /THINKING:\s*(.+?)(?=DECISION:|$)/is
          );
          if (thinkingMatch) {
            sendEvent(controller, "reasoning", {
              text: thinkingMatch[1].trim(),
            });
          }
        }

        const needsCode = classificationText
          .toUpperCase()
          .includes("DECISION: CODE");

        // Phase 2: Fetching data
        // Use public folder on Vercel, parent directory for local dev
        const publicDir = path.join(process.cwd(), "public");
        const projectRoot = path.join(process.cwd(), "..");

        if (needsCode) {
          sendEvent(controller, "phase", {
            phase: "indexing",
            text: "Searching codebase...",
          });
        } else {
          sendEvent(controller, "phase", {
            phase: "docs",
            text: "Loading documentation...",
          });
        }

        // Load files - try public folder first (works on Vercel), then project root (local dev)
        const loadFile = async (
          fileName: string,
          subPath?: string
        ): Promise<string> => {
          // Try public folder first (Vercel)
          try {
            const publicPath = path.join(publicDir, fileName);
            return await readFile(publicPath, "utf-8");
          } catch {
            // Fall back to project root (local dev)
            try {
              const localPath = subPath
                ? path.join(projectRoot, subPath, fileName)
                : path.join(projectRoot, fileName);
              return await readFile(localPath, "utf-8");
            } catch {
              return "";
            }
          }
        };

        const [theoryContent, readmeContent, proposalContent] =
          await Promise.all([
            loadFile("THEORY.md"),
            loadFile("README.md"),
            loadFile("PROJECT_PROPOSAL.md", "docs"),
          ]);

        let codeContext = "";
        if (needsCode) {
          // On Vercel: use pre-built index; Local: use dynamic indexer
          const index = isVercel
            ? await getPrebuiltIndex()
            : await getDynamicCodebaseIndex(projectRoot);

          if (index) {
            const results = searchCodebase(index, message, 6);
            if (results.length > 0) {
              codeContext = formatSearchResults(results);
              sendEvent(controller, "phase", {
                phase: "indexing",
                text: `Found ${results.length} relevant code sections`,
              });
            }
          }
        }

        // Phase 3: Generating
        sendEvent(controller, "phase", {
          phase: "generating",
          text: "Generating response...",
        });

        const systemPrompt = `You are an intelligent assistant for QuarkDSL. You have full access to the project's documentation and source code.

READ AND UNDERSTAND the following project materials, then use your own reasoning to answer questions:

${readmeContent ? `=== README ===\n${readmeContent}\n` : ""}
${proposalContent ? `=== PROJECT PROPOSAL ===\n${proposalContent}\n` : ""}
=== COMPILER THEORY DOCUMENTATION ===
${theoryContent || "Documentation not available."}

${codeContext ? `=== RELEVANT SOURCE CODE ===\n${codeContext}` : ""}

---END OF PROJECT MATERIALS---

INSTRUCTIONS:
You have read the complete project materials above. Now use your own intelligence and reasoning to:
- Understand what this project is about, its goals, and its significance
- Form your own opinions about its impact and value
- Answer any question the user asks based on your understanding
- Think critically and provide thoughtful, reasoned responses
- Be conversational and natural

You are NOT restricted to only quoting documentation. Use your reasoning abilities to:
- Explain why certain design decisions matter
- Discuss the project's impact in the broader context of computing
- Make connections between concepts
- Provide insights the documentation might not explicitly state

NAVIGATION FEATURE:
When referencing specific text from the Theory documentation, you can use [DocRef: text to find] to create clickable links.
Example: [DocRef: Static Single Assignment (SSA) form]
Only use this for direct quotes from the Theory documentation.`;

        const chatHistory =
          conversationHistory?.map(
            (msg: { role: string; content: string }) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            })
          ) || [];

        if (chatHistory.length === 0) {
          chatHistory.unshift({
            role: "user",
            parts: [
              {
                text: "I've given you access to the QuarkDSL project materials. Read them carefully and be ready to discuss anything about the project.",
              },
            ],
          });
          chatHistory.push({
            role: "model",
            parts: [
              {
                text: "I've reviewed the QuarkDSL project materials. I'm ready to discuss its technical implementation, design philosophy, impact, or anything else. What's on your mind?",
              },
            ],
          });
        }

        const chat = model.startChat({
          history: chatHistory,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          },
          systemInstruction: {
            role: "system",
            parts: [{ text: systemPrompt }],
          },
        });

        // Stream the actual response
        const responseStream = await chat.sendMessageStream(message);
        let fullResponse = "";

        for await (const chunk of responseStream.stream) {
          const text = chunk.text();
          fullResponse += text;
          sendEvent(controller, "content", { text });
        }

        sendEvent(controller, "done", { success: true });
        controller.close();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Stream error:", errorMessage);
        sendEvent(controller, "error", { message: errorMessage });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
}
