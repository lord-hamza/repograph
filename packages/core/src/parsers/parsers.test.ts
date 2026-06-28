import { describe, expect, it } from "vitest";
import { detectLanguage, type RawFile } from "../ingestion/types.js";
import { parse } from "./index.js";

function raw(p: string, content: string): RawFile {
  return { path: p, content, language: detectLanguage(p), size: content.length };
}

describe("parse() TypeScript", () => {
  const file = raw(
    "src/app.ts",
    [
      'import { helper } from "./util";',
      'import def from "./default";',
      'const fs = require("node:fs");',
      'async function load() { return import("./lazy"); }',
      "export function add(a: number, b: number) { return a + b; }",
      "export const mul = (a: number, b: number) => a * b;",
      "export class Animal { speak() { return 'x'; } }",
      "export class Dog extends Animal { bark() { return 'woof'; } }",
      "export interface Shape { area(): number; }",
    ].join("\n"),
  );
  const parsed = parse(file);

  it("collects static, require, and dynamic imports", () => {
    const sources = parsed.imports.map((i) => i.source);
    expect(sources).toContain("./util");
    expect(sources).toContain("./default");
    expect(sources).toContain("node:fs");
    expect(sources).toContain("./lazy");
    const kinds = new Set(parsed.imports.map((i) => i.kind));
    expect(kinds.has("static")).toBe(true);
    expect(kinds.has("require")).toBe(true);
    expect(kinds.has("dynamic")).toBe(true);
  });

  it("collects functions (declarations + arrow consts)", () => {
    const names = parsed.functions.map((f) => f.name);
    expect(names).toContain("add");
    expect(names).toContain("mul");
  });

  it("collects classes, methods, and inheritance", () => {
    const dog = parsed.classes.find((c) => c.name === "Dog");
    expect(dog).toBeTruthy();
    expect(dog?.extends).toBe("Animal");
    const animal = parsed.classes.find((c) => c.name === "Animal");
    expect(animal?.methods.some((m) => m.name === "speak")).toBe(true);
  });

  it("records exports", () => {
    expect(parsed.exports.length).toBeGreaterThan(0);
  });
});

describe("parse() Python", () => {
  const file = raw(
    "pkg/main.py",
    [
      "import os",
      "from .util import helper",
      "from pkg.sub import thing",
      "",
      "def top_level():",
      "    return 1",
      "",
      "class Base:",
      "    def method_a(self):",
      "        return 2",
      "",
      "class Child(Base):",
      "    def method_b(self):",
      "        return 3",
    ].join("\n"),
  );
  const parsed = parse(file);

  it("collects imports including relative and dotted", () => {
    const sources = parsed.imports.map((i) => i.source);
    expect(sources).toContain("os");
    expect(sources.some((s) => s.includes("util"))).toBe(true);
    expect(sources.some((s) => s.includes("pkg.sub") || s.includes("sub"))).toBe(true);
  });

  it("collects top-level functions and classes with methods + inheritance", () => {
    expect(parsed.functions.map((f) => f.name)).toContain("top_level");
    const child = parsed.classes.find((c) => c.name === "Child");
    expect(child).toBeTruthy();
    expect(child?.extends).toBe("Base");
    const base = parsed.classes.find((c) => c.name === "Base");
    expect(base?.methods.some((m) => m.name === "method_a")).toBe(true);
  });
});

describe("parse() edge cases", () => {
  it("returns an empty parse for unknown languages", () => {
    const parsed = parse(raw("data.md", "# hello\n"));
    expect(parsed.imports).toEqual([]);
    expect(parsed.functions).toEqual([]);
    expect(parsed.classes).toEqual([]);
  });
  it("handles empty files without throwing", () => {
    expect(() => parse(raw("empty.ts", ""))).not.toThrow();
    expect(() => parse(raw("empty.py", ""))).not.toThrow();
  });
  it("does not crash on malformed TypeScript", () => {
    expect(() => parse(raw("broken.ts", "function ( { const ="))).not.toThrow();
  });
});
