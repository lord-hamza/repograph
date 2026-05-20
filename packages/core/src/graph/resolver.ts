import path from "node:path";
import type { RawFile } from "../ingestion/types.js";
import type { ImportStatement, ParsedFile } from "../parsers/types.js";

export interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

export interface ResolveContext {
  fileSet: Set<string>;
  tsconfig?: TsconfigPaths;
}

const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const PY_EXTENSIONS = [".py"];
const ALL_EXTENSIONS = [...TS_EXTENSIONS, ...PY_EXTENSIONS];

function normalizePath(p: string): string {
  return p.split(path.sep).join("/").replace(/\/+/g, "/");
}

const JS_TO_TS_REWRITES: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

function rewriteJsExtensions(source: string): string[] {
  for (const [from, replacements] of Object.entries(JS_TO_TS_REWRITES)) {
    if (source.endsWith(from)) {
      const stem = source.slice(0, -from.length);
      return [source, ...replacements.map((r) => `${stem}${r}`)];
    }
  }
  return [source];
}

function tryCandidates(base: string, exts: string[], fileSet: Set<string>): string | null {
  const candidates: string[] = [];
  for (const baseCandidate of rewriteJsExtensions(base)) {
    candidates.push(baseCandidate);
    for (const ext of exts) candidates.push(`${baseCandidate}${ext}`);
    for (const ext of exts) candidates.push(`${baseCandidate}/index${ext}`);
    candidates.push(`${baseCandidate}/__init__.py`);
  }
  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (fileSet.has(normalized)) return normalized;
  }
  return null;
}

function resolveRelative(
  fromFile: string,
  source: string,
  exts: string[],
  fileSet: Set<string>,
): string | null {
  const dir = path.posix.dirname(fromFile);
  const joined = path.posix.normalize(path.posix.join(dir, source));
  return tryCandidates(joined, exts, fileSet);
}

function resolveAlias(
  source: string,
  tsconfig: TsconfigPaths,
  exts: string[],
  fileSet: Set<string>,
): string | null {
  for (const [pattern, targets] of Object.entries(tsconfig.paths)) {
    const wildcard = pattern.endsWith("/*");
    const prefix = wildcard ? pattern.slice(0, -2) : pattern;
    const matches = wildcard ? source.startsWith(`${prefix}/`) || source === prefix : source === pattern;
    if (!matches) continue;
    const suffix = wildcard ? source.slice(prefix.length).replace(/^\/+/, "") : "";
    for (const t of targets) {
      const tStripped = wildcard ? t.replace(/\/\*$/, "") : t;
      const joined = path.posix.normalize(
        path.posix.join(tsconfig.baseUrl, tStripped, suffix),
      );
      const hit = tryCandidates(joined, exts, fileSet);
      if (hit) return hit;
    }
  }
  return null;
}

function resolvePythonDotted(
  fromFile: string,
  source: string,
  fileSet: Set<string>,
): string | null {
  if (source.startsWith(".")) {
    const dots = /^\.+/.exec(source)![0].length;
    const rest = source.slice(dots).replace(/\./g, "/");
    let dir = path.posix.dirname(fromFile);
    for (let i = 1; i < dots; i++) dir = path.posix.dirname(dir);
    const joined = rest ? path.posix.join(dir, rest) : dir;
    return tryCandidates(joined, PY_EXTENSIONS, fileSet);
  }
  const asPath = source.replace(/\./g, "/");
  return tryCandidates(asPath, PY_EXTENSIONS, fileSet);
}

export function readTsconfigPaths(files: RawFile[]): TsconfigPaths | undefined {
  const candidates = files
    .filter((f) => f.path === "tsconfig.json" || f.path.endsWith("/tsconfig.json"))
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  for (const file of candidates) {
    try {
      const stripped = file.content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const json = JSON.parse(stripped) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      const opts = json.compilerOptions;
      if (!opts?.paths) continue;
      const root = path.posix.dirname(file.path);
      const baseUrl = opts.baseUrl ?? ".";
      const absBase = path.posix.normalize(
        root === "." ? baseUrl : path.posix.join(root, baseUrl),
      );
      return { baseUrl: absBase === "." ? "" : absBase, paths: opts.paths };
    } catch {
      continue;
    }
  }
  return undefined;
}

export interface ResolvedImport {
  raw: ImportStatement;
  target: string | null;
}

export function resolveImports(file: ParsedFile, ctx: ResolveContext): ResolvedImport[] {
  const out: ResolvedImport[] = [];
  for (const imp of file.imports) {
    const target = resolveImport(file, imp, ctx);
    out.push({ raw: imp, target });
  }
  return out;
}

function resolveImport(
  file: ParsedFile,
  imp: ImportStatement,
  ctx: ResolveContext,
): string | null {
  const source = imp.source;
  if (!source) return null;

  if (file.language === "python") {
    return resolvePythonDotted(file.path, source, ctx.fileSet);
  }

  if (source.startsWith(".") || source.startsWith("/")) {
    return resolveRelative(file.path, source, TS_EXTENSIONS, ctx.fileSet);
  }

  if (ctx.tsconfig) {
    const hit = resolveAlias(source, ctx.tsconfig, TS_EXTENSIONS, ctx.fileSet);
    if (hit) return hit;
  }

  return null;
}

export { ALL_EXTENSIONS };
