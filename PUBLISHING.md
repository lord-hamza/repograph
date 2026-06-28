# Publishing RepoGraph to GitHub + npm

A step-by-step guide to make this repo public on GitHub and publish the CLI to npm so anyone can run `npm i -g @repograph/cli` and use `repograph pull <repo>`.

> You run the `git push` / `npm publish` steps with your own credentials. Everything else (metadata, build, tests) is already prepared.

---

## 0. Pre-flight (must pass)

```bash
nvm use                 # Node 22
pnpm install
pnpm build
pnpm typecheck
pnpm test               # 60 tests should pass
```

If all green, you're ready.

---

## 1. Clean up generated artifacts (one-time)

The generated outputs are now git-ignored, but older copies may still be **tracked** from before. Stop tracking them so they don't ship in the repo:

```bash
git rm --cached repograph-graph.html repograph-graph.json repograph-context.md 2>/dev/null || true
git status   # confirm they're staged for removal and ignored going forward
```

(They're regenerated any time someone runs `repograph pull .`.)

---

## 2. Publish to GitHub

### If the repo doesn't exist yet

Using the GitHub CLI (`gh`):

```bash
git add -A
git commit -m "feat: brain + roadmap + 3D web view, hardening, tests, docs"

gh repo create lord-hamza/repograph --public --source=. --remote=origin --push
```

Or manually:

```bash
# create an empty public repo named "repograph" on github.com first, then:
git remote add origin https://github.com/lord-hamza/repograph.git   # skip if origin exists
git add -A
git commit -m "feat: brain + roadmap + 3D web view, hardening, tests, docs"
git branch -M main
git push -u origin main
```

### If it already exists

```bash
git add -A
git commit -m "feat: brain + roadmap + 3D web view, hardening, tests, docs"
git push
```

### Make an existing repo public

`gh repo edit lord-hamza/repograph --visibility public` — or **Settings → General → Danger Zone → Change visibility** on github.com.

### Tag a release (optional but recommended)

```bash
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --generate-notes
```

---

## 3. Publish to npm

The CLI (`@repograph/cli`) depends on the engine (`@repograph/core`). Both are scoped and already set `publishConfig.access: public`. The root package is `private`, so it is never published.

### One-time setup

1. Create a free npm account at https://www.npmjs.com and verify your email.
2. The packages use the **`@repograph` scope**. Either:
   - create an npm organization named `repograph` (npmjs.com → *Add Organization*, free for public packages), **or**
   - rename the scope to one you own — edit the `name` field in `packages/core/package.json` and `apps/cli/package.json` (and the `@repograph/core` dependency in the CLI) to e.g. `@yourname/core` and `@yourname/cli`.
3. Log in:

```bash
npm login          # or: npm login --scope=@repograph
```

### Publish (pnpm handles the workspace dependency)

`pnpm` rewrites the CLI's `"@repograph/core": "workspace:*"` to the real version automatically at publish time. Publish **core first**, then the CLI:

```bash
# from the repo root
pnpm --filter @repograph/core publish --access public --no-git-checks
pnpm --filter @repograph/cli  publish --access public --no-git-checks
```

`prepublishOnly` runs a clean build before each publish. (Drop `--no-git-checks` if you want pnpm to require a clean, tagged git state.)

> Bumping versions: edit the `version` field in each package's `package.json` (e.g. `0.2.0`) before publishing, or use `pnpm --filter <pkg> version patch|minor|major`. npm refuses to republish an existing version.

### Verify the published package

```bash
npx @repograph/cli@latest pull .
# or
npm i -g @repograph/cli && repograph pull https://github.com/expressjs/express
```

---

## 4. After publishing

Add install/usage badges or update the README install line if you changed the scope. Optionally wire a GitHub Action to run `pnpm test` on every push and `pnpm publish` on tags.

That's it — anyone can now:

```bash
npm i -g @repograph/cli
repograph pull https://github.com/owner/repo
repograph roadmap .
repograph brain .
```
