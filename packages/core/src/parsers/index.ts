import type { RawFile } from "../ingestion/types.js";
import { parsePython } from "./python.js";
import { parseTypeScript } from "./typescript.js";
import { emptyParsedFile, type ParsedFile } from "./types.js";

export type {
  ClassDef,
  FunctionDef,
  ImportStatement,
  ParsedFile,
} from "./types.js";
export { parsePython } from "./python.js";
export { parseTypeScript } from "./typescript.js";

export function parse(file: RawFile): ParsedFile {
  switch (file.language) {
    case "python":
      return parsePython(file);
    case "typescript":
    case "javascript":
      return parseTypeScript(file, file.language);
    case "unknown":
    default:
      return emptyParsedFile(file.path, file.language);
  }
}
