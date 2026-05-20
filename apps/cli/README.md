# @repograph/cli

Command-line interface for [RepoGraph](https://github.com/lord-hamza/repograph). Scan any repo, get an interactive dependency graph and an MCP context file for AI assistants — in one command.

## Install

```bash
# Zero-install
npx @repograph/cli pull <target>

# Or globally
npm i -g @repograph/cli
repograph pull <target>
```

Requires Node 22+.

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
  -V, --version          Print version
  -h, --help             Show help
```

## Output

Three files are written to the output directory:

| File | What |
| --- | --- |
| `repograph-graph.html` | Self-contained D3 visualization — open in any browser. Hoverable, multicolor by module, search filter, click-to-pin, drag, zoom. |
| `repograph-graph.json` | Raw graph: `{ nodes, links, metadata }`, D3-shaped. |
| `repograph-context.md` | MCP-compatible Markdown summary for AI assistants. |

The HTML file is shareable — it embeds the data inline and only fetches D3 from a CDN. Drag-and-drop it into a browser anywhere.

## Examples

```bash
# Current directory
repograph pull .

# Local path
repograph pull /path/to/project

# Public GitHub repo
repograph pull https://github.com/expressjs/express

# Only the MCP file, into a docs/ folder
repograph pull . --format md --output docs/

# Scan and immediately open the graph
repograph pull . --open
```

For GitHub URLs, set `GITHUB_TOKEN` (or `GH_TOKEN`) in your environment to lift the unauthenticated API rate limit from 60/hr to 5000/hr:

```bash
GITHUB_TOKEN=ghp_xxx repograph pull https://github.com/facebook/react
```

## Loading the MCP context into AI tools

- **Claude Code:** `claude /add-dir ./repograph-context.md`
- **Cursor / Continue / any MCP client:** add the file as a project context resource
- **Anything else:** paste the file contents into your assistant's system prompt

The file is plain Markdown — human readable too.

## License

MIT
