import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scan } from "./scan.js";

const tmpDirs: string[] = [];
async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repograph-scan-"));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("scan() end-to-end", () => {
  it("scans a small TS project into a full result", async () => {
    const dir = await fixture({
      "package.json": JSON.stringify({ name: "demo", dependencies: { react: "^18.0.0" } }),
      "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
      "src/index.ts": 'import { add } from "@/math";\nimport React from "react";\nexport const main = () => add(1, 2);\n',
      "src/math.ts": "export function add(a: number, b: number) { return a + b; }\n",
    });
    const result = await scan(dir);

    expect(result.rawFiles.length).toBeGreaterThan(0);
    expect(result.graph.nodes.some((n) => n.filePath === "src/index.ts")).toBe(true);
    // alias import @/math should resolve to an edge
    expect(result.graph.edges.some((e) => e.type === "import")).toBe(true);
    expect(result.techStack.some((t) => t.name === "React")).toBe(true);

    // roadmap present and coherent
    expect(result.roadmap.stages.length).toBeGreaterThan(0);
    expect(result.roadmap.skillCount).toBeGreaterThan(0);

    // serializers work
    const json = JSON.parse(result.toJson());
    expect(json.metadata.roadmap).toBeTruthy();
    const md = result.toMarkdown();
    expect(md).toContain("## Learning Roadmap");
  });

  it("handles a directory with no source files", async () => {
    const dir = await fixture({ "README.md": "# docs only\n", "data.csv": "a,b\n1,2\n" });
    const result = await scan(dir);
    expect(result.graph.edges.length).toBe(0);
    expect(result.roadmap.stages.length).toBeGreaterThan(0); // foundations/ship still present
    expect(() => result.toJson()).not.toThrow();
    expect(() => result.toMarkdown()).not.toThrow();
  });

  it("scans a Python project and resolves intra-package imports", async () => {
    const dir = await fixture({
      "requirements.txt": "fastapi==0.110.0\n",
      "app/__init__.py": "",
      "app/main.py": "from app.util import helper\n\ndef run():\n    return helper()\n",
      "app/util.py": "def helper():\n    return 42\n",
    });
    const result = await scan(dir);
    expect(result.graph.edges.some((e) => e.type === "import")).toBe(true);
    expect(result.techStack.some((t) => t.name === "FastAPI")).toBe(true);
  });
});
