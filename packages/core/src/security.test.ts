import { describe, expect, it } from "vitest";
import { detectTechStack } from "./detectors/detector.js";
import { exportGraphMarkdown } from "./exporters/markdown.js";
import { buildGraph } from "./graph/builder.js";
import type { RepoGraph } from "./graph/types.js";
import { parseGitHubUrl } from "./ingestion/github.js";
import type { RawFile } from "./ingestion/types.js";

function rf(path: string, content: string): RawFile {
  return { path, content, language: "unknown", size: content.length };
}
function minimalGraph(nodes: RepoGraph["nodes"]): RepoGraph {
  return {
    metadata: { scannedAt: "x", fileCount: nodes.length, source: "local", target: "/t" },
    nodes,
    edges: [],
    entryPoints: [],
    orphanFiles: [],
    languageStats: { typescript: 0, javascript: 0, python: 0, unknown: 0 },
    circularDependencies: [],
    externalImports: {},
  };
}

describe("SSRF — GitHub URL parsing rejects traversal / bad input", () => {
  const bad = [
    "https://github.com/../admin/x",
    "https://github.com/o/..",
    "git@github.com:o/../../etc/passwd.git",
    "https://github.com/owner/re po", // space
    "https://github.com/owner/re;po", // semicolon
  ];
  for (const u of bad) {
    it(`rejects ${u}`, () => {
      expect(() => parseGitHubUrl(u)).toThrow();
    });
  }
  it("accepts legitimate owner/repo names", () => {
    expect(parseGitHubUrl("https://github.com/good-owner/good.repo_name")).toEqual({
      owner: "good-owner",
      repo: "good.repo_name",
    });
  });
});

describe("Prototype pollution resistance", () => {
  it("a dependency named __proto__ does not pollute Object.prototype", () => {
    const pkg = JSON.stringify({ dependencies: { __proto__: { polluted: "yes" }, react: "^18.0.0" } });
    const raws = [rf("package.json", pkg)];
    const graph = buildGraph([], raws, { metadata: { source: "local", target: "/t" } });
    expect(() => detectTechStack(graph, raws, [])).not.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("file paths named __proto__/constructor do not pollute the directory tree", () => {
    const nodes: RepoGraph["nodes"] = [
      { id: "file:__proto__/evil.ts", type: "file", label: "evil.ts", filePath: "__proto__/evil.ts", inDegree: 0, outDegree: 0 },
      { id: "file:constructor/x.ts", type: "file", label: "x.ts", filePath: "constructor/x.ts", inDegree: 0, outDegree: 0 },
    ];
    const md = exportGraphMarkdown(minimalGraph(nodes), []);
    expect(md).toContain("Directory Structure");
    expect(({} as Record<string, unknown>).evil).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, "evil")).toBe(false);
  });
});
