import type { TechStackEntry } from "../detectors/types.js";
import type { RepoGraph } from "../graph/types.js";

export interface ExportedGraph {
  metadata: {
    repo: RepoGraph["metadata"];
    languageStats: RepoGraph["languageStats"];
    techStack: TechStackEntry[];
    entryPoints: string[];
    orphanFiles: string[];
    circularDependencies: string[][];
  };
  nodes: RepoGraph["nodes"];
  links: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

export function exportGraphJson(graph: RepoGraph, techStack: TechStackEntry[]): string {
  const payload: ExportedGraph = {
    metadata: {
      repo: graph.metadata,
      languageStats: graph.languageStats,
      techStack,
      entryPoints: graph.entryPoints,
      orphanFiles: graph.orphanFiles,
      circularDependencies: graph.circularDependencies,
    },
    nodes: graph.nodes,
    links: graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    })),
  };
  return JSON.stringify(payload, null, 2);
}
