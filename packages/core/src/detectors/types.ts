export type TechCategory =
  | "framework"
  | "database"
  | "orm"
  | "auth"
  | "testing"
  | "build"
  | "styling"
  | "language"
  | "library"
  | "other";

export interface TechStackEntry {
  name: string;
  category: TechCategory;
  confidence: number;
  fileCount: number;
  files: string[];
  interactsWith: string[];
  version?: string;
}
