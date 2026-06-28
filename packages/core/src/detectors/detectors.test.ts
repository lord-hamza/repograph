import { describe, expect, it } from "vitest";
import { buildGraph } from "../graph/builder.js";
import type { RawFile } from "../ingestion/types.js";
import type { ImportStatement, ParsedFile } from "../parsers/types.js";
import { detectTechStack } from "./detector.js";

function imp(source: string): ImportStatement {
  return { source, imported: [], kind: "static" };
}
function pf(path: string, imports: ImportStatement[] = []): ParsedFile {
  return { path, language: "typescript", imports, exports: [], functions: [], classes: [] };
}
function rf(path: string, content: string): RawFile {
  return { path, content, language: path.endsWith(".json") ? "unknown" : "typescript", size: content.length };
}

describe("detectTechStack", () => {
  const pkg = JSON.stringify({
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vitest: "^1.0.0", typescript: "^5.0.0" },
  });
  const raws: RawFile[] = [
    rf("package.json", pkg),
    rf("tsconfig.json", '{"compilerOptions":{}}'),
    rf("src/App.tsx", 'import React from "react";'),
  ];
  const parsed: ParsedFile[] = [pf("src/App.tsx", [imp("react")])];
  const graph = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/x" } });
  const tech = detectTechStack(graph, raws, parsed);
  const names = tech.map((t) => t.name);

  it("detects framework from deps + imports", () => {
    expect(names).toContain("React");
    const react = tech.find((t) => t.name === "React")!;
    expect(react.category).toBe("framework");
    expect(react.confidence).toBeGreaterThanOrEqual(0.5);
    expect(react.version).toBe("^18.2.0");
  });

  it("detects TypeScript from tsconfig and Vitest from deps", () => {
    expect(names).toContain("TypeScript");
    expect(names).toContain("Vitest");
  });

  it("excludes a tech that is only imported once with no dependency", () => {
    const p2 = [pf("s.ts", [imp("express")])];
    const r2 = [rf("s.ts", 'import express from "express";')];
    const g2 = buildGraph(p2, r2, { metadata: { source: "local", target: "/tmp/y" } });
    const t2 = detectTechStack(g2, r2, p2).map((t) => t.name);
    expect(t2).not.toContain("Express");
  });

  it("detects Python deps from requirements.txt", () => {
    const r = [rf("requirements.txt", "fastapi==0.110.0\nsqlalchemy>=2.0\n")];
    const g = buildGraph([], r, { metadata: { source: "local", target: "/tmp/z" } });
    const t = detectTechStack(g, r, []).map((x) => x.name);
    expect(t).toContain("FastAPI");
    expect(t).toContain("SQLAlchemy");
  });

  it("returns an empty list for a repo with no recognizable tech", () => {
    const r = [rf("notes.txt", "hello")];
    const g = buildGraph([], r, { metadata: { source: "local", target: "/tmp/none" } });
    expect(detectTechStack(g, r, [])).toEqual([]);
  });
});
