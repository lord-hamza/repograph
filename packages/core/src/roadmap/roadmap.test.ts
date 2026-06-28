import { describe, expect, it } from "vitest";
import type { TechStackEntry } from "../detectors/types.js";
import type { RepoGraph } from "../graph/types.js";
import { buildRoadmap } from "./roadmap.js";

function baseGraph(overrides: Partial<RepoGraph> = {}): RepoGraph {
  return {
    metadata: {
      scannedAt: "2026-01-01T00:00:00.000Z",
      fileCount: 3,
      source: "local",
      target: "/tmp/demo",
      ...overrides.metadata,
    },
    nodes: overrides.nodes ?? [
      { id: "file:a.ts", type: "file", label: "a.ts", filePath: "a.ts", inDegree: 0, outDegree: 1 },
      { id: "file:b.ts", type: "file", label: "b.ts", filePath: "b.ts", inDegree: 1, outDegree: 0 },
    ],
    edges: overrides.edges ?? [
      { id: "e1", source: "file:a.ts", target: "file:b.ts", type: "import", weight: 1 },
    ],
    entryPoints: overrides.entryPoints ?? ["file:a.ts"],
    orphanFiles: overrides.orphanFiles ?? [],
    languageStats: overrides.languageStats ?? { typescript: 2, javascript: 0, python: 0, unknown: 0 },
    circularDependencies: overrides.circularDependencies ?? [],
    externalImports: overrides.externalImports ?? {},
  };
}

const tech = (name: string, category: TechStackEntry["category"], fileCount = 1): TechStackEntry => ({
  name,
  category,
  confidence: 0.9,
  fileCount,
  files: [],
  interactsWith: [],
});

describe("buildRoadmap", () => {
  it("always produces foundations, architecture, and ship stages even with no tech", () => {
    const rm = buildRoadmap(baseGraph(), []);
    const ids = rm.stages.map((s) => s.id);
    expect(ids).toContain("foundations");
    expect(ids).toContain("architecture");
    expect(ids).toContain("ship");
    expect(rm.skillCount).toBeGreaterThan(0);
    expect(rm.summary).toContain("skill path");
  });

  it("routes detected tech into the right stages with doc links", () => {
    const rm = buildRoadmap(baseGraph(), [
      tech("React", "framework", 5),
      tech("Vitest", "testing", 2),
      tech("Prisma", "orm", 1),
    ]);
    const byId = Object.fromEntries(rm.stages.map((s) => [s.id, s]));
    expect(byId.frameworks.skills.some((s) => s.name === "React" && s.doc?.includes("react.dev"))).toBe(true);
    expect(byId.testing.skills.some((s) => s.name === "Vitest")).toBe(true);
    expect(byId.data.skills.some((s) => s.name === "Prisma")).toBe(true);
  });

  it("adds a cycle-breaking skill only when cycles exist", () => {
    const withCycles = buildRoadmap(
      baseGraph({ circularDependencies: [["file:a.ts", "file:b.ts"]] }),
      [],
    );
    const arch = withCycles.stages.find((s) => s.id === "architecture");
    expect(arch?.skills.some((s) => s.name.toLowerCase().includes("circular"))).toBe(true);

    const noCycles = buildRoadmap(baseGraph(), []);
    const arch2 = noCycles.stages.find((s) => s.id === "architecture");
    expect(arch2?.skills.some((s) => s.name.toLowerCase().includes("circular"))).toBe(false);
  });

  it("is deterministic — same input yields identical output", () => {
    const a = JSON.stringify(buildRoadmap(baseGraph(), [tech("React", "framework")]));
    const b = JSON.stringify(buildRoadmap(baseGraph(), [tech("React", "framework")]));
    expect(a).toBe(b);
  });

  it("picks Python as the foundation language when it dominates", () => {
    const rm = buildRoadmap(
      baseGraph({ languageStats: { typescript: 0, javascript: 0, python: 9, unknown: 0 } }),
      [],
    );
    const found = rm.stages.find((s) => s.id === "foundations");
    expect(found?.skills.some((s) => s.name === "Python")).toBe(true);
  });
});
