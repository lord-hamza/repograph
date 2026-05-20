import { MultiDirectedGraph } from "graphology";
import type { Language, RawFile } from "../ingestion/types.js";
import type { ParsedFile } from "../parsers/types.js";
import { readTsconfigPaths, resolveImports } from "./resolver.js";
import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  LanguageStats,
  RepoGraph,
  RepoMetadata,
} from "./types.js";

export interface BuildOptions {
  metadata: Pick<RepoMetadata, "source" | "target"> & Partial<RepoMetadata>;
}

function fileNodeId(p: string): string {
  return `file:${p}`;
}

function functionNodeId(filePath: string, name: string, line: number): string {
  return `fn:${filePath}#${name}@${line}`;
}

function classNodeId(filePath: string, name: string): string {
  return `class:${filePath}#${name}`;
}

function countLines(content: string): number {
  if (!content) return 0;
  let lines = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  return lines;
}

function emptyLanguageStats(): LanguageStats {
  return { python: 0, javascript: 0, typescript: 0, unknown: 0 };
}

interface CycleDetectionState {
  index: number;
  stack: string[];
  onStack: Set<string>;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  sccs: string[][];
}

function findCycles(adj: Map<string, Set<string>>): string[][] {
  const state: CycleDetectionState = {
    index: 0,
    stack: [],
    onStack: new Set(),
    indices: new Map(),
    lowlinks: new Map(),
    sccs: [],
  };

  const strongconnect = (v: string): void => {
    state.indices.set(v, state.index);
    state.lowlinks.set(v, state.index);
    state.index++;
    state.stack.push(v);
    state.onStack.add(v);

    const neighbors = adj.get(v) ?? new Set<string>();
    for (const w of neighbors) {
      if (!state.indices.has(w)) {
        strongconnect(w);
        state.lowlinks.set(v, Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!));
      } else if (state.onStack.has(w)) {
        state.lowlinks.set(v, Math.min(state.lowlinks.get(v)!, state.indices.get(w)!));
      }
    }

    if (state.lowlinks.get(v) === state.indices.get(v)) {
      const component: string[] = [];
      while (true) {
        const w = state.stack.pop()!;
        state.onStack.delete(w);
        component.push(w);
        if (w === v) break;
      }
      if (component.length > 1 || adj.get(component[0]!)?.has(component[0]!)) {
        state.sccs.push(component);
      }
    }
  };

  for (const v of adj.keys()) {
    if (!state.indices.has(v)) strongconnect(v);
  }
  return state.sccs;
}

export function buildGraph(
  parsedFiles: ParsedFile[],
  rawFiles: RawFile[],
  options: BuildOptions,
): RepoGraph {
  const graph = new MultiDirectedGraph();
  const rawByPath = new Map(rawFiles.map((f) => [f.path, f]));
  const fileSet = new Set(parsedFiles.map((f) => f.path));

  const languageStats = emptyLanguageStats();
  for (const f of rawFiles) languageStats[f.language] = (languageStats[f.language] ?? 0) + 1;

  const classIndex = new Map<string, string[]>();

  for (const file of parsedFiles) {
    const raw = rawByPath.get(file.path);
    const node: GraphNode = {
      id: fileNodeId(file.path),
      type: "file",
      label: file.path.split("/").pop() ?? file.path,
      filePath: file.path,
      language: file.language as Language,
      inDegree: 0,
      outDegree: 0,
      ...(raw ? { lineCount: countLines(raw.content) } : {}),
    };
    graph.addNode(node.id, node);

    for (const fn of file.functions) {
      const id = functionNodeId(file.path, fn.name, fn.lineStart);
      if (graph.hasNode(id)) continue;
      const n: GraphNode = {
        id,
        type: "function",
        label: fn.name,
        filePath: file.path,
        language: file.language as Language,
        lineStart: fn.lineStart,
        lineEnd: fn.lineEnd,
        inDegree: 0,
        outDegree: 0,
      };
      graph.addNode(id, n);
      graph.addDirectedEdgeWithKey(`contains:${node.id}->${id}`, node.id, id, {
        id: `contains:${node.id}->${id}`,
        source: node.id,
        target: id,
        type: "export" as EdgeType,
        weight: 1,
      });
    }

    for (const cls of file.classes) {
      const id = classNodeId(file.path, cls.name);
      if (graph.hasNode(id)) continue;
      const n: GraphNode = {
        id,
        type: "class",
        label: cls.name,
        filePath: file.path,
        language: file.language as Language,
        lineStart: cls.lineStart,
        lineEnd: cls.lineEnd,
        inDegree: 0,
        outDegree: 0,
      };
      graph.addNode(id, n);
      graph.addDirectedEdgeWithKey(`contains:${node.id}->${id}`, node.id, id, {
        id: `contains:${node.id}->${id}`,
        source: node.id,
        target: id,
        type: "export" as EdgeType,
        weight: 1,
      });
      const list = classIndex.get(cls.name) ?? [];
      list.push(id);
      classIndex.set(cls.name, list);

      for (const method of cls.methods) {
        const methodId = functionNodeId(file.path, `${cls.name}.${method.name}`, method.lineStart);
        if (graph.hasNode(methodId)) continue;
        const m: GraphNode = {
          id: methodId,
          type: "function",
          label: `${cls.name}.${method.name}`,
          filePath: file.path,
          language: file.language as Language,
          lineStart: method.lineStart,
          lineEnd: method.lineEnd,
          inDegree: 0,
          outDegree: 0,
        };
        graph.addNode(methodId, m);
        graph.addDirectedEdgeWithKey(`contains:${id}->${methodId}`, id, methodId, {
          id: `contains:${id}->${methodId}`,
          source: id,
          target: methodId,
          type: "export" as EdgeType,
          weight: 1,
        });
      }
    }
  }

  const tsconfig = readTsconfigPaths(rawFiles);
  const resolveCtx = tsconfig ? { fileSet, tsconfig } : { fileSet };

  const externalImports: Record<string, string[]> = {};
  const importAdj = new Map<string, Set<string>>();
  let edgeCounter = 0;

  for (const file of parsedFiles) {
    const fromId = fileNodeId(file.path);
    importAdj.set(fromId, new Set());
    const resolved = resolveImports(file, resolveCtx);
    for (const r of resolved) {
      if (r.target) {
        const toId = fileNodeId(r.target);
        if (!graph.hasNode(toId)) continue;
        const edgeKey = `import:${edgeCounter++}:${fromId}->${toId}`;
        graph.addDirectedEdgeWithKey(edgeKey, fromId, toId, {
          id: edgeKey,
          source: fromId,
          target: toId,
          type: "import" as EdgeType,
          weight: 1,
        });
        importAdj.get(fromId)!.add(toId);
      } else if (r.raw.source) {
        const list = externalImports[file.path] ?? [];
        list.push(r.raw.source);
        externalImports[file.path] = list;
      }
    }
  }

  for (const file of parsedFiles) {
    for (const cls of file.classes) {
      if (!cls.extends) continue;
      const fromId = classNodeId(file.path, cls.name);
      const candidates = classIndex.get(cls.extends);
      if (!candidates) continue;
      for (const target of candidates) {
        if (target === fromId) continue;
        const edgeKey = `inherits:${edgeCounter++}:${fromId}->${target}`;
        graph.addDirectedEdgeWithKey(edgeKey, fromId, target, {
          id: edgeKey,
          source: fromId,
          target,
          type: "inheritance" as EdgeType,
          weight: 1,
        });
      }
    }
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const nodeId of graph.nodes()) {
    const attrs = graph.getNodeAttributes(nodeId) as GraphNode;
    attrs.inDegree = graph.inDegree(nodeId);
    attrs.outDegree = graph.outDegree(nodeId);
    nodes.push(attrs);
  }
  for (const edgeKey of graph.edges()) {
    edges.push(graph.getEdgeAttributes(edgeKey) as GraphEdge);
  }

  const fileNodes = nodes.filter((n) => n.type === "file");
  const entryPoints = fileNodes
    .filter((n) => {
      const imports = edges.some((e) => e.type === "import" && e.target === n.id);
      const exports = edges.some((e) => e.type === "import" && e.source === n.id);
      return !imports && exports;
    })
    .map((n) => n.id);

  const orphanFiles = fileNodes
    .filter((n) => {
      const imports = edges.some((e) => e.type === "import" && (e.source === n.id || e.target === n.id));
      return !imports;
    })
    .map((n) => n.id);

  const cycles = findCycles(importAdj);

  const metadata: RepoMetadata = {
    ...options.metadata,
    scannedAt: options.metadata.scannedAt ?? new Date().toISOString(),
    fileCount: rawFiles.length,
  };

  return {
    metadata,
    nodes,
    edges,
    entryPoints,
    orphanFiles,
    languageStats,
    circularDependencies: cycles,
    externalImports,
  };
}
