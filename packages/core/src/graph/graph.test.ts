import { describe, expect, it } from "vitest";
import type { RawFile } from "../ingestion/types.js";
import type { ImportStatement, ParsedFile } from "../parsers/types.js";
import { buildGraph } from "./builder.js";
import { readTsconfigPaths, resolveImports } from "./resolver.js";

function imp(source: string): ImportStatement {
  return { source, imported: [], kind: "static" };
}
function pf(
  path: string,
  opts: Partial<ParsedFile> & { language?: ParsedFile["language"] } = {},
): ParsedFile {
  return {
    path,
    language: opts.language ?? "typescript",
    imports: opts.imports ?? [],
    exports: opts.exports ?? [],
    functions: opts.functions ?? [],
    classes: opts.classes ?? [],
  };
}
function rf(path: string, content = ""): RawFile {
  return { path, content, language: "typescript", size: content.length };
}

describe("resolveImports", () => {
  const fileSet = new Set(["src/a.ts", "src/b.ts", "src/dir/index.ts", "pkg/mod.py", "pkg/sub/thing.py", "pkg/sub/__init__.py"]);

  it("resolves relative imports and index files", () => {
    const file = pf("src/a.ts", { imports: [imp("./b"), imp("./dir")] });
    const resolved = resolveImports(file, { fileSet });
    const targets = resolved.map((r) => r.target);
    expect(targets).toContain("src/b.ts");
    expect(targets).toContain("src/dir/index.ts");
  });

  it("returns null target for bare/external imports", () => {
    const file = pf("src/a.ts", { imports: [imp("react"), imp("node:fs")] });
    const resolved = resolveImports(file, { fileSet });
    expect(resolved.every((r) => r.target === null)).toBe(true);
  });

  it("resolves tsconfig path aliases", () => {
    const tsconfig = { baseUrl: "", paths: { "@/*": ["src/*"] } };
    const file = pf("src/a.ts", { imports: [imp("@/b")] });
    const resolved = resolveImports(file, { fileSet, tsconfig });
    expect(resolved[0]?.target).toBe("src/b.ts");
  });

  it("resolves python dotted and relative imports", () => {
    const file = pf("pkg/mod.py", { language: "python", imports: [imp("pkg.sub.thing"), imp(".sub.thing")] });
    const resolved = resolveImports(file, { fileSet });
    expect(resolved[0]?.target).toBe("pkg/sub/thing.py");
    // relative ".sub.thing" from pkg/mod.py → pkg/sub/thing.py
    expect(resolved[1]?.target).toBe("pkg/sub/thing.py");
  });
});

describe("readTsconfigPaths", () => {
  it("reads paths/baseUrl and strips comments", () => {
    const tsconfig = readTsconfigPaths([
      rf("tsconfig.json", '{\n  // comment\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } }\n}'),
    ]);
    expect(tsconfig?.paths["@/*"]).toEqual(["src/*"]);
  });
  it("returns undefined when there are no paths", () => {
    expect(readTsconfigPaths([rf("tsconfig.json", '{"compilerOptions":{}}')])).toBeUndefined();
  });
});

describe("buildGraph", () => {
  it("computes degrees, entry points, and orphans", () => {
    const parsed = [
      pf("entry.ts", { imports: [imp("./lib")] }),
      pf("lib.ts"),
      pf("orphan.ts"),
    ];
    const raws = [rf("entry.ts", "x"), rf("lib.ts", "y"), rf("orphan.ts", "z")];
    const g = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/x" } });

    const byPath = Object.fromEntries(g.nodes.filter((n) => n.type === "file").map((n) => [n.filePath, n]));
    expect(byPath["lib.ts"].inDegree).toBe(1);
    expect(byPath["entry.ts"].outDegree).toBe(1);
    expect(g.entryPoints).toContain("file:entry.ts");
    expect(g.orphanFiles).toContain("file:orphan.ts");
    expect(g.orphanFiles).not.toContain("file:lib.ts");
  });

  it("detects circular dependencies via Tarjan SCC", () => {
    const parsed = [
      pf("a.ts", { imports: [imp("./b")] }),
      pf("b.ts", { imports: [imp("./a")] }),
    ];
    const raws = [rf("a.ts", "a"), rf("b.ts", "b")];
    const g = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/x" } });
    expect(g.circularDependencies.length).toBe(1);
    expect(g.circularDependencies[0]!.length).toBe(2);
  });

  it("creates inheritance edges across files by class name", () => {
    const parsed = [
      pf("animal.ts", { classes: [{ name: "Animal", lineStart: 1, lineEnd: 3, methods: [] }] }),
      pf("dog.ts", { classes: [{ name: "Dog", lineStart: 1, lineEnd: 3, methods: [], extends: "Animal" }] }),
    ];
    const raws = [rf("animal.ts", "a"), rf("dog.ts", "d")];
    const g = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/x" } });
    expect(g.edges.some((e) => e.type === "inheritance")).toBe(true);
  });

  it("records language stats and metadata", () => {
    const g = buildGraph([pf("a.ts")], [rf("a.ts", "line1\nline2")], {
      metadata: { source: "local", target: "/tmp/x" },
    });
    expect(g.languageStats.typescript).toBe(1);
    expect(g.metadata.fileCount).toBe(1);
    expect(g.metadata.scannedAt).toBeTruthy();
  });

  it("handles an empty repo without throwing", () => {
    const g = buildGraph([], [], { metadata: { source: "local", target: "/tmp/empty" } });
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.circularDependencies).toEqual([]);
  });

  it("survives a pathologically deep import chain without a stack overflow (iterative Tarjan)", () => {
    // A recursive Tarjan overflows the stack around ~4.4k deep; go well past it.
    const N = 8000;
    const parsed: ParsedFile[] = [];
    const raws: RawFile[] = [];
    for (let i = 0; i < N; i++) {
      const next = i < N - 1 ? [imp("./f" + (i + 1))] : [];
      parsed.push(pf("f" + i + ".ts", { imports: next }));
      raws.push(rf("f" + i + ".ts", "x"));
    }
    const g = buildGraph(parsed, raws, { metadata: { source: "local", target: "/tmp/deep" } });
    expect(g.nodes.length).toBe(N);
    expect(g.circularDependencies).toEqual([]); // linear chain → no cycles
  });
});
