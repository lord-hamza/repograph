import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { RawFile } from "../ingestion/types.js";
import {
  emptyParsedFile,
  type ClassDef,
  type FunctionDef,
  type ImportStatement,
  type ParsedFile,
} from "./types.js";

type Node = Parser.SyntaxNode;

let cachedParser: Parser | null = null;
function getParser(): Parser {
  if (!cachedParser) {
    cachedParser = new Parser();
    cachedParser.setLanguage(Python as unknown as Parser.Language);
  }
  return cachedParser;
}

function line(node: Node, end = false): number {
  return (end ? node.endPosition.row : node.startPosition.row) + 1;
}

function funcDef(node: Node): FunctionDef | null {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return null;
  return { name: nameNode.text, lineStart: line(node), lineEnd: line(node, true) };
}

function classDef(node: Node): ClassDef | null {
  const nameNode = node.childForFieldName("name");
  if (!nameNode) return null;

  let extendsName: string | undefined;
  const superclasses = node.childForFieldName("superclasses");
  if (superclasses) {
    const first = superclasses.namedChildren[0];
    if (first) extendsName = first.text;
  }

  const methods: FunctionDef[] = [];
  const body = node.childForFieldName("body");
  if (body) {
    for (const child of body.namedChildren) {
      if (child.type === "function_definition" || child.type === "decorated_definition") {
        const target = child.type === "decorated_definition"
          ? child.namedChildren.find((c) => c.type === "function_definition")
          : child;
        if (target) {
          const fn = funcDef(target);
          if (fn) methods.push(fn);
        }
      }
    }
  }

  const result: ClassDef = {
    name: nameNode.text,
    lineStart: line(node),
    lineEnd: line(node, true),
    methods,
  };
  if (extendsName !== undefined) result.extends = extendsName;
  return result;
}

function collectImport(node: Node, out: ImportStatement[]): void {
  if (node.type === "import_statement") {
    for (const child of node.namedChildren) {
      if (child.type === "dotted_name") {
        out.push({ source: child.text, imported: [], kind: "static" });
      } else if (child.type === "aliased_import") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) out.push({ source: nameNode.text, imported: [], kind: "static" });
      }
    }
    return;
  }
  if (node.type === "import_from_statement") {
    const moduleNode = node.childForFieldName("module_name");
    const source = moduleNode ? moduleNode.text : "";
    const imported: string[] = [];
    for (const child of node.childrenForFieldName("name")) {
      if (child.type === "dotted_name" || child.type === "identifier") {
        imported.push(child.text);
      } else if (child.type === "aliased_import") {
        const nameNode = child.childForFieldName("name");
        if (nameNode) imported.push(nameNode.text);
      }
    }
    out.push({ source, imported, kind: "static" });
  }
}

function walk(node: Node, parsed: ParsedFile, depth: number): void {
  switch (node.type) {
    case "import_statement":
    case "import_from_statement":
      collectImport(node, parsed.imports);
      return;
    case "function_definition": {
      if (depth === 0) {
        const fn = funcDef(node);
        if (fn) parsed.functions.push(fn);
      }
      return;
    }
    case "decorated_definition": {
      if (depth === 0) {
        const inner = node.namedChildren.find((c) => c.type === "function_definition");
        if (inner) {
          const fn = funcDef(inner);
          if (fn) parsed.functions.push(fn);
          return;
        }
        const cls = node.namedChildren.find((c) => c.type === "class_definition");
        if (cls) {
          const c = classDef(cls);
          if (c) parsed.classes.push(c);
          return;
        }
      }
      return;
    }
    case "class_definition": {
      if (depth === 0) {
        const c = classDef(node);
        if (c) parsed.classes.push(c);
      }
      return;
    }
    default:
      break;
  }
  for (const child of node.namedChildren) {
    walk(child, parsed, depth + 1);
  }
}

export function parsePython(file: RawFile): ParsedFile {
  const parser = getParser();
  const tree = parser.parse(file.content);
  const parsed = emptyParsedFile(file.path, "python");
  const root = tree.rootNode;
  for (const child of root.namedChildren) {
    walk(child, parsed, 0);
  }
  return parsed;
}
