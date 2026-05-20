# @repograph/core

The engine behind [RepoGraph](https://github.com/lord-hamza/repograph). A TypeScript library that ingests a repository, parses its source files, builds a normalized dependency graph, detects the tech stack, and exports both a graph JSON and an MCP-ready Markdown context file.

No UI dependencies. Used by the [`@repograph/cli`](https://www.npmjs.com/package/@repograph/cli) and future web / GitHub Action surfaces.

## Install

```bash
npm install @repograph/core
# or
pnpm add @repograph/core
```

Requires Node 22+. (`tree-sitter` native bindings do not currently compile against Node 24.)

## Quick start

```ts
import { scan } from "@repograph/core";

const result = await scan(".");
// result.graph         → RepoGraph
// result.techStack     → TechStackEntry[]
// result.rawFiles      → RawFile[]
// result.parsedFiles   → ParsedFile[]
// result.toJson()      → string (D3-friendly graph JSON)
// result.toMarkdown()  → string (MCP context document)
```

`scan(target)` accepts a local directory path or a GitHub URL (HTTPS or SSH).

## Modules

| Module | Exports |
| --- | --- |
| `ingestion/` | `ingest()`, `ingestGitHub()`, `ingestLocal()`, `RawFile`, `Language` |
| `parsers/` | `parse()`, `parsePython()`, `parseTypeScript()`, `ParsedFile`, `FunctionDef`, `ClassDef`, `ImportStatement` |
| `graph/` | `buildGraph()`, `resolveImports()`, `readTsconfigPaths()`, `RepoGraph`, `GraphNode`, `GraphEdge` |
| `detectors/` | `detectTechStack()`, `TechStackEntry`, `TechCategory` |
| `exporters/` | `exportGraphJson()`, `exportGraphMarkdown()`, `ExportOptions` |

All public types are re-exported from the package root.

## Lower-level usage

If you want to compose the pipeline yourself instead of calling `scan()`:

```ts
import {
  ingest,
  parse,
  buildGraph,
  detectTechStack,
  exportGraphJson,
  exportGraphMarkdown,
} from "@repograph/core";

const raw = await ingest("./my-project");
const parsed = raw.map(parse);
const graph = buildGraph(parsed, raw, {
  metadata: { source: "local", target: "./my-project" },
});
const stack = detectTechStack(graph, raw, parsed);

const jsonStr = exportGraphJson(graph, stack);
const mdStr = exportGraphMarkdown(graph, stack);
```

## What it parses

- **Python** — `import x`, `from m import a, b`, `from .relative import c`, decorated functions, class methods, superclasses. Via `tree-sitter-python`.
- **TypeScript / TSX / MTS / CTS** — static imports, dynamic `import()`, `import = require()`, `export` declarations, function declarations, arrow function assignments, class declarations with heritage clauses. Via the TypeScript Compiler API.
- **JavaScript / JSX / MJS / CJS** — same as TypeScript path.

Import resolution handles relative paths, `index.{ts,tsx,js,jsx,py}` files, Python `__init__.py`, NodeNext `.js`→`.ts` rewrites, and `tsconfig.json` `paths` / `baseUrl` aliases.

## Detectors

37 built-in tech signatures with three-layer detection (manifest dependencies + import frequency + config-file presence). Frameworks, ORMs, databases, auth, testing, build tools, styling, and selected libraries. Confidence threshold 0.5; co-occurrence pass populates `interactsWith` for techs appearing together in ≥ 2 files.

## License

MIT
