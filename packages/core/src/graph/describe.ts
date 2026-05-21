import type { RawFile } from "../ingestion/types.js";
import type { ParsedFile } from "../parsers/types.js";

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function lower(p: string): string {
  return p.toLowerCase();
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

const COMMON_TECH_HINTS: Array<[RegExp, string]> = [
  [/^react(\/|$)/, "React component or hook"],
  [/^next(\/|$)/, "Next.js feature integration"],
  [/^@nestjs\//, "NestJS module/controller"],
  [/^express(\/|$)/, "Express middleware / handler"],
  [/^fastapi(\/|$)/, "FastAPI router / handler"],
  [/^django(\.|$)/, "Django module"],
  [/^@prisma\//, "Prisma client integration"],
  [/^@supabase\//, "Supabase client integration"],
  [/^@clerk\//, "Clerk auth integration"],
];

function topImportHint(imports: ParsedFile["imports"]): string | null {
  for (const imp of imports) {
    if (!imp.source) continue;
    for (const [re, label] of COMMON_TECH_HINTS) {
      if (re.test(imp.source)) return label;
    }
  }
  return null;
}

export interface FileDescriptionInput {
  parsed: ParsedFile;
  raw: RawFile | undefined;
  inDegree: number;
  outDegree: number;
}

/**
 * Produce a one-line, heuristic description of what a file is and why it
 * sits in the graph the way it does. Combines path patterns, parsed shape
 * (functions/classes/exports), and graph degree.
 */
export function describeFile(input: FileDescriptionInput): string {
  const { parsed, raw, inDegree, outDegree } = input;
  const path = parsed.path;
  const lp = lower(path);
  const name = basename(path);
  const ln = lower(name);

  const funcs = parsed.functions.length;
  const classes = parsed.classes.length;
  const exportsCount = parsed.exports.length;
  const importsCount = parsed.imports.length;

  // ---------- Specific filenames ----------
  if (name === "package.json") return "npm package manifest";
  if (name === "pnpm-workspace.yaml") return "pnpm workspace declaration";
  if (name === "turbo.json") return "Turborepo task pipeline config";
  if (ln === "tsconfig.json" || ln.startsWith("tsconfig.")) return "TypeScript compiler config";
  if (name === "requirements.txt" || name === "requirements-dev.txt") return "Python dependency manifest";
  if (name === "pyproject.toml" || name === "Pipfile") return "Python project manifest";
  if (name === "__init__.py") return "Python package marker";
  if (ln === "readme.md" || ln === "readme") return "Documentation";
  if (name === ".gitignore" || name === ".npmignore" || name === ".prettierrc" || name === ".eslintrc.js") return "Tooling config";
  if (/^vite\.config\./.test(ln)) return "Vite build config";
  if (/^vitest\.config\./.test(ln)) return "Vitest test config";
  if (/^webpack\.config\./.test(ln)) return "Webpack build config";
  if (/^next\.config\./.test(ln)) return "Next.js config";
  if (/^tailwind\.config\./.test(ln)) return "Tailwind theme/config";
  if (/^jest\.config\./.test(ln)) return "Jest test config";
  if (lp.endsWith("schema.prisma")) return "Prisma schema";

  // ---------- Path patterns ----------
  if (/\/(tests?|__tests__|spec)\//.test(lp) || /\.(test|spec)\.(t|j)sx?$/.test(lp) || lp.startsWith("tests/") || lp.startsWith("test/")) {
    return `Test suite (${plural(funcs, "test/fn", "test/fns")})`;
  }
  if (/\/routes?\//.test(lp) || /\/api\//.test(lp) || /\/handlers?\//.test(lp) || /\/controllers?\//.test(lp)) {
    return `API route/handler (${plural(funcs, "endpoint/fn", "endpoints/fns")}, ${plural(importsCount, "import", "imports")})`;
  }
  if (/\/components?\//.test(lp) && /\.(tsx|jsx)$/.test(lp)) {
    return `UI component (${plural(exportsCount, "export", "exports")})`;
  }
  if (/\/hooks?\//.test(lp) && /\.(tsx?|jsx?)$/.test(lp)) {
    return `React hook (${plural(funcs, "hook", "hooks")})`;
  }
  if (/\/(pages?|app)\//.test(lp) && /\.(tsx|jsx)$/.test(lp)) {
    return "Page / route component";
  }
  if (/\/(models?|schemas?|entities)\//.test(lp)) {
    return `Data model / schema (${plural(classes, "class", "classes")})`;
  }
  if (/\/(db|database)\b/.test(lp) || /\b(db|database)\.(t|p|j)/.test(lp)) {
    return `Database layer — connection / models (${classes} ${classes === 1 ? "class" : "classes"}, ${funcs} fn${funcs === 1 ? "" : "s"})`;
  }
  if (/\/(utils?|lib|helpers?|common)\//.test(lp)) {
    return `Utility / shared helpers (${plural(funcs, "helper", "helpers")})`;
  }
  if (/\/(types?|interfaces?|schemas?)\b/.test(lp) || ln === "types.ts" || ln === "types.d.ts") {
    return `Type / interface definitions (${plural(exportsCount, "export", "exports")})`;
  }
  if (/\/(commands?|cli)\//.test(lp)) {
    return `CLI command handler (${plural(funcs, "fn", "fns")})`;
  }
  if (/\/(ui|view|render)\//.test(lp)) {
    return `Presentation / rendering (${plural(funcs, "fn", "fns")})`;
  }
  if (/\/(detectors?|parsers?|exporters?|ingest(ion)?|graph)\//.test(lp)) {
    const segMatch = /\/(detectors?|parsers?|exporters?|ingest(?:ion)?|graph)\//.exec(lp);
    const layer = segMatch ? segMatch[1] : "engine";
    return `Engine ${layer} layer (${funcs} fn${funcs === 1 ? "" : "s"}, ${classes} class${classes === 1 ? "" : "es"})`;
  }
  if (
    inDegree === 0 &&
    (/(^|\/)(main|index)\.(t|j)sx?$/.test(lp) || /(^|\/)main\.py$/.test(lp))
  ) {
    return "Module entry point";
  }

  // ---------- Re-export barrel ----------
  if ((ln === "index.ts" || ln === "index.tsx" || ln === "index.js" || ln === "index.mjs") &&
      funcs === 0 && classes === 0 && exportsCount > 0) {
    return `Module barrel — re-exports ${plural(exportsCount, "symbol", "symbols")}`;
  }

  // ---------- Symbol-based fallback ----------
  let shape: string;
  if (funcs === 0 && classes === 0) {
    shape = exportsCount > 0
      ? `Constants / config (${plural(exportsCount, "export", "exports")})`
      : "Static content";
  } else if (classes > 0 && funcs === 0) {
    shape = `Class definitions (${plural(classes, "class", "classes")})`;
  } else if (funcs > 0 && classes === 0) {
    shape = `Function library (${plural(funcs, "function", "functions")})`;
  } else {
    shape = `Module — ${funcs} fn${funcs === 1 ? "" : "s"}, ${classes} class${classes === 1 ? "" : "es"}`;
  }

  // ---------- Tech hint overlay ----------
  const techHint = topImportHint(parsed.imports);
  const techSuffix = techHint ? ` · ${techHint}` : "";

  // ---------- Graph-position prefix ----------
  let posPrefix = "";
  if (inDegree === 0 && outDegree >= 2) posPrefix = "Entry point — ";
  else if (inDegree >= 5) posPrefix = "Core dependency — ";

  // Language hint when no other strong signal
  if (raw && raw.language === "unknown" && !techHint && shape === "Static content") {
    if (lp.endsWith(".md")) return "Documentation";
    if (lp.endsWith(".json")) return "Data / config (JSON)";
    if (lp.endsWith(".yaml") || lp.endsWith(".yml")) return "Data / config (YAML)";
    if (lp.endsWith(".toml")) return "Data / config (TOML)";
  }

  return `${posPrefix}${shape}${techSuffix}`;
}

export function describeFunctionNode(name: string, lineStart: number): string {
  return `Function · declared at line ${lineStart} — \`${name}\``;
}

export function describeClassNode(name: string, lineStart: number, extendsName?: string, methodCount?: number): string {
  const base = extendsName ? `Class \`${name}\` extends \`${extendsName}\`` : `Class \`${name}\``;
  const methodPart = typeof methodCount === "number" ? ` — ${methodCount} method${methodCount === 1 ? "" : "s"}` : "";
  return `${base}${methodPart} · line ${lineStart}`;
}
