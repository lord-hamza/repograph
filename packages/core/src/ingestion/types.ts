export type Language = "python" | "javascript" | "typescript" | "unknown";

export interface RawFile {
  path: string;
  content: string;
  language: Language;
  size: number;
}

export const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  ".turbo",
  "coverage",
  ".venv",
  "venv",
]);

const EXCLUDED_SUFFIXES = [".min.js", ".min.css", ".map", ".tsbuildinfo", ".lock"];

const EXCLUDED_BASENAMES = new Set([
  "repograph-graph.html",
  "repograph-graph.json",
  "repograph-context.md",
  ".DS_Store",
]);

// Secret-bearing files never belong in a graph or an MCP context file we may
// hand to an AI assistant. Matches `.env`, `.env.local`, `.env.production`, etc.
const SECRET_FILE_RE = /^\.env(\..+)?$/;
const SECRET_SUFFIXES = [".pem", ".key", ".p12", ".pfx"];

export function isExcludedPath(relPath: string): boolean {
  if (!relPath) return true;
  const segments = relPath.split("/");
  for (const segment of segments) {
    if (EXCLUDED_DIRS.has(segment)) return true;
  }
  for (const suffix of EXCLUDED_SUFFIXES) {
    if (relPath.endsWith(suffix)) return true;
  }
  for (const suffix of SECRET_SUFFIXES) {
    if (relPath.endsWith(suffix)) return true;
  }
  const basename = segments[segments.length - 1] ?? relPath;
  if (EXCLUDED_BASENAMES.has(basename)) return true;
  if (SECRET_FILE_RE.test(basename)) return true;
  return false;
}

export function detectLanguage(path: string): Language {
  const lower = path.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return "typescript";
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return "javascript";
  }
  return "unknown";
}
