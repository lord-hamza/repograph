import type { Language } from "../ingestion/types.js";

export interface ImportStatement {
  source: string;
  imported: string[];
  kind: "static" | "dynamic" | "require";
}

export interface FunctionDef {
  name: string;
  lineStart: number;
  lineEnd: number;
}

export interface ClassDef {
  name: string;
  lineStart: number;
  lineEnd: number;
  methods: FunctionDef[];
  extends?: string;
}

export interface ParsedFile {
  path: string;
  language: Language;
  imports: ImportStatement[];
  exports: string[];
  functions: FunctionDef[];
  classes: ClassDef[];
}

export function emptyParsedFile(path: string, language: Language): ParsedFile {
  return {
    path,
    language,
    imports: [],
    exports: [],
    functions: [],
    classes: [],
  };
}
