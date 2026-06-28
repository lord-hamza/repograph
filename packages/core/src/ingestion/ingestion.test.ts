import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { detectLanguage, isExcludedPath } from "./types.js";
import { isGitHubUrl, parseGitHubUrl } from "./github.js";
import { ingestLocal } from "./local.js";

describe("detectLanguage", () => {
  it("maps extensions to languages", () => {
    expect(detectLanguage("a.py")).toBe("python");
    expect(detectLanguage("a.ts")).toBe("typescript");
    expect(detectLanguage("a.tsx")).toBe("typescript");
    expect(detectLanguage("a.mts")).toBe("typescript");
    expect(detectLanguage("a.js")).toBe("javascript");
    expect(detectLanguage("a.mjs")).toBe("javascript");
    expect(detectLanguage("README.md")).toBe("unknown");
    expect(detectLanguage("Makefile")).toBe("unknown");
  });
  it("is case-insensitive", () => {
    expect(detectLanguage("A.TS")).toBe("typescript");
  });
});

describe("isExcludedPath", () => {
  it("excludes vendored and build dirs", () => {
    expect(isExcludedPath("node_modules/x/index.js")).toBe(true);
    expect(isExcludedPath("dist/index.js")).toBe(true);
    expect(isExcludedPath(".git/config")).toBe(true);
    expect(isExcludedPath("a/__pycache__/x.py")).toBe(true);
  });
  it("excludes secrets and lock/min/map files", () => {
    expect(isExcludedPath(".env")).toBe(true);
    expect(isExcludedPath("config/.env.local")).toBe(true);
    expect(isExcludedPath(".env.production")).toBe(true);
    expect(isExcludedPath("certs/server.pem")).toBe(true);
    expect(isExcludedPath("private.key")).toBe(true);
    expect(isExcludedPath("app.min.js")).toBe(true);
    expect(isExcludedPath("pnpm-lock.yaml".replace(".yaml", ".lock"))).toBe(true);
  });
  it("excludes empty paths and keeps real source", () => {
    expect(isExcludedPath("")).toBe(true);
    expect(isExcludedPath("src/app.ts")).toBe(false);
    expect(isExcludedPath("main.py")).toBe(false);
    expect(isExcludedPath("environment.ts")).toBe(false); // not a .env file
  });
});

describe("parseGitHubUrl / isGitHubUrl", () => {
  it("recognizes https and ssh forms", () => {
    expect(isGitHubUrl("https://github.com/a/b")).toBe(true);
    expect(isGitHubUrl("git@github.com:a/b.git")).toBe(true);
    expect(isGitHubUrl("./local")).toBe(false);
    expect(isGitHubUrl("/abs/path")).toBe(false);
  });
  it("parses owner/repo from https, stripping .git and query/hash", () => {
    expect(parseGitHubUrl("https://github.com/expressjs/express")).toEqual({ owner: "expressjs", repo: "express" });
    expect(parseGitHubUrl("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGitHubUrl("https://github.com/a/b?tab=readme")).toEqual({ owner: "a", repo: "b" });
  });
  it("parses ssh form", () => {
    expect(parseGitHubUrl("git@github.com:a/b.git")).toEqual({ owner: "a", repo: "b" });
  });
  it("throws on non-GitHub URLs", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/a/b")).toThrow();
  });
});

describe("ingestLocal", () => {
  const tmpDirs: string[] = [];
  async function makeFixture(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repograph-test-"));
    tmpDirs.push(dir);
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.mkdir(path.join(dir, "node_modules", "dep"), { recursive: true });
    await fs.writeFile(path.join(dir, "src", "app.ts"), "export const x = 1;\n");
    await fs.writeFile(path.join(dir, "main.py"), "def f():\n    return 1\n");
    await fs.writeFile(path.join(dir, ".env"), "SECRET=shhh\n");
    await fs.writeFile(path.join(dir, "node_modules", "dep", "index.js"), "module.exports = 1;\n");
    await fs.writeFile(path.join(dir, "logo.bin"), Buffer.from([0, 1, 2, 0, 255]));
    return dir;
  }

  afterAll(async () => {
    await Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  it("walks the tree, excludes secrets/vendored/binaries", async () => {
    const dir = await makeFixture();
    const files = await ingestLocal(dir);
    const paths = files.map((f) => f.path).sort();
    expect(paths).toContain("src/app.ts");
    expect(paths).toContain("main.py");
    expect(paths).not.toContain(".env");
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
    expect(paths).not.toContain("logo.bin");
  });

  it("throws a clear error for a missing path", async () => {
    await expect(ingestLocal(path.join(os.tmpdir(), "definitely-not-here-xyz123"))).rejects.toThrow(
      /does not exist/i,
    );
  });

  it("returns an empty array for an empty directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repograph-empty-"));
    tmpDirs.push(dir);
    expect(await ingestLocal(dir)).toEqual([]);
  });
});
