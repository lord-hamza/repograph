import path from "node:path";
import { detectTechStack } from "./detectors/detector.js";
import type { TechStackEntry } from "./detectors/types.js";
import { exportGraphJson } from "./exporters/json.js";
import { exportGraphMarkdown } from "./exporters/markdown.js";
import { buildGraph } from "./graph/builder.js";
import type { RepoGraph } from "./graph/types.js";
import { ingest } from "./ingestion/index.js";
import { isGitHubUrl, parseGitHubUrl } from "./ingestion/github.js";
import type { RawFile } from "./ingestion/types.js";
import { parse } from "./parsers/index.js";
import type { ParsedFile } from "./parsers/types.js";
import { buildRoadmap } from "./roadmap/index.js";
import type { Roadmap } from "./roadmap/types.js";

export interface ScanOptions {
  commitSha?: string;
  defaultBranch?: string;
}

export interface ScanResult {
  graph: RepoGraph;
  techStack: TechStackEntry[];
  roadmap: Roadmap;
  rawFiles: RawFile[];
  parsedFiles: ParsedFile[];
  toJson(): string;
  toMarkdown(): string;
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanResult> {
  const source = isGitHubUrl(target) ? "github" : "local";
  const repoMeta = source === "github" ? parseGitHubUrl(target) : null;
  const displayTarget = source === "local" ? path.resolve(target) : target;

  const rawFiles = await ingest(target);
  const parsedFiles = rawFiles.map((f) => parse(f));

  const graph = buildGraph(parsedFiles, rawFiles, {
    metadata: {
      source,
      target: displayTarget,
      ...(repoMeta ? { owner: repoMeta.owner, name: repoMeta.repo } : {}),
      ...(options.commitSha ? { commitSha: options.commitSha } : {}),
      ...(options.defaultBranch ? { defaultBranch: options.defaultBranch } : {}),
    },
  });

  const techStack = detectTechStack(graph, rawFiles, parsedFiles);
  const roadmap = buildRoadmap(graph, techStack);

  return {
    graph,
    techStack,
    roadmap,
    rawFiles,
    parsedFiles,
    toJson: () => exportGraphJson(graph, techStack, roadmap),
    toMarkdown: () => exportGraphMarkdown(graph, techStack, roadmap),
  };
}
