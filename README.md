# RepoGraph

Turn any repository into an **interactive dependency graph** and a **structured MCP context file** — one CLI command, three output files, zero config.

RepoGraph parses your codebase, resolves every import, builds a node-and-edge graph of files / functions / classes, detects the tech stack, and emits:

| Output | Purpose |
| --- | --- |
| `repograph-graph.html` | Self-contained D3 visualization — interactive, hoverable, multicolor. Open it in any browser. |
| `repograph-graph.json` | Raw graph data (D3-friendly `nodes` + `links`). Drop into your own tooling. |
| `repograph-context.md` | MCP-compatible structural summary for AI assistants (Claude Code, Cursor, Continue, or any MCP client). |

```bash
npx @repograph/cli pull .
npx @repograph/cli pull https://github.com/expressjs/express
npx @repograph/cli pull . --open
```

---

## Why

Large codebases are opaque by default. A new contributor — human or AI — has no idea what depends on what. RepoGraph makes the structure visible in seconds:

- **For developers:** see entry points, find the most-imported files (your "load-bearing" code), spot circular dependencies and orphans.
- **For AI coding assistants:** the MCP context file gives the model a complete architectural map before it reads a single source line. Better refactors, more accurate impact analysis, less wandering.
- **For code review:** see exactly what changes when a PR adds or removes an import edge.

---

## What's in this repo

It's a pnpm + Turborepo monorepo with two packages:

```
repograph/
├── packages/
│   └── core/           @repograph/core — engine: ingest, parse, graph, detect, export
└── apps/
    └── cli/            @repograph/cli — `repograph` binary on top of the engine
```

The engine has no UI dependencies. The CLI is a thin shell around `scan()`. The same engine will back the future web platform and GitHub Action.

### Engine layout — `packages/core/src/`

| Module | What it does |
| --- | --- |
| `ingestion/` | Two input modes: GitHub URL (REST `git/trees?recursive=1` + batched blob fetches) and local filesystem (recursive walk, skips symlinks + binaries). Normalizes both to `RawFile[]`. |
| `parsers/` | Python via `tree-sitter` + `tree-sitter-python`. TypeScript / JavaScript / TSX / JSX via the TypeScript Compiler API. Routes by file extension; unknown languages produce empty parses. |
| `graph/` | Resolves relative paths, tsconfig `paths`/`baseUrl` aliases, NodeNext `.js`→`.ts` rewrites, Python dotted modules and relative `from .x` imports. Builds a graphology multigraph, computes in/out degrees, finds entry points + orphans, runs Tarjan's SCC for cycle detection. |
| `detectors/` | 37 known tech signatures (React, Next, Express, NestJS, FastAPI, Django, Flask, Prisma, Drizzle, Mongoose, SQLAlchemy, Postgres, Redis, Mongo, Clerk, NextAuth, Jest, Vitest, Pytest, Playwright, Webpack, Vite, Tailwind, TypeScript, D3, BullMQ, …). Combines `package.json` / `requirements.txt` / `pyproject.toml` deps + import frequency + config-file presence. Computes a confidence score; cuts off at 0.5. |
| `exporters/` | JSON exporter emits D3-shaped `{ nodes, links }`. Markdown exporter emits an MCP-ready context document: scan metadata → architecture → directory tree → tech stack table → module map → top-10 most-imported → circular dependencies. |
| `scan.ts` | Single high-level `scan(target)` that runs the whole pipeline. Returns `{ graph, techStack, rawFiles, parsedFiles, toJson(), toMarkdown() }`. |

### CLI — `apps/cli/src/`

| Module | What it does |
| --- | --- |
| `commands/pull.ts` | `repograph pull <target>` — the only command. Validates target, runs `scan()`, hands off to UI. |
| `commands/options.ts` | `--output <dir>`, `--format json\|md\|both`, `--open`, `-v/--verbose`. |
| `ui/stats.ts` | `cli-table3` + `chalk` terminal stats: summary, language breakdown, tech list, top-imported files, circular dependencies. Color-coded green / yellow / red. |
| `ui/output.ts` | Writes the three output files. Optionally opens the HTML in your browser via `open`. |
| `ui/html.ts` | The self-contained D3 v7 page. Force-directed simulation, hover-to-focus, click-to-pin, drag, zoom, multicolor by module or by type, live search filter. |

---

## Install

Requires **Node 22**. (Node 24 currently fails to compile the native `tree-sitter` binding — see `.nvmrc` and `engines` in `package.json`.)

```bash
# Once published
npm i -g @repograph/cli
repograph pull .

# Or zero-install
npx @repograph/cli pull <target>
```

### From source (this repo)

```bash
git clone https://github.com/lord-hamza/repograph.git
cd repograph
nvm use            # respects .nvmrc → Node 22
pnpm install
pnpm build
node apps/cli/dist/index.js pull .
```

---

## Usage

```
repograph pull <target> [options]

Targets
  .                               current directory
  /absolute/or/relative/path      a local directory
  https://github.com/owner/repo   any public GitHub repo (HTTPS)
  git@github.com:owner/repo.git   any public GitHub repo (SSH)

Options
  -o, --output <dir>     Output directory (default: cwd)
  -f, --format <fmt>     json | md | both (default: both)
      --open             Open the HTML graph in the default browser
  -v, --verbose          Verbose error logging
```

Set `GITHUB_TOKEN` (or `GH_TOKEN`) in your environment to lift the unauthenticated GitHub API rate limit (60/hr → 5000/hr).

---

## Loading the MCP context into AI tools

The generated `repograph-context.md` is a plain Markdown file with a stable, dense structure. Load it as project context in any MCP-aware client:

- **Claude Code:** `claude /add-dir ./repograph-context.md`
- **Cursor:** add the file to your project's context resources
- **Continue / Aider / Cody / others:** include via system prompt or MCP server config

The file is human-readable; you can also just paste it into a chat if your client doesn't support MCP yet.

---

## Tech stack

- **TypeScript 5.7** (strict, NodeNext modules, project references via `composite: true`)
- **tree-sitter** + **tree-sitter-python** — Python parsing
- **TypeScript Compiler API** — JS/TS/JSX/TSX parsing
- **graphology** — graph data structure + algorithms
- **D3 v7** — graph visualization (CDN, no bundle bloat)
- **commander · ora · chalk · cli-table3 · open** — CLI shell
- **Turborepo · pnpm** — monorepo orchestration

---

## Roadmap

- [x] Engine + CLI (this milestone)
- [ ] Web platform (`repograph.com/[owner]/[repo]`) — same engine behind Next.js
- [ ] BullMQ async worker for large remote scans
- [ ] GitHub Action — auto-generate the graph on every push
- [ ] More language parsers (Go, Rust, Ruby, Java)
- [ ] `--watch` mode for local dev
- [ ] `--diff <sha>` to show dependency changes between commits

---

## License

MIT
