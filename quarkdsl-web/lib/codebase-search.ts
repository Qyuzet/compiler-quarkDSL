interface CodeChunk {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  type: "rust" | "example" | "markdown";
  keywords: string[];
  startLine: number;
  endLine: number;
}

interface CodebaseIndex {
  generatedAt: string;
  chunks: CodeChunk[];
  fileList: string[];
}

interface SearchResult {
  chunk: CodeChunk;
  score: number;
  matchedTerms: string[];
}

// Simple keyword-based search with scoring
export function searchCodebase(
  index: CodebaseIndex,
  query: string,
  maxResults: number = 5
): SearchResult[] {
  const queryTerms = extractQueryTerms(query);
  const results: SearchResult[] = [];

  for (const chunk of index.chunks) {
    const { score, matchedTerms } = scoreChunk(chunk, queryTerms);
    if (score > 0) {
      results.push({ chunk, score, matchedTerms });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

function extractQueryTerms(query: string): string[] {
  const terms = new Set<string>();

  // Split into words and normalize
  const words = query.toLowerCase().split(/\s+/);
  words.forEach((w) => {
    const cleaned = w.replace(/[^a-z0-9_]/g, "");
    if (cleaned.length > 2) {
      terms.add(cleaned);
    }
  });

  // Add common term mappings for compiler concepts
  const mappings: Record<string, string[]> = {
    parse: ["parser", "parsing", "ast"],
    lex: ["lexer", "token", "tokenize"],
    type: ["typecheck", "typing", "types"],
    compile: ["compiler", "codegen", "backend"],
    gpu: ["wgsl", "shader", "kernel"],
    quantum: ["qubit", "gate", "measure", "qasm"],
    optimize: ["optimization", "optimizer"],
    error: ["diagnostic", "error", "warning"],
    code: ["codegen", "generate", "emit"],
  };

  const originalTerms = Array.from(terms);
  for (const term of originalTerms) {
    for (const [key, synonyms] of Object.entries(mappings)) {
      if (term.includes(key) || synonyms.some((s) => term.includes(s))) {
        synonyms.forEach((s) => terms.add(s));
        terms.add(key);
      }
    }
  }

  return Array.from(terms);
}

function scoreChunk(
  chunk: CodeChunk,
  queryTerms: string[]
): { score: number; matchedTerms: string[] } {
  let score = 0;
  const matchedTerms: string[] = [];
  const contentLower = chunk.content.toLowerCase();
  const filePathLower = chunk.filePath.toLowerCase();

  for (const term of queryTerms) {
    // Check keywords (high weight)
    if (chunk.keywords.includes(term)) {
      score += 10;
      matchedTerms.push(term);
    }

    // Check file path (medium weight)
    if (filePathLower.includes(term)) {
      score += 5;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }

    // Check content (lower weight but count occurrences)
    const regex = new RegExp(term, "gi");
    const matches = contentLower.match(regex);
    if (matches) {
      score += Math.min(matches.length, 5); // Cap at 5 occurrences
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }
  }

  // Bonus for file type relevance
  if (chunk.type === "rust") score *= 1.2;
  if (chunk.type === "example") score *= 1.1;

  return { score, matchedTerms };
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No relevant code found in the codebase.";
  }

  let output = "RELEVANT CODE FROM CODEBASE:\n\n";

  for (const result of results) {
    const { chunk } = result;
    output += `--- ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine}) ---\n`;
    output += "```" + (chunk.type === "rust" ? "rust" : "") + "\n";
    output += chunk.content + "\n";
    output += "```\n\n";
  }

  return output;
}

export type { CodebaseIndex, CodeChunk, SearchResult };

