import ts from "typescript";
import type { Language, RawFile } from "../ingestion/types.js";
import {
  emptyParsedFile,
  type ClassDef,
  type FunctionDef,
  type ImportStatement,
  type ParsedFile,
} from "./types.js";

function scriptKind(path: string): ts.ScriptKind {
  const p = path.toLowerCase();
  if (p.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (p.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (p.endsWith(".ts") || p.endsWith(".mts") || p.endsWith(".cts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function hasExport(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function importedNames(clause: ts.ImportClause): string[] {
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      names.push(clause.namedBindings.name.text);
    } else {
      for (const el of clause.namedBindings.elements) names.push(el.name.text);
    }
  }
  return names;
}

function collectImports(sf: ts.SourceFile, out: ImportStatement[]): void {
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({
        source: node.moduleSpecifier.text,
        imported: node.importClause ? importedNames(node.importClause) : [],
        kind: "static",
      });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      out.push({
        source: node.moduleReference.expression.text,
        imported: [node.name.text],
        kind: "require",
      });
    } else if (ts.isCallExpression(node)) {
      const [arg] = node.arguments;
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        arg &&
        ts.isStringLiteral(arg)
      ) {
        out.push({ source: arg.text, imported: [], kind: "dynamic" });
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        arg &&
        ts.isStringLiteral(arg)
      ) {
        out.push({ source: arg.text, imported: [], kind: "require" });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

function collectFunction(node: ts.FunctionDeclaration, sf: ts.SourceFile): FunctionDef | null {
  if (!node.name) return null;
  return {
    name: node.name.text,
    lineStart: lineOf(sf, node.getStart(sf)),
    lineEnd: lineOf(sf, node.getEnd()),
  };
}

function collectArrowAssignments(stmt: ts.VariableStatement, sf: ts.SourceFile): FunctionDef[] {
  const out: FunctionDef[] = [];
  for (const decl of stmt.declarationList.declarations) {
    if (!decl.initializer) continue;
    const init = decl.initializer;
    if (!ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) continue;
    if (!ts.isIdentifier(decl.name)) continue;
    out.push({
      name: decl.name.text,
      lineStart: lineOf(sf, decl.getStart(sf)),
      lineEnd: lineOf(sf, decl.getEnd()),
    });
  }
  return out;
}

function collectClass(node: ts.ClassDeclaration, sf: ts.SourceFile): ClassDef | null {
  if (!node.name) return null;

  let extendsName: string | undefined;
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      const first = clause.types[0];
      if (first) extendsName = first.expression.getText(sf);
    }
  }

  const methods: FunctionDef[] = [];
  for (const member of node.members) {
    if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
      methods.push({
        name: member.name.text,
        lineStart: lineOf(sf, member.getStart(sf)),
        lineEnd: lineOf(sf, member.getEnd()),
      });
    } else if (
      ts.isPropertyDeclaration(member) &&
      member.initializer &&
      (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer)) &&
      ts.isIdentifier(member.name)
    ) {
      methods.push({
        name: member.name.text,
        lineStart: lineOf(sf, member.getStart(sf)),
        lineEnd: lineOf(sf, member.getEnd()),
      });
    }
  }

  const result: ClassDef = {
    name: node.name.text,
    lineStart: lineOf(sf, node.getStart(sf)),
    lineEnd: lineOf(sf, node.getEnd()),
    methods,
  };
  if (extendsName !== undefined) result.extends = extendsName;
  return result;
}

function collectExports(sf: ts.SourceFile, out: string[]): void {
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) out.push(el.name.text);
    } else if (ts.isExportAssignment(stmt)) {
      out.push("default");
    } else if (hasExport(stmt)) {
      if (ts.isFunctionDeclaration(stmt) && stmt.name) out.push(stmt.name.text);
      else if (ts.isClassDeclaration(stmt) && stmt.name) out.push(stmt.name.text);
      else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) out.push(decl.name.text);
        }
      } else if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
        out.push(stmt.name.text);
      }
    }
  }
}

export function parseTypeScript(file: RawFile, language: Language): ParsedFile {
  const sf = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file.path),
  );
  const parsed = emptyParsedFile(file.path, language);

  collectImports(sf, parsed.imports);
  collectExports(sf, parsed.exports);

  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt)) {
      const fn = collectFunction(stmt, sf);
      if (fn) parsed.functions.push(fn);
    } else if (ts.isVariableStatement(stmt)) {
      parsed.functions.push(...collectArrowAssignments(stmt, sf));
    } else if (ts.isClassDeclaration(stmt)) {
      const cls = collectClass(stmt, sf);
      if (cls) parsed.classes.push(cls);
    }
  }

  return parsed;
}
