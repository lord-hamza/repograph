# RepoGraph — Project Memory (CLAUDE.md)

> Auto-loaded context for any Claude Code session in this repo. Read this first.
> Deep dives live in [`.claude/context/`](.claude/context/) (local, git-ignored).

## What this is

RepoGraph turns **any codebase into an interactive code atlas + a learning roadmap + an MCP context file** with one CLI command. It parses a repo, resolves every import, builds a file/function/class dependency graph, detects the tech stack, derives a deterministic "how to learn to build this" roadmap, and emits:

| Output | Purpose |
| --- | --- |
| `repograph-graph.html` | Self-contained interactive page — **5 views**: Globe, Map, Web, Brain, Roadmap. Opens from `file://`, no server. |
| `repograph-graph.json` | D3-shaped `{ metadata, nodes, links }` graph data (roadmap embedded in `metadata.roadmap`). |
| `repograph-context.md` | MCP/AI-assistant structural summary, including a Learning Roadmap section. |

## Repo shape (pnpm + Turborepo monorepo)

```
repograph/
├── packages/core/   @repograph/core  — engine (no UI deps)
│   └── src/
│       ├── ingestion/   local FS walk + GitHub REST API → RawFile[]
│       ├── parsers/      TS/JS via TypeScript Compiler API; Python via tree-sitter
│       ├── graph/        resolver (imports/aliases) + builder (graphology, Tarjan SCC) + describe
│       ├── detectors/    ~37 tech signatures → TechStackEntry[]
│       ├── roadmap/       deterministic learning roadmap from techStack + graph  ← NEW
│       ├── exporters/    json + markdown
│       └── scan.ts       scan(target) → { graph, techStack, roadmap, toJson(), toMarkdown() }
└── apps/cli/        @repograph/cli   — `repograph` binary
    └── src/
        ├── commands/    pull · roadmap|learn · brain  (+ run.ts shared pipeline)
        └── ui/
            ├── stats.ts / output.ts
            └── html/     SINGLE self-contained page generator  ← NEW (split)
                ├── index.ts   composes the file
                ├── styles.ts  all CSS
                ├── markup.ts  body / sidebar / 5-button toggle / roadmap container
                └── client.ts  the entire browser app (globe/map/web/brain/roadmap)
```

## Pipeline (one direction, no cycles)

`scan(target)` → `ingest` → `parse` → `buildGraph` → `detectTechStack` → `buildRoadmap` → `exportGraphJson` / `exportGraphMarkdown` / `renderGraphHtml`.

**Data contract** the HTML consumes (`exporters/json.ts` → `ExportedGraph`):
`{ metadata: { repo, languageStats, techStack, entryPoints, orphanFiles, circularDependencies, roadmap? }, nodes: GraphNode[], links: { source, target, type, weight }[] }`

## Commands

```bash
pnpm install
pnpm build            # turbo → tsc per package
pnpm test             # turbo → vitest per package (60 tests)
pnpm typecheck
pnpm lint
pnpm format

# Run the CLI from source build:
node apps/cli/dist/index.js pull .            # scan, write 3 files
node apps/cli/dist/index.js pull <gh-url> --open
node apps/cli/dist/index.js roadmap .         # opens HTML on the Roadmap tab
node apps/cli/dist/index.js brain .           # opens HTML on the Brain tab
```

CLI commands: `pull <target>` (`-o`, `-f json|md|both`, `--open`, `-v`); `roadmap`/`learn <target>` and `brain <target>` (open the frontend by default; `--no-open` to skip). Set `GITHUB_TOKEN`/`GH_TOKEN` to raise the GitHub API rate limit (60→5000/hr).

## ⚠ Conventions & gotchas (read before editing)

- **Node 22** is pinned (`.nvmrc`, `engines: >=22 <23`). Native `tree-sitter` historically failed to build on Node 24; it currently loads here, but keep the pin.
- **`client.ts` is a browser app emitted as a JS string inside a TS template literal.** Therefore inside `CLIENT_SCRIPT` you must use **NO backticks and NO `${...}`** — build strings with `'+'` concatenation only. `index.ts` injects `const DATA = …` and `const INITIAL_VIEW = …` *before* the script; the script also reads `location.hash` to deep-link views.
- The HTML is **one self-contained file**. Only external dep is Three.js via the CDN import map. Keep it dependency-free and openable from `file://`.
- TypeScript is **strict + `exactOptionalPropertyTypes`** — never pass `undefined` to an optional prop; spread it conditionally (`...(x ? { k: x } : {})`).
- **NodeNext modules** — import with explicit `.js` specifiers even from `.ts` files.
- The **5 views**: `globe` (sphere surface) · `flat` (2D SVG "Map") · `web` (3D force-directed spider web) · `brain` (neural hemispheres) · `roadmap` (skill tree, progress saved to `localStorage`). Globe/web/brain share the Three.js scene and swap layouts via `applyLayout()`.
- The roadmap is **deterministic** (no network/LLM): `roadmap/roadmap.ts` maps detected tech (by exact detector name) + graph shape into stages. Keep `TECH_KB` aligned with `detectors/detector.ts` signature names.
- Generated `repograph-*.{html,json,md}` are **git-ignored**; don't commit them.

## Testing

- Vitest per package (`packages/core/vitest.config.ts` node env; `apps/cli/vitest.config.ts` jsdom env).
- Engine tests construct `RawFile[]`/`ParsedFile[]` and assert graph/roadmap/exporter behavior; `scan.test.ts` runs end-to-end on temp fixtures.
- `apps/cli/src/ui/html/render.test.ts` boots the **real client script** in jsdom against a tiny THREE stub and drives all 5 views + roadmap progress — this is how we verify the frontend without a browser.

## Where to look next

- [.claude/context/architecture.md](.claude/context/architecture.md) — full engine + frontend internals.
- [.claude/context/status.md](.claude/context/status.md) — what's done / what's left.
- [.claude/context/decisions.md](.claude/context/decisions.md) — design rationale for the new features.
- [PUBLISHING.md](PUBLISHING.md) — GitHub + npm release guide.
- [RepoGraph_TechDoc.md](RepoGraph_TechDoc.md) — original technical specification.
