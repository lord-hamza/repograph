import type { Language } from "../ingestion/types.js";

export type NodeType = "file" | "function" | "class" | "module";
export type EdgeType = "import" | "inheritance" | "call" | "export";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  filePath: string;
  language?: Language;
  lineCount?: number;
  lineStart?: number;
  lineEnd?: number;
  inDegree: number;
  outDegree: number;
  description?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
}

export type LanguageStats = Record<Language, number>;

export interface RepoMetadata {
  name?: string;
  owner?: string;
  commitSha?: string;
  defaultBranch?: string;
  scannedAt: string;
  fileCount: number;
  source: "github" | "local";
  target: string;
}

export interface RepoGraph {
  metadata: RepoMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryPoints: string[];
  orphanFiles: string[];
  languageStats: LanguageStats;
  circularDependencies: string[][];
  externalImports: Record<string, string[]>;
}
