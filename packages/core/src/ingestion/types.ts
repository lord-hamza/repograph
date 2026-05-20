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

const EXCLUDED_SUFFIXES = [".min.js", ".min.css", ".map"];

const EXCLUDED_BASENAMES = new Set([
  "repograph-graph.html",
  "repograph-graph.json",
  "repograph-context.md",
]);

export function isExcludedPath(relPath: string): boolean {
  const segments = relPath.split("/");
  for (const segment of segments) {
    if (EXCLUDED_DIRS.has(segment)) return true;
  }
  for (const suffix of EXCLUDED_SUFFIXES) {
    if (relPath.endsWith(suffix)) return true;
  }
  const basename = segments[segments.length - 1] ?? relPath;
  if (EXCLUDED_BASENAMES.has(basename)) return true;
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
