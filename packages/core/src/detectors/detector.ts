import type { RepoGraph } from "../graph/types.js";
import type { RawFile } from "../ingestion/types.js";
import type { ParsedFile } from "../parsers/types.js";
import type { TechCategory, TechStackEntry } from "./types.js";

interface TechSignature {
  name: string;
  category: TechCategory;
  packages?: string[];
  importMatchers?: (string | RegExp)[];
  configFiles?: (string | RegExp)[];
}

const SIGNATURES: TechSignature[] = [
  { name: "React", category: "framework", packages: ["react", "react-dom"], importMatchers: ["react", "react-dom"] },
  { name: "Next.js", category: "framework", packages: ["next"], importMatchers: [/^next(\/|$)/], configFiles: [/^next\.config\.(js|mjs|ts|cjs)$/] },
  { name: "Vue", category: "framework", packages: ["vue"], importMatchers: ["vue"] },
  { name: "Svelte", category: "framework", packages: ["svelte"], importMatchers: ["svelte"], configFiles: [/^svelte\.config\.(js|ts)$/] },
  { name: "Express", category: "framework", packages: ["express"], importMatchers: ["express"] },
  { name: "NestJS", category: "framework", packages: ["@nestjs/core", "@nestjs/common"], importMatchers: [/^@nestjs\//] },
  { name: "Fastify", category: "framework", packages: ["fastify"], importMatchers: ["fastify"] },
  { name: "FastAPI", category: "framework", packages: ["fastapi"], importMatchers: ["fastapi"] },
  { name: "Django", category: "framework", packages: ["django", "Django"], importMatchers: [/^django(\.|$)/] },
  { name: "Flask", category: "framework", packages: ["flask", "Flask"], importMatchers: [/^flask(\.|$)/] },
  { name: "Prisma", category: "orm", packages: ["prisma", "@prisma/client"], importMatchers: [/^@prisma\//], configFiles: [/^prisma\/schema\.prisma$/] },
  { name: "Drizzle", category: "orm", packages: ["drizzle-orm"], importMatchers: [/^drizzle-orm(\/|$)/] },
  { name: "TypeORM", category: "orm", packages: ["typeorm"], importMatchers: ["typeorm"] },
  { name: "Mongoose", category: "orm", packages: ["mongoose"], importMatchers: ["mongoose"] },
  { name: "SQLAlchemy", category: "orm", packages: ["sqlalchemy", "SQLAlchemy"], importMatchers: [/^sqlalchemy(\.|$)/] },
  { name: "PostgreSQL", category: "database", packages: ["pg", "postgres", "psycopg2", "psycopg2-binary", "asyncpg"], importMatchers: ["pg", "postgres", /^psycopg2(\.|$)/, /^asyncpg(\.|$)/] },
  { name: "MongoDB", category: "database", packages: ["mongodb", "pymongo"], importMatchers: ["mongodb", /^pymongo(\.|$)/] },
  { name: "Redis", category: "database", packages: ["redis", "ioredis"], importMatchers: ["redis", "ioredis"] },
  { name: "SQLite", category: "database", packages: ["sqlite3", "better-sqlite3"], importMatchers: ["sqlite3", "better-sqlite3", /^sqlite3(\.|$)/] },
  { name: "Supabase", category: "database", packages: ["@supabase/supabase-js", "@supabase/ssr"], importMatchers: [/^@supabase\//] },
  { name: "Clerk", category: "auth", packages: ["@clerk/nextjs", "@clerk/clerk-react", "@clerk/clerk-sdk-node"], importMatchers: [/^@clerk\//] },
  { name: "NextAuth", category: "auth", packages: ["next-auth"], importMatchers: [/^next-auth(\/|$)/] },
  { name: "Auth0", category: "auth", packages: ["@auth0/nextjs-auth0", "auth0"], importMatchers: [/^@auth0\//, "auth0"] },
  { name: "Jest", category: "testing", packages: ["jest"], importMatchers: ["jest"], configFiles: [/^jest\.config\.(js|ts|mjs|cjs)$/] },
  { name: "Vitest", category: "testing", packages: ["vitest"], importMatchers: ["vitest"], configFiles: [/^vitest\.config\.(js|ts)$/] },
  { name: "Pytest", category: "testing", packages: ["pytest"], importMatchers: ["pytest"], configFiles: [/^pytest\.ini$/, /^pyproject\.toml$/] },
  { name: "Playwright", category: "testing", packages: ["@playwright/test", "playwright"], importMatchers: [/^@playwright\//] },
  { name: "Webpack", category: "build", packages: ["webpack"], configFiles: [/^webpack\.config\.(js|ts|cjs|mjs)$/] },
  { name: "Vite", category: "build", packages: ["vite"], configFiles: [/^vite\.config\.(js|ts|mjs)$/] },
  { name: "Turbopack", category: "build", packages: ["turbo"], configFiles: [/^turbo\.json$/] },
  { name: "esbuild", category: "build", packages: ["esbuild"] },
  { name: "Tailwind CSS", category: "styling", packages: ["tailwindcss"], importMatchers: ["tailwindcss"], configFiles: [/^tailwind\.config\.(js|ts|cjs|mjs)$/] },
  { name: "shadcn/ui", category: "library", configFiles: [/^components\.json$/] },
  { name: "TypeScript", category: "language", packages: ["typescript"], configFiles: [/(^|\/)tsconfig\.json$/] },
  { name: "D3", category: "library", packages: ["d3"], importMatchers: [/^d3(\/|-|$)/] },
  { name: "BullMQ", category: "library", packages: ["bullmq"], importMatchers: ["bullmq"] },
  { name: "tree-sitter", category: "library", packages: ["tree-sitter"], importMatchers: [/^tree-sitter(-|$)/] },
];

interface PackageDeps {
  deps: Record<string, string>;
}

function parsePackageJsonDeps(files: RawFile[]): PackageDeps {
  // null-prototype: a dependency literally named "__proto__"/"constructor"
  // can't pollute the prototype chain or poison lookups.
  const deps: Record<string, string> = Object.create(null);
  for (const f of files) {
    if (!f.path.endsWith("package.json")) continue;
    if (f.path.includes("node_modules/")) continue;
    try {
      const json = JSON.parse(f.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      for (const set of [json.dependencies, json.devDependencies, json.peerDependencies]) {
        if (!set) continue;
        for (const [name, version] of Object.entries(set)) {
          if (!(name in deps)) deps[name] = version;
        }
      }
    } catch {
      continue;
    }
  }
  return { deps };
}

function parsePythonDeps(files: RawFile[]): PackageDeps {
  const deps: Record<string, string> = Object.create(null);
  for (const f of files) {
    if (f.path.endsWith("requirements.txt") || f.path.endsWith("requirements-dev.txt")) {
      for (const line of f.content.split(/\r?\n/)) {
        const trimmed = line.split("#")[0]!.trim();
        if (!trimmed) continue;
        const match = /^([A-Za-z0-9_.\-]+)\s*([<>=!~].*)?$/.exec(trimmed);
        if (match) deps[match[1]!.toLowerCase()] = match[2]?.trim() ?? "";
      }
    } else if (f.path.endsWith("pyproject.toml")) {
      const depBlock = /\[(?:tool\.poetry\.)?dependencies\][^[]*/i.exec(f.content)?.[0] ?? "";
      for (const m of depBlock.matchAll(/^([A-Za-z0-9_.\-]+)\s*=\s*"([^"]*)"/gm)) {
        deps[m[1]!.toLowerCase()] = m[2] ?? "";
      }
      for (const m of depBlock.matchAll(/^"([A-Za-z0-9_.\-]+)([^"]*)"/gm)) {
        deps[m[1]!.toLowerCase()] = m[2]?.trim() ?? "";
      }
    }
  }
  return { deps };
}

function lookupVersion(packages: string[] | undefined, all: Record<string, string>): string | undefined {
  if (!packages) return undefined;
  for (const pkg of packages) {
    if (pkg in all) return all[pkg];
    const lower = pkg.toLowerCase();
    if (lower in all) return all[lower];
  }
  return undefined;
}

function matchesImport(source: string, matchers: (string | RegExp)[] | undefined): boolean {
  if (!matchers) return false;
  for (const m of matchers) {
    if (typeof m === "string") {
      if (source === m || source.startsWith(`${m}/`)) return true;
    } else if (m.test(source)) {
      return true;
    }
  }
  return false;
}

function matchesConfigFile(path: string, matchers: (string | RegExp)[] | undefined): boolean {
  if (!matchers) return false;
  for (const m of matchers) {
    if (typeof m === "string") {
      if (path === m || path.endsWith(`/${m}`)) return true;
    } else if (m.test(path)) {
      return true;
    }
  }
  return false;
}

const MIN_CONFIDENCE = 0.5;
const COOCCURRENCE_THRESHOLD = 2;

export function detectTechStack(
  _graph: RepoGraph,
  rawFiles: RawFile[],
  parsedFiles: ParsedFile[],
): TechStackEntry[] {
  const { deps: npmDeps } = parsePackageJsonDeps(rawFiles);
  const { deps: pyDeps } = parsePythonDeps(rawFiles);
  const allDeps: Record<string, string> = Object.assign(Object.create(null), npmDeps, pyDeps);

  const filesPerTech = new Map<string, Set<string>>();
  const techByFile = new Map<string, Set<string>>();

  for (const sig of SIGNATURES) filesPerTech.set(sig.name, new Set());

  for (const file of parsedFiles) {
    for (const sig of SIGNATURES) {
      let matched = false;
      for (const imp of file.imports) {
        if (matchesImport(imp.source, sig.importMatchers)) {
          matched = true;
          break;
        }
      }
      if (matched) filesPerTech.get(sig.name)!.add(file.path);
    }
  }

  for (const raw of rawFiles) {
    for (const sig of SIGNATURES) {
      if (matchesConfigFile(raw.path, sig.configFiles)) {
        filesPerTech.get(sig.name)!.add(raw.path);
      }
    }
  }

  const entries: TechStackEntry[] = [];
  for (const sig of SIGNATURES) {
    const inDeps = !!lookupVersion(sig.packages, allDeps);
    const usingFiles = filesPerTech.get(sig.name)!;
    const fileCount = usingFiles.size;
    const hasConfigFile = sig.configFiles
      ? rawFiles.some((f) => matchesConfigFile(f.path, sig.configFiles))
      : false;

    let confidence = 0;
    if (inDeps) confidence += 0.5;
    if (fileCount > 0) confidence += Math.min(0.5, fileCount * 0.05 + 0.1);
    if (hasConfigFile) confidence += 0.3;
    confidence = Math.min(1, confidence);

    if (confidence < MIN_CONFIDENCE) continue;

    const version = lookupVersion(sig.packages, allDeps);

    const entry: TechStackEntry = {
      name: sig.name,
      category: sig.category,
      confidence: Number(confidence.toFixed(2)),
      fileCount,
      files: [...usingFiles].sort(),
      interactsWith: [],
    };
    if (version) entry.version = version;
    entries.push(entry);

    for (const f of usingFiles) {
      const list = techByFile.get(f) ?? new Set<string>();
      list.add(sig.name);
      techByFile.set(f, list);
    }
  }

  const cooccurrence = new Map<string, Map<string, number>>();
  for (const techs of techByFile.values()) {
    const arr = [...techs];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i]!;
        const b = arr[j]!;
        const aMap = cooccurrence.get(a) ?? new Map<string, number>();
        aMap.set(b, (aMap.get(b) ?? 0) + 1);
        cooccurrence.set(a, aMap);
        const bMap = cooccurrence.get(b) ?? new Map<string, number>();
        bMap.set(a, (bMap.get(a) ?? 0) + 1);
        cooccurrence.set(b, bMap);
      }
    }
  }

  for (const entry of entries) {
    const pairs = cooccurrence.get(entry.name);
    if (!pairs) continue;
    entry.interactsWith = [...pairs.entries()]
      .filter(([, count]) => count >= COOCCURRENCE_THRESHOLD)
      .map(([name]) => name)
      .sort();
  }

  return entries.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}
