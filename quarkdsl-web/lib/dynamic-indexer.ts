import { readFile, readdir } from "fs/promises";
import path from "path";
import type { CodebaseIndex, CodeChunk } from "./codebase-search";

const EXTENSIONS_TO_INDEX = [".rs", ".tgpu", ".md"];
const DIRS_TO_SKIP = [
  "target",
  "node_modules",
  ".git",
  "quarkdsl-web",
  ".next",
];

// Cache with timestamp for staleness check
let cachedIndex: CodebaseIndex | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache in dev, will refresh on code changes

/**
 * Get the codebase index, rebuilding if stale or missing
 */
export async function getDynamicCodebaseIndex(
  rootDir: string
): Promise<CodebaseIndex | null> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedIndex && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIndex;
  }

  try {
    console.log("[DynamicIndexer] Building fresh index from:", rootDir);
    cachedIndex = await buildIndex(rootDir);
    cacheTimestamp = now;
    console.log(
      `[DynamicIndexer] Index built: ${cachedIndex.chunks.length} chunks from ${cachedIndex.fileList.length} files`
    );
    return cachedIndex;
  } catch (error) {
    console.error("[DynamicIndexer] Failed to build index:", error);
    return null;
  }
}

/**
 * Force refresh the index (call after known code changes)
 */
export function invalidateCodebaseCache(): void {
  cachedIndex = null;
  cacheTimestamp = 0;
}

async function buildIndex(rootDir: string): Promise<CodebaseIndex> {
  const files = await walkDir(rootDir);
  const allChunks: CodeChunk[] = [];
  const fileList: string[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const relativePath = path.relative(rootDir, file).replace(/\\/g, "/");
      fileList.push(relativePath);

      const chunks = chunkFile(file, content, rootDir);
      allChunks.push(...chunks);
    } catch {
      // Skip unreadable files
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    chunks: allChunks,
    fileList,
  };
}

async function walkDir(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!DIRS_TO_SKIP.includes(entry.name)) {
          await walkDir(fullPath, files);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (EXTENSIONS_TO_INDEX.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Skip unreadable directories
  }

  return files;
}

function chunkFile(
  filePath: string,
  content: string,
  rootDir: string
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split("\n");
  const fileName = path.basename(filePath);
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const fileType = getFileType(filePath);

  if (lines.length <= 100) {
    chunks.push({
      id: `${relativePath}:1-${lines.length}`,
      filePath: relativePath,
      fileName,
      content,
      type: fileType,
      keywords: extractKeywords(content, filePath),
      startLine: 1,
      endLine: lines.length,
    });
    return chunks;
  }

  const CHUNK_SIZE = 80;
  const OVERLAP = 10;

  for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
    const start = i;
    const end = Math.min(i + CHUNK_SIZE, lines.length);
    const chunkContent = lines.slice(start, end).join("\n");

    chunks.push({
      id: `${relativePath}:${start + 1}-${end}`,
      filePath: relativePath,
      fileName,
      content: chunkContent,
      type: fileType,
      keywords: extractKeywords(chunkContent, filePath),
      startLine: start + 1,
      endLine: end,
    });

    if (end >= lines.length) break;
  }

  return chunks;
}

function getFileType(filePath: string): "rust" | "example" | "markdown" {
  if (filePath.endsWith(".rs")) return "rust";
  if (filePath.endsWith(".tgpu")) return "example";
  return "markdown";
}

function extractKeywords(content: string, filePath: string): string[] {
  const keywords = new Set<string>();

  // Add filename parts
  const fileName = path.basename(filePath, path.extname(filePath));
  fileName.split(/[_\-]/).forEach((w) => keywords.add(w.toLowerCase()));

  // Extract Rust constructs
  const fnMatches = content.match(/fn\s+(\w+)/g) || [];
  fnMatches.forEach((m) => keywords.add(m.replace("fn ", "").toLowerCase()));

  const structMatches = content.match(/struct\s+(\w+)/g) || [];
  structMatches.forEach((m) =>
    keywords.add(m.replace("struct ", "").toLowerCase())
  );

  const enumMatches = content.match(/enum\s+(\w+)/g) || [];
  enumMatches.forEach((m) =>
    keywords.add(m.replace("enum ", "").toLowerCase())
  );

  const implMatches = content.match(/impl\s+(\w+)/g) || [];
  implMatches.forEach((m) =>
    keywords.add(m.replace("impl ", "").toLowerCase())
  );

  // Domain-specific terms
  const terms = [
    "lexer",
    "parser",
    "ast",
    "token",
    "compile",
    "codegen",
    "wgsl",
    "quantum",
    "gpu",
    "shader",
    "type",
    "check",
    "error",
    "optimize",
    "ir",
    "lower",
    "backend",
    "frontend",
    "middle",
    "orchestrator",
    "expression",
    "statement",
    "function",
    "variable",
    "loop",
    "if",
    "qubit",
    "gate",
    "measure",
    "hybrid",
    "kernel",
    "buffer",
  ];
  terms.forEach((term) => {
    if (content.toLowerCase().includes(term)) keywords.add(term);
  });

  return Array.from(keywords);
}
