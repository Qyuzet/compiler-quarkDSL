const fs = require("fs");
const path = require("path");

const EXTENSIONS_TO_INDEX = [".rs", ".tgpu", ".md"];
const DIRS_TO_SKIP = ["target", "node_modules", ".git", "quarkdsl-web"];
const ROOT_DIR = path.join(__dirname, "..", "..");

function extractKeywords(content, filePath) {
  const keywords = new Set();

  const fileName = path.basename(filePath, path.extname(filePath));
  fileName.split(/[_\-]/).forEach((w) => keywords.add(w.toLowerCase()));

  const fnMatches = content.match(/fn\s+(\w+)/g) || [];
  fnMatches.forEach((m) => keywords.add(m.replace("fn ", "").toLowerCase()));

  const structMatches = content.match(/struct\s+(\w+)/g) || [];
  structMatches.forEach((m) => keywords.add(m.replace("struct ", "").toLowerCase()));

  const enumMatches = content.match(/enum\s+(\w+)/g) || [];
  enumMatches.forEach((m) => keywords.add(m.replace("enum ", "").toLowerCase()));

  const implMatches = content.match(/impl\s+(\w+)/g) || [];
  implMatches.forEach((m) => keywords.add(m.replace("impl ", "").toLowerCase()));

  const terms = [
    "lexer", "parser", "ast", "token", "compile", "codegen", "wgsl",
    "quantum", "gpu", "shader", "type", "check", "error", "optimize",
    "ir", "lower", "backend", "frontend", "middle", "orchestrator",
    "expression", "statement", "function", "variable", "loop", "if",
    "qubit", "gate", "measure", "hybrid", "kernel", "buffer"
  ];
  terms.forEach((term) => {
    if (content.toLowerCase().includes(term)) keywords.add(term);
  });

  return Array.from(keywords);
}

function getFileType(filePath) {
  if (filePath.endsWith(".rs")) return "rust";
  if (filePath.endsWith(".tgpu")) return "example";
  return "markdown";
}

function chunkFile(filePath, content) {
  const chunks = [];
  const lines = content.split("\n");
  const fileName = path.basename(filePath);
  const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
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

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!DIRS_TO_SKIP.includes(entry.name)) {
        walkDir(fullPath, files);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS_TO_INDEX.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function buildIndex() {
  console.log("Indexing codebase from:", ROOT_DIR);

  const files = walkDir(ROOT_DIR);
  console.log(`Found ${files.length} files to index`);

  const allChunks = [];
  const fileList = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, "/");
    fileList.push(relativePath);

    const chunks = chunkFile(file, content);
    allChunks.push(...chunks);
    console.log(`  ${relativePath}: ${chunks.length} chunk(s)`);
  }

  const index = {
    generatedAt: new Date().toISOString(),
    chunks: allChunks,
    fileList,
  };

  console.log(`Total chunks: ${allChunks.length}`);
  return index;
}

// Main execution
const codebaseIndex = buildIndex();
const outputPath = path.join(__dirname, "..", "public", "codebase-index.json");
fs.writeFileSync(outputPath, JSON.stringify(codebaseIndex, null, 2));
console.log(`Index written to: ${outputPath}`);

