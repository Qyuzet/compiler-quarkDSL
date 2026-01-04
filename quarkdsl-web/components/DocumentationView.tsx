"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, MessageSquare, Bot, User } from "lucide-react";
import TableOfContents from "./TableOfContents";
import ChatInput from "./ChatInput";
import DocumentationContent from "./DocumentationContent";
import ChatMessageContent from "./ChatMessageContent";
import { parseDocReferences, scrollToDocSection } from "@/lib/doc-navigation";
import { memo } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type LoadingPhase = "idle" | "reasoning" | "indexing" | "docs" | "generating";

export default function DocumentationView() {
  const [theoryContent, setTheoryContent] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");
  const [phaseText, setPhaseText] = useState<string>("");
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const [streamingContent, setStreamingContent] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/THEORY.md")
      .then((res) => res.text())
      .then((text) => setTheoryContent(text))
      .catch((err) => console.error("Failed to load THEORY.md:", err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-scroll to doc references when AI responds
  const autoScrollToReference = useCallback((text: string) => {
    const refs = parseDocReferences(text);
    if (refs.length > 0) {
      // Small delay to ensure the DOM is ready
      setTimeout(() => {
        scrollToDocSection(refs[0].searchText);
      }, 300);
    }
  }, []);

  const addAssistantMessage = useCallback(
    (text: string) => {
      const assistantMessage: Message = {
        role: "assistant",
        content: text,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-scroll to referenced section
      autoScrollToReference(text);
    },
    [autoScrollToReference]
  );

  const handleSendMessage = useCallback(
    async (inputMessage: string) => {
      if (!inputMessage.trim() || loading) return;

      const userMessage: Message = { role: "user", content: inputMessage };
      const fullHistory = [...messages, userMessage];

      setMessages(fullHistory);
      setLoading(true);
      setLoadingPhase("reasoning");
      setPhaseText("Analyzing your question...");
      setAiReasoning("");
      setStreamingContent("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: inputMessage,
            conversationHistory: fullHistory,
          }),
        });

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              const eventType = line.slice(7);
              const dataLine = lines[lines.indexOf(line) + 1];
              if (dataLine?.startsWith("data: ")) {
                try {
                  const data = JSON.parse(dataLine.slice(6));

                  switch (eventType) {
                    case "phase":
                      setLoadingPhase(data.phase as LoadingPhase);
                      setPhaseText(data.text);
                      break;
                    case "reasoning":
                      setAiReasoning(data.text);
                      break;
                    case "content":
                      fullContent += data.text;
                      setStreamingContent(fullContent);
                      break;
                    case "done":
                      addAssistantMessage(fullContent);
                      break;
                    case "error":
                      addAssistantMessage(`Error: ${data.message}`);
                      break;
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        addAssistantMessage(
          "Failed to connect to the assistant. Please try again."
        );
      } finally {
        setLoading(false);
        setLoadingPhase("idle");
        setAiReasoning("");
        setStreamingContent("");
        setPhaseText("");
      }
    },
    [loading, messages, addAssistantMessage]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <Card className="lg:col-span-2 flex flex-col h-[calc(100vh-140px)]">
        <CardHeader className="pb-2 pt-3 px-4 shrink-0 border-b">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4" />
            Theory Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="grid grid-cols-[220px_1fr] h-full">
            <div className="border-r bg-neutral-50/50 dark:bg-neutral-900/50 p-4 overflow-y-auto">
              <TableOfContents content={theoryContent} />
            </div>
            <ScrollArea className="h-full px-6 py-4" id="documentation-scroll">
              <DocumentationContent content={theoryContent} />
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col h-[calc(100vh-140px)] border-2 overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 shrink-0 border-b bg-linear-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="p-1.5 rounded-lg bg-blue-600">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            AI Assistant
          </CardTitle>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            Ask about QuarkDSL, compiler theory, or documentation
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col px-3 pb-3 gap-3 min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 py-2 pr-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <Bot className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                    Start a Conversation
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Ask about QuarkDSL, compiler theory, or the documentation.
                  </p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white max-w-[75%]"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-[calc(100%-2.5rem)] overflow-hidden"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {msg.content}
                      </p>
                    ) : (
                      <ChatMessageContent content={msg.content} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-neutral-600 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              ))}
              {loadingPhase !== "idle" && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-neutral-100 dark:bg-neutral-800 max-w-[85%]">
                    <div className="space-y-2">
                      {/* Reasoning section - shows AI thinking */}
                      {aiReasoning && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-300 italic border-l-2 border-purple-400 pl-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-r">
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Thinking:{" "}
                          </span>
                          {aiReasoning}
                        </div>
                      )}

                      {/* Phase indicator */}
                      <div className="flex items-center gap-2">
                        {loadingPhase === "reasoning" && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                            <span className="text-xs text-purple-600 dark:text-purple-400">
                              {phaseText}
                            </span>
                          </>
                        )}
                        {loadingPhase === "indexing" && (
                          <>
                            <svg
                              className="w-4 h-4 text-orange-500 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            <span className="text-xs text-orange-600 dark:text-orange-400">
                              {phaseText}
                            </span>
                          </>
                        )}
                        {loadingPhase === "docs" && (
                          <>
                            <svg
                              className="w-4 h-4 text-green-500 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {phaseText}
                            </span>
                          </>
                        )}
                        {loadingPhase === "generating" && (
                          <>
                            <div className="flex gap-1">
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              />
                              <div
                                className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {phaseText}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Streaming content preview */}
                      {streamingContent && (
                        <div className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                          {streamingContent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <ChatInput
            onSend={handleSendMessage}
            loading={loading}
            loadingPhase={loadingPhase}
          />
        </CardContent>
      </Card>
    </div>
  );
}
