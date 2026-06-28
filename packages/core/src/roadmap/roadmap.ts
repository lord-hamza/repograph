import type { TechStackEntry } from "../detectors/types.js";
import type { RepoGraph } from "../graph/types.js";
import type { Roadmap, RoadmapSkill, RoadmapStage, SkillLevel } from "./types.js";

// ---------------------------------------------------------------------------
//  Stage definitions (ordered foundations → ship)
// ---------------------------------------------------------------------------
type StageId =
  | "foundations"
  | "tooling"
  | "frameworks"
  | "data"
  | "testing"
  | "architecture"
  | "ship";

const STAGE_META: Record<StageId, { title: string; subtitle: string; order: number }> = {
  foundations: { title: "Foundations", subtitle: "The language and basics everything else builds on", order: 0 },
  tooling: { title: "Tooling & Build", subtitle: "How the project is compiled, linked, and run", order: 1 },
  frameworks: { title: "Frameworks & UI", subtitle: "The libraries that shape the application", order: 2 },
  data: { title: "Data & Services", subtitle: "Persistence, databases, auth, and background work", order: 3 },
  testing: { title: "Testing & Quality", subtitle: "Proving the code works and keeping it that way", order: 4 },
  architecture: { title: "Architecture & Patterns", subtitle: "How this repo is structured and why", order: 5 },
  ship: { title: "Ship It", subtitle: "Publishing, automation, and releasing to the world", order: 6 },
};

// ---------------------------------------------------------------------------
//  Curated knowledge base — keyed by the exact tech names the detector emits.
//  Each entry routes a detected tech to a stage with a canonical doc link.
// ---------------------------------------------------------------------------
interface TechKnowledge {
  stage: StageId;
  doc: string;
  /** Optional friendlier label; defaults to the tech name. */
  label?: string;
  level?: SkillLevel;
}

const TECH_KB: Record<string, TechKnowledge> = {
  // languages
  TypeScript: { stage: "foundations", doc: "https://www.typescriptlang.org/docs/", level: "core" },
  // frameworks
  React: { stage: "frameworks", doc: "https://react.dev/learn", level: "core" },
  "Next.js": { stage: "frameworks", doc: "https://nextjs.org/docs", level: "core" },
  Vue: { stage: "frameworks", doc: "https://vuejs.org/guide/introduction.html", level: "core" },
  Svelte: { stage: "frameworks", doc: "https://svelte.dev/docs", level: "core" },
  Express: { stage: "frameworks", doc: "https://expressjs.com/en/guide/routing.html", level: "core" },
  NestJS: { stage: "frameworks", doc: "https://docs.nestjs.com/", level: "core" },
  Fastify: { stage: "frameworks", doc: "https://fastify.dev/docs/latest/", level: "core" },
  FastAPI: { stage: "frameworks", doc: "https://fastapi.tiangolo.com/", level: "core" },
  Django: { stage: "frameworks", doc: "https://docs.djangoproject.com/en/stable/", level: "core" },
  Flask: { stage: "frameworks", doc: "https://flask.palletsprojects.com/", level: "core" },
  // styling / ui
  "Tailwind CSS": { stage: "frameworks", doc: "https://tailwindcss.com/docs", level: "recommended" },
  "shadcn/ui": { stage: "frameworks", doc: "https://ui.shadcn.com/docs", level: "recommended" },
  D3: { stage: "frameworks", doc: "https://d3js.org/getting-started", level: "recommended" },
  // data / orm
  Prisma: { stage: "data", doc: "https://www.prisma.io/docs", level: "core" },
  Drizzle: { stage: "data", doc: "https://orm.drizzle.team/docs/overview", level: "core" },
  TypeORM: { stage: "data", doc: "https://typeorm.io/", level: "core" },
  Mongoose: { stage: "data", doc: "https://mongoosejs.com/docs/", level: "core" },
  SQLAlchemy: { stage: "data", doc: "https://docs.sqlalchemy.org/", level: "core" },
  PostgreSQL: { stage: "data", doc: "https://www.postgresql.org/docs/", level: "recommended" },
  MongoDB: { stage: "data", doc: "https://www.mongodb.com/docs/", level: "recommended" },
  Redis: { stage: "data", doc: "https://redis.io/docs/latest/", level: "recommended" },
  SQLite: { stage: "data", doc: "https://www.sqlite.org/docs.html", level: "recommended" },
  Supabase: { stage: "data", doc: "https://supabase.com/docs", level: "recommended" },
  BullMQ: { stage: "data", doc: "https://docs.bullmq.io/", level: "advanced" },
  // auth
  Clerk: { stage: "data", doc: "https://clerk.com/docs", level: "recommended" },
  NextAuth: { stage: "data", doc: "https://authjs.dev/", level: "recommended" },
  Auth0: { stage: "data", doc: "https://auth0.com/docs", level: "recommended" },
  // testing
  Jest: { stage: "testing", doc: "https://jestjs.io/docs/getting-started", level: "core" },
  Vitest: { stage: "testing", doc: "https://vitest.dev/guide/", level: "core" },
  Pytest: { stage: "testing", doc: "https://docs.pytest.org/", level: "core" },
  Playwright: { stage: "testing", doc: "https://playwright.dev/docs/intro", level: "recommended" },
  // build / tooling
  Webpack: { stage: "tooling", doc: "https://webpack.js.org/concepts/", level: "recommended" },
  Vite: { stage: "tooling", doc: "https://vite.dev/guide/", level: "recommended" },
  Turbopack: { stage: "tooling", doc: "https://turborepo.com/docs", label: "Turborepo", level: "recommended" },
  esbuild: { stage: "tooling", doc: "https://esbuild.github.io/", level: "recommended" },
  // architecture-leaning libraries
  "tree-sitter": { stage: "architecture", doc: "https://tree-sitter.github.io/tree-sitter/", level: "advanced" },
};

// Category-based fallback for any detected tech we don't curate explicitly.
const CATEGORY_STAGE: Record<string, StageId> = {
  framework: "frameworks",
  library: "frameworks",
  styling: "frameworks",
  ui: "frameworks",
  database: "data",
  orm: "data",
  auth: "data",
  testing: "testing",
  build: "tooling",
  language: "foundations",
  other: "architecture",
};

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
function repoNameOf(graph: RepoGraph): string {
  const meta = graph.metadata;
  if (meta.owner && meta.name) return `${meta.owner}/${meta.name}`;
  const trimmed = (meta.target ?? "").replace(/\/+$/, "");
  const base = trimmed.split("/").pop();
  return base && base.length > 0 ? base : "this repo";
}

function dominantLanguage(graph: RepoGraph): { id: "typescript" | "javascript" | "python" | null; label: string } {
  const s = graph.languageStats ?? { typescript: 0, javascript: 0, python: 0, unknown: 0 };
  const ranked: Array<["typescript" | "javascript" | "python", number, string]> = [
    ["typescript", s.typescript ?? 0, "TypeScript"],
    ["python", s.python ?? 0, "Python"],
    ["javascript", s.javascript ?? 0, "JavaScript"],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] === 0) return { id: null, label: "" };
  return { id: top[0], label: top[2] };
}

function workspaceCount(graph: RepoGraph): number {
  return graph.nodes.filter(
    (n) => n.filePath.endsWith("package.json") && !n.filePath.includes("node_modules/"),
  ).length;
}

function fileCountSuffix(n: number): string {
  if (n <= 0) return "detected in the project's dependencies";
  return `used across ${n} file${n === 1 ? "" : "s"} here`;
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------
export function buildRoadmap(graph: RepoGraph, techStack: TechStackEntry[]): Roadmap {
  const repoName = repoNameOf(graph);
  const buckets = new Map<StageId, RoadmapSkill[]>();
  const seen = new Set<string>(); // dedupe skill names across the whole roadmap
  const add = (stage: StageId, skill: RoadmapSkill): void => {
    const key = `${stage}::${skill.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = buckets.get(stage) ?? [];
    list.push(skill);
    buckets.set(stage, list);
  };

  // ---- Foundations: dominant language + universal basics ----
  const lang = dominantLanguage(graph);
  if (lang.id === "typescript") {
    add("foundations", {
      name: "TypeScript",
      why: `The primary language here (${graph.languageStats.typescript} TS files). Master types, generics, and ES modules.`,
      doc: "https://www.typescriptlang.org/docs/",
      level: "core",
    });
    add("foundations", {
      name: "JavaScript & the runtime",
      why: "TypeScript compiles to JavaScript — understand the language and event loop underneath it.",
      doc: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      level: "core",
    });
  } else if (lang.id === "javascript") {
    add("foundations", {
      name: "JavaScript",
      why: `The primary language here (${graph.languageStats.javascript} JS files). Learn modules, async/await, and the event loop.`,
      doc: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
      level: "core",
    });
  } else if (lang.id === "python") {
    add("foundations", {
      name: "Python",
      why: `The primary language here (${graph.languageStats.python} Python files). Learn modules, packages, and the import system.`,
      doc: "https://docs.python.org/3/",
      level: "core",
    });
  }
  add("foundations", {
    name: "Git & version control",
    why: "Every codebase like this lives in Git — branching, commits, and pull requests are table stakes.",
    doc: "https://git-scm.com/doc",
    level: "core",
  });
  add("foundations", {
    name: "Reading a dependency graph",
    why: `This repo resolved ${graph.edges.filter((e) => e.type === "import").length} import edges — learn to read files (nodes) and imports (edges) to navigate any codebase.`,
    level: "core",
  });

  // ---- Tech-stack driven skills (frameworks, data, testing, tooling) ----
  for (const tech of techStack) {
    const kb = TECH_KB[tech.name];
    const stage = kb?.stage ?? CATEGORY_STAGE[tech.category] ?? "architecture";
    add(stage, {
      name: kb?.label ?? tech.name,
      why: `${tech.category[0]!.toUpperCase()}${tech.category.slice(1)} ${fileCountSuffix(tech.fileCount)}.`,
      ...(kb?.doc ? { doc: kb.doc } : {}),
      level: kb?.level ?? "recommended",
    });
  }

  // ---- Tooling: package manager + monorepo (structural) ----
  const workspaces = workspaceCount(graph);
  if (workspaces > 1) {
    add("tooling", {
      name: "Monorepo workspaces",
      why: `This is a monorepo with ${workspaces} workspaces — learn pnpm/npm workspaces and task orchestration.`,
      doc: "https://pnpm.io/workspaces",
      level: "core",
    });
  }
  if (lang.id === "typescript" || lang.id === "javascript") {
    add("tooling", {
      name: "Package management & semver",
      why: "Understand package.json, lockfiles, and how version ranges resolve.",
      doc: "https://docs.npmjs.com/about-semantic-versioning",
      level: "recommended",
    });
  }

  // ---- Architecture: derived from graph shape ----
  add("architecture", {
    name: "Module boundaries & dependency direction",
    why: `${graph.nodes.filter((n) => n.type === "file").length} files connected by imports — keep dependencies flowing one way and layers clean.`,
    doc: "https://nodejs.org/api/esm.html",
    level: "core",
  });
  if (graph.entryPoints.length > 0) {
    add("architecture", {
      name: "Entry points & composition roots",
      why: `RepoGraph found ${graph.entryPoints.length} entry point${graph.entryPoints.length === 1 ? "" : "s"} — learn how an app wires itself together from its root.`,
      level: "recommended",
    });
  }
  if (graph.circularDependencies.length > 0) {
    add("architecture", {
      name: "Breaking circular dependencies",
      why: `⚠ ${graph.circularDependencies.length} cycle${graph.circularDependencies.length === 1 ? "" : "s"} detected here — learn to spot and untangle them before they bite.`,
      doc: "https://nodejs.org/api/modules.html#cycles",
      level: "advanced",
    });
  }

  // ---- Ship It: always present ----
  add("ship", {
    name: "Publishing to npm / a registry",
    why: "Package and release the project so others can install and use it.",
    doc: "https://docs.npmjs.com/cli/v10/commands/npm-publish",
    level: "recommended",
  });
  add("ship", {
    name: "CI/CD with GitHub Actions",
    why: "Automate builds, tests, and releases on every push.",
    doc: "https://docs.github.com/en/actions",
    level: "recommended",
  });
  add("ship", {
    name: "Writing a great README",
    why: "Documentation is how a project earns users — make the first screen count.",
    doc: "https://www.makeareadme.com/",
    level: "recommended",
  });

  // ---- Assemble ordered, non-empty stages ----
  const stages: RoadmapStage[] = (Object.keys(STAGE_META) as StageId[])
    .map((id) => ({ id, meta: STAGE_META[id], skills: buckets.get(id) ?? [] }))
    .filter((s) => s.skills.length > 0)
    .sort((a, b) => a.meta.order - b.meta.order)
    .map(({ id, meta, skills }) => ({
      id,
      title: meta.title,
      subtitle: meta.subtitle,
      skills: skills.sort((a, b) => levelRank(a.level) - levelRank(b.level)),
    }));

  const skillCount = stages.reduce((sum, s) => sum + s.skills.length, 0);
  const firstTitle = stages[0]?.title ?? "Foundations";

  return {
    repoName,
    summary: `To build a project like ${repoName}, follow this ${skillCount}-skill path from ${firstTitle.toLowerCase()} to shipping.`,
    stages,
    skillCount,
  };
}

function levelRank(level: SkillLevel): number {
  return level === "core" ? 0 : level === "recommended" ? 1 : 2;
}
