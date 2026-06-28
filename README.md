# RepoGraph

Turn any repository into an **interactive code atlas**, a **learning roadmap**, and a **structured MCP context file** — one CLI command, zero config.

RepoGraph parses your codebase, resolves every import, builds a node-and-edge graph of files / functions / classes, detects the tech stack, derives a "how to learn to build this" roadmap, and emits three outputs:

| Output | Purpose |
| --- | --- |
| `repograph-graph.html` | Self-contained interactive page with **five views** — Globe, Map, Web, Brain, Roadmap. Opens in any browser, no server. |
| `repograph-graph.json` | Raw graph data: D3-friendly `{ metadata, nodes, links }` (the roadmap is embedded in `metadata.roadmap`). |
| `repograph-context.md` | MCP-compatible structural summary for AI assistants (Claude Code, Cursor, Continue, or any MCP client), including a Learning Roadmap section. |

```bash
npm i -g @repograph/cli

repograph pull .                                   # scan the current repo
repograph pull https://github.com/expressjs/express
repograph pull . --open                            # open the interactive graph
repograph roadmap .                                # open the Learning Roadmap
repograph brain .                                  # open the 3D Brain view
```

> No install? Use `npx @repograph/cli pull <target>`.

---

## The five views

Open `repograph-graph.html` and switch views from the toggle at the top:

| View | What it shows |
| --- | --- |
| 🌐 **Globe** | Nodes pinned to a wireframe sphere, clustered by module. Best for an at-a-glance overview. |
| ▦ **Map** | A flat 2D layout (pan + zoom) with modules arranged in a ring. Best for precise navigation. |
| 🕸 **Web** | A 3D force-directed "spider web" — hubs pulled to the center, leaves to the rim, edges as threads. Best for seeing real coupling. |
| 🧠 **Brain** | The repo as a neural network: modules split into two glowing hemispheres with synapse-like links. |
| 🗺 **Roadmap** | An interactive skill tree: *what to learn, in order, to build something like this repo* — with progress saved in your browser. |

Every graph view supports hover-to-preview, click-to-open a detail panel (with cascade navigation through imports/importers), live search, drag to rotate/pan, and scroll to zoom.

---

## Why

Large codebases are opaque by default. RepoGraph makes the structure visible in seconds:

- **For developers** — see entry points, the most-imported "load-bearing" files, circular dependencies, and orphans.
- **For learners** — the Roadmap turns a repo into a personalized syllabus: language → tooling → frameworks → data → testing → architecture → shipping, each step linked to canonical docs and explained *for this repo*.
- **For AI coding assistants** — the MCP context file hands the model a complete architectural map (now including the roadmap) before it reads a single source line.

---

## Commands

```
repograph <command> <target> [options]

Targets
  .                               current directory
  /absolute/or/relative/path      a local directory
  https://github.com/owner/repo   any public GitHub repo (HTTPS)
  git@github.com:owner/repo.git   any public GitHub repo (SSH)

Commands
  pull <target>          Scan and write graph + JSON + MCP outputs.
  roadmap <target>       Scan and open the interactive Learning Roadmap (alias: learn).
  brain <target>         Scan and open the 3D Brain view.

Options
  -o, --output <dir>     Output directory (default: current directory)
  -f, --format <fmt>     json | md | both (default: both)
      --open             (pull) open the HTML graph in the browser
      --no-open          (roadmap/brain) write files without opening the browser
  -v, --verbose          Verbose error logging
  -V, --version          Print version
  -h, --help             Show help
```

`roadmap`, `learn`, and `brain` open the browser by default, deep-linked to the right tab (the HTML reads `#roadmap` / `#brain` / `#web` from the URL).

Set `GITHUB_TOKEN` (or `GH_TOKEN`) to lift the unauthenticated GitHub API rate limit (60/hr → 5000/hr) and to scan private repos you can access.

---

## Loading the MCP context into AI tools

`repograph-context.md` is plain Markdown with a stable, dense structure. Load it as project context:

- **Claude Code:** `claude /add-dir ./repograph-context.md`
- **Cursor:** add the file to your project's context resources
- **Continue / Aider / Cody / others:** include via system prompt or MCP server config

It's human-readable too — you can paste it into any chat.

---

## Install

Requires **Node 22** (see `.nvmrc` / `engines`).

```bash
# Global
npm i -g @repograph/cli
repograph pull .

# Zero-install
npx @repograph/cli pull <target>
```

### From source

```bash
git clone https://github.com/lord-hamza/repograph.git
cd repograph
nvm use            # → Node 22
pnpm install
pnpm build
node apps/cli/dist/index.js pull .
```

---

## How it works

A pnpm + Turborepo monorepo with two packages:

```
repograph/
├── packages/core/   @repograph/core — engine: ingest → parse → graph → detect → roadmap → export
└── apps/cli/        @repograph/cli  — the `repograph` binary on top of the engine
```

| Layer | What it does |
| --- | --- |
| `ingestion/` | GitHub REST (`git/trees?recursive=1` + batched blobs) or local FS walk → `RawFile[]`. Skips vendored dirs, binaries, large files, and secrets (`.env*`, keys). |
| `parsers/` | TypeScript/JS/TSX/JSX via the TypeScript Compiler API; Python via `tree-sitter`. |
| `graph/` | Resolves relative paths, tsconfig aliases, NodeNext `.js`→`.ts`, Python dotted imports. Builds a graphology multigraph; finds entry points, orphans, and cycles (Tarjan SCC). |
| `detectors/` | ~37 tech signatures (React, Next, Express, FastAPI, Prisma, Drizzle, Vitest, …) from deps + imports + config files, with a confidence score. |
| `roadmap/` | Deterministic learning roadmap from the detected stack + graph shape — no network, no LLM. |
| `exporters/` | D3-shaped JSON + MCP-ready Markdown. |
| `ui/html/` | The self-contained five-view page (Three.js via CDN import map). |

---

## Development

```bash
pnpm build        # tsc per package (turbo)
pnpm test         # vitest per package (turbo)
pnpm typecheck
pnpm lint
pnpm format
```

Tests cover the engine end-to-end plus a headless DOM smoke test that boots the real browser app across all five views.

---

## Tech stack

- **TypeScript 5.7** (strict, NodeNext, project references)
- **tree-sitter** + **tree-sitter-python** — Python parsing
- **TypeScript Compiler API** — JS/TS/JSX/TSX parsing
- **graphology** — graph data structure + algorithms
- **Three.js** — 3D Globe / Web / Brain rendering (CDN, no bundle)
- **commander · ora · chalk · cli-table3 · open** — CLI
- **Turborepo · pnpm · Vitest** — monorepo + tests

---

## Project roadmap

- [x] Engine + CLI
- [x] Interactive HTML — Globe, Map, **Web**, **Brain**
- [x] Learning **Roadmap** (deterministic, terminal-accessible)
- [ ] More language parsers (Go, Rust, Ruby, Java)
- [ ] `--watch` (local) and `--diff <sha>` (dependency changes between commits)
- [ ] Optional `--ai` roadmap enrichment
- [ ] Web platform + GitHub Action

See [PUBLISHING.md](PUBLISHING.md) to publish to GitHub + npm.

---

## License

MIT
