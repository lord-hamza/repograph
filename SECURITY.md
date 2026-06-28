# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, report privately:

- Use **GitHub → Security → "Report a vulnerability"** (private advisory) on `lord-hamza/repograph`, or
- email the maintainer listed on the npm package.

We aim to acknowledge within 72 hours and to ship a fix or mitigation promptly. Please include reproduction steps and the affected version.

## Supported versions

The latest published `@repograph/cli` / `@repograph/core` on npm receives security fixes.

## Threat model

RepoGraph is a local CLI that ingests **untrusted repositories** (local paths or public GitHub repos) and produces an interactive HTML page, a JSON graph, and a Markdown context file. The main risks and how they're handled:

| Risk | Mitigation |
| --- | --- |
| **XSS in the generated HTML** (file names, descriptions, tech versions, repo names are attacker-controlled) | All untrusted data is HTML/attribute-escaped (`escapeHtml`/`escapeAttr`) before reaching the DOM. The embedded JSON is `</script`-neutralized. A **Content-Security-Policy with a per-file nonce** gates inline scripts, so an injected `<script>` cannot run even if escaping is bypassed. `default-src 'none'`, `connect-src 'none'`, `base-uri 'none'`. |
| **`javascript:`/`data:` URL injection** via links | Doc links are validated to `https?://` only and carry `rel="noopener noreferrer"`. |
| **SSRF / API path traversal** via crafted GitHub URLs | `owner`/`repo` are validated against a strict charset (`..`, `/`, and odd characters rejected) and URL-encoded in every api.github.com request. Requests only ever go to `api.github.com`. |
| **Secret leakage** | `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx` are excluded from ingestion. Outputs contain **structure only** (paths, symbol names, import edges) — never file contents. `GITHUB_TOKEN`/`GH_TOKEN` is sent only as an `Authorization` header to GitHub and is never logged or written to output. Error bodies are truncated. The generated page sets `referrer: no-referrer`. |
| **Prototype pollution** | Maps keyed by untrusted strings (dependency names, file-path segments such as `__proto__`/`constructor`) use null-prototype objects. |
| **ReDoS / resource exhaustion** | File size is capped (1 MB), binaries are skipped, and parsing/regex inputs are bounded. The 3D layout falls back to a cheap deterministic layout above ~900 nodes. |
| **Supply chain** | Three.js is loaded from a **pinned** CDN version with **Subresource Integrity (SRI)** hashes in the import map (enforced on supporting browsers), and is the only external runtime dependency of the generated page; CSP additionally restricts script origins to that CDN plus the nonce. Production dependencies are audited in CI. |

### Accepted / out-of-scope by design

- **`--output <dir>`** writes the three generated files to an operator-chosen directory. This path comes only from the CLI flag the user types (never from the scanned repo or any remote input), so it is operator-controlled, not attacker-controlled — choosing an output directory is the intended behaviour. The output **filenames** are fixed and never derived from repository content, so a malicious repo cannot redirect writes.
- **Dev-toolchain advisories** in transitive dev dependencies (e.g. eslint → js-yaml) do not ship in the published packages; see "Dependency audits" above.

## No telemetry

RepoGraph makes **no** network calls except to `api.github.com` (only when you scan a GitHub URL). It collects and transmits no analytics.

## Dependency audits

CI runs `pnpm audit --prod --audit-level high` as a **blocking** gate — the published dependency tree must be free of known vulnerabilities. A full audit (including the dev toolchain) runs as an **informational** step; dev-only transitive advisories that never ship in the package (e.g. an eslint→js-yaml advisory) are tracked but not release-blocking.
