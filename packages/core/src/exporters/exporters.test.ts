import { describe, expect, it } from "vitest";
import { buildGraph } from "../graph/builder.js";
import type { RawFile } from "../ingestion/types.js";
import type { ImportStatement, ParsedFile } from "../parsers/types.js";
import { buildRoadmap } from "../roadmap/roadmap.js";
import { exportGraphJson } from "./json.js";
import { exportGraphMarkdown } from "./markdown.js";

function imp(source: string): ImportStatement {
  return { source, imported: [], kind: "static" };
}
function pf(path: string, imports: ImportStatement[] = []): ParsedFile {
  return { path, language: "typescript", imports, exports: [], functions: [], classes: [] };
}
function rf(path: string, content: string): RawFile {
  return { path, content, language: "typescript", size: content.length };
}

const parsed = [pf("a.ts", [imp("./b")]), pf("b.ts")];
const raws = [rf("a.ts", "import './b'"), rf("b.ts", "export const b=1")];
const graph = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/demo" } });
const roadmap = buildRoadmap(graph, []);

describe("exportGraphJson", () => {
  const json = JSON.parse(exportGraphJson(graph, [], roadmap));

  it("emits D3-shaped nodes + links", () => {
    expect(Array.isArray(json.nodes)).toBe(true);
    expect(Array.isArray(json.links)).toBe(true);
    const link = json.links[0];
    expect(link).toHaveProperty("source");
    expect(link).toHaveProperty("target");
    expect(link).toHaveProperty("type");
    expect(link).toHaveProperty("weight");
  });

  it("embeds metadata including the roadmap", () => {
    expect(json.metadata).toHaveProperty("repo");
    expect(json.metadata).toHaveProperty("languageStats");
    expect(json.metadata).toHaveProperty("entryPoints");
    expect(json.metadata).toHaveProperty("circularDependencies");
    expect(json.metadata.roadmap.stages.length).toBeGreaterThan(0);
  });

  it("omits roadmap when not provided", () => {
    const j = JSON.parse(exportGraphJson(graph, []));
    expect(j.metadata.roadmap).toBeUndefined();
  });
});

describe("exportGraphMarkdown", () => {
  const md = exportGraphMarkdown(graph, [], roadmap);

  it("includes all expected sections", () => {
    for (const section of ["## About", "## Scan Metadata", "## Architecture", "## Directory Structure", "## Tech Stack", "## Module Map", "## Circular Dependencies", "## Learning Roadmap"]) {
      expect(md).toContain(section);
    }
  });

  it("renders roadmap stages with the summary", () => {
    expect(md).toContain(roadmap.summary);
    expect(md).toContain(roadmap.stages[0]!.title);
  });

  it("still renders a roadmap-less document gracefully", () => {
    const md2 = exportGraphMarkdown(graph, []);
    expect(md2).toContain("## Learning Roadmap");
    expect(md2).toContain("_no roadmap generated_");
  });
});
