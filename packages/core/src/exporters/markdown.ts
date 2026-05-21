import type { TechStackEntry } from "../detectors/types.js";
import type { GraphNode, RepoGraph } from "../graph/types.js";

function inferProjectKind(graph: RepoGraph, techStack: TechStackEntry[]): string {
  const techByName = new Map(techStack.map((t) => [t.name, t]));
  const has = (name: string) => techByName.has(name);

  // Workspace shape
  const workspaceCount = graph.nodes
    .filter((n) => n.filePath.endsWith("package.json") && !n.filePath.includes("node_modules/"))
    .length;
  const isMonorepo = workspaceCount > 1;
  const langStats = graph.languageStats;
  const totalSource = (langStats.python ?? 0) + (langStats.typescript ?? 0) + (langStats.javascript ?? 0);
  const primaryLang = (() => {
    const entries: Array<[string, number]> = [
      ["TypeScript", langStats.typescript ?? 0],
      ["JavaScript", langStats.javascript ?? 0],
      ["Python", langStats.python ?? 0],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0]?.[1] ? entries[0][0] : "";
  })();

  // Framework → label
  if (has("Next.js")) return `Next.js application${isMonorepo ? " (monorepo)" : ""}`;
  if (has("NestJS")) return `NestJS application${isMonorepo ? " (monorepo)" : ""}`;
  if (has("React") && (has("Vite") || has("Webpack"))) return "React + TypeScript application";
  if (has("React")) return "React application";
  if (has("Vue")) return "Vue application";
  if (has("Svelte")) return "Svelte application";
  if (has("Express") || has("Fastify")) return "Node.js API server";
  if (has("FastAPI")) return "FastAPI service";
  if (has("Django")) return "Django web application";
  if (has("Flask")) return "Flask web service";
  if (has("Turbopack") && isMonorepo) return `${primaryLang || "TypeScript"} monorepo`;
  if (has("tree-sitter") || has("D3")) return `${primaryLang || "TypeScript"} developer tool`;
  if (isMonorepo) return `${primaryLang || "TypeScript"} monorepo`;
  if (totalSource === 0) return "documentation / data repository";
  return `${primaryLang} project`;
}

function workspacePaths(graph: RepoGraph): string[] {
  return graph.nodes
    .filter((n) => n.filePath.endsWith("package.json") && !n.filePath.includes("node_modules/"))
    .map((n) => (n.filePath === "package.json" ? "(root)" : n.filePath.replace(/\/package\.json$/, "")))
    .sort();
}

function aboutSection(graph: RepoGraph, techStack: TechStackEntry[]): string {
  const meta = graph.metadata;
  const displayName = meta.owner && meta.name
    ? `${meta.owner}/${meta.name}`
    : (meta.target.replace(/\/+$/, "").split("/").pop() || meta.target);

  const kind = inferProjectKind(graph, techStack);
  const topTech = techStack.slice(0, 4).map((t) => t.name);
  const workspaces = workspacePaths(graph);

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const entryFiles = graph.entryPoints
    .slice(0, 2)
    .map((id) => nodeById.get(id)?.filePath)
    .filter(Boolean) as string[];

  // 3 lines, separated by paragraph breaks.
  const overview = `**${displayName}** is a ${kind}${
    topTech.length > 0 ? ` built with ${topTech.join(", ")}` : ""
  }. ${meta.fileCount} files scanned, ${graph.edges.length} dependency edges resolved.`;

  let structure: string;
  if (workspaces.length > 1) {
    structure = `Monorepo with ${workspaces.length} workspaces: ${workspaces.map((w) => `\`${w}\``).join(", ")}.`;
  } else {
    const langSummary = Object.entries(graph.languageStats)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, n]) => `${n} ${lang}`)
      .join(" · ");
    structure = `Single-package codebase. Composition: ${langSummary || "no recognized source files"}.`;
  }

  let purpose: string;
  if (entryFiles.length > 0) {
    const entryStr = entryFiles.map((f) => `\`${f}\``).join(entryFiles.length === 2 ? " and " : "");
    purpose = `Primary entry ${entryFiles.length === 1 ? "point" : "points"}: ${entryStr}.${
      graph.circularDependencies.length > 0
        ? ` ⚠ ${graph.circularDependencies.length} circular dependency cycle${graph.circularDependencies.length === 1 ? "" : "s"} detected.`
        : ""
    }`;
  } else {
    purpose = graph.circularDependencies.length > 0
      ? `⚠ ${graph.circularDependencies.length} circular dependency cycle${graph.circularDependencies.length === 1 ? "" : "s"} detected.`
      : `No clear entry point — likely a library or shared package.`;
  }

  return [overview, structure, purpose].join("\n\n");
}

function escapePipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function languageBreakdown(stats: RepoGraph["languageStats"]): string {
  const entries = Object.entries(stats).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "_no recognizable source files_";
  return entries.map(([lang, count]) => `- **${lang}**: ${count} files`).join("\n");
}

function buildDirectoryTree(files: GraphNode[]): string {
  const tree: Record<string, unknown> = {};
  for (const node of files) {
    const parts = node.filePath.split("/");
    let cursor = tree;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i]!;
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        cursor[segment] = null;
      } else {
        if (!(segment in cursor) || cursor[segment] === null) cursor[segment] = {};
        cursor = cursor[segment] as Record<string, unknown>;
      }
    }
  }
  const lines: string[] = [];
  const render = (obj: Record<string, unknown>, prefix: string): void => {
    const keys = Object.keys(obj).sort((a, b) => {
      const aDir = obj[a] !== null;
      const bDir = obj[b] !== null;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return a.localeCompare(b);
    });
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const isLast = i === keys.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${key}`);
      if (obj[key] !== null) {
        render(obj[key] as Record<string, unknown>, `${prefix}${isLast ? "    " : "│   "}`);
      }
    }
  };
  render(tree, "");
  return lines.join("\n");
}

function workspaceRoots(files: GraphNode[]): string[] {
  const pkgDirs = new Set<string>();
  for (const f of files) {
    if (f.filePath.endsWith("package.json") && !f.filePath.includes("node_modules/")) {
      const dir = f.filePath === "package.json" ? "" : f.filePath.replace(/\/package\.json$/, "");
      pkgDirs.add(dir);
    }
  }
  return [...pkgDirs];
}

function workspaceForFile(filePath: string, roots: string[]): string {
  let best = "";
  let bestLen = -1;
  for (const root of roots) {
    if (root === "") {
      if (bestLen < 0) {
        best = "";
        bestLen = 0;
      }
      continue;
    }
    if (filePath === root || filePath.startsWith(`${root}/`)) {
      if (root.length > bestLen) {
        best = root;
        bestLen = root.length;
      }
    }
  }
  return best || "(root)";
}

function moduleMap(graph: RepoGraph): string {
  const allFileNodes = graph.nodes.filter((n) => n.type === "file");
  const roots = workspaceRoots(allFileNodes);
  const monorepo = roots.filter((r) => r !== "").length > 1;

  const keyFor = (filePath: string): string => {
    if (monorepo) return workspaceForFile(filePath, roots);
    return filePath.includes("/") ? filePath.split("/")[0]! : "(root)";
  };

  const filesByGroup = new Map<string, GraphNode[]>();
  for (const f of allFileNodes) {
    const key = keyFor(f.filePath);
    const list = filesByGroup.get(key) ?? [];
    list.push(f);
    filesByGroup.set(key, list);
  }

  const importEdges = graph.edges.filter((e) => e.type === "import");
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const blocks: string[] = [];

  for (const group of [...filesByGroup.keys()].sort()) {
    const filesInGroup = filesByGroup.get(group) ?? [];
    const importedFromGroups = new Set<string>();
    const importingGroups = new Set<string>();
    for (const e of importEdges) {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) continue;
      const srcGroup = keyFor(src.filePath);
      const tgtGroup = keyFor(tgt.filePath);
      if (srcGroup === group && tgtGroup !== group) importedFromGroups.add(tgtGroup);
      if (tgtGroup === group && srcGroup !== group) importingGroups.add(srcGroup);
    }
    const label = group === "(root)" || group === "" ? "(root)" : `${group}/`;
    blocks.push(
      [
        `### \`${label}\` — ${filesInGroup.length} files`,
        `- _${summarizeGroup(filesInGroup)}_`,
        importedFromGroups.size > 0
          ? `- Imports from: ${[...importedFromGroups].sort().map((d) => `\`${d === "(root)" ? "(root)" : `${d}/`}\``).join(", ")}`
          : "- Imports from: _none_",
        importingGroups.size > 0
          ? `- Imported by: ${[...importingGroups].sort().map((d) => `\`${d === "(root)" ? "(root)" : `${d}/`}\``).join(", ")}`
          : "- Imported by: _none_",
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

function summarizeGroup(files: GraphNode[]): string {
  if (files.length === 0) return "Empty";
  const buckets = new Map<string, number>();
  for (const f of files) {
    const d = f.description ?? "Other";
    const key = d.split(" — ")[0]?.split(" · ")[0]?.split(" (")[0] ?? d;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3).map(([kind, n]) => `${kind} ×${n}`);
  const rest = sorted.length > 3 ? `, +${sorted.length - 3} more` : "";
  return top.join(", ") + rest;
}

function techStackTable(techStack: TechStackEntry[]): string {
  if (techStack.length === 0) return "_no technologies detected above the 0.5 confidence threshold_";
  const header = "| Name | Category | Files | Version | Key files |\n| --- | --- | --- | --- | --- |";
  const rows = techStack.map((t) => {
    const keyFiles = t.files.slice(0, 3).map((f) => `\`${escapePipes(f)}\``).join(", ");
    return `| ${escapePipes(t.name)} | ${t.category} | ${t.fileCount} | ${t.version ?? "—"} | ${keyFiles || "—"} |`;
  });
  return [header, ...rows].join("\n");
}

function criticalFiles(graph: RepoGraph): string {
  const fileNodes = graph.nodes.filter((n) => n.type === "file" && n.inDegree > 0);
  fileNodes.sort((a, b) => b.inDegree - a.inDegree);
  const top = fileNodes.slice(0, 10);
  if (top.length === 0) return "_no files have inbound import edges_";
  return top
    .map((n, i) => {
      const line = `${i + 1}. \`${n.filePath}\` — imported by ${n.inDegree} file(s)`;
      return n.description ? `${line}\n   _${n.description}_` : line;
    })
    .join("\n");
}

function circularDeps(graph: RepoGraph): string {
  if (graph.circularDependencies.length === 0) return "_none detected_";
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.circularDependencies
    .map((cycle, i) => {
      const labels = cycle.map((id) => nodeById.get(id)?.filePath ?? id);
      return `${i + 1}. ${labels.join(" → ")} → ${labels[0]}`;
    })
    .join("\n");
}

function entryPointsSection(graph: RepoGraph): string {
  if (graph.entryPoints.length === 0) return "_no clear entry points detected_";
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  return graph.entryPoints
    .slice(0, 20)
    .map((id) => {
      const node = nodeById.get(id);
      const path = node?.filePath ?? id;
      const line = `- \`${path}\``;
      return node?.description ? `${line} — _${node.description}_` : line;
    })
    .join("\n");
}

function titleFor(meta: RepoGraph["metadata"]): string {
  if (meta.owner && meta.name) return `${meta.owner}/${meta.name}`;
  const trimmed = meta.target.replace(/\/+$/, "");
  const basename = trimmed.split("/").pop();
  return basename && basename.length > 0 ? basename : meta.target;
}

export function exportGraphMarkdown(graph: RepoGraph, techStack: TechStackEntry[]): string {
  const meta = graph.metadata;
  const repoName = titleFor(meta);
  const fileNodes = graph.nodes.filter((n) => n.type === "file");

  const metaLines = [
    `- **Scanned at:** ${meta.scannedAt}`,
    `- **Source:** ${meta.source}`,
  ];
  if (meta.commitSha) metaLines.push(`- **Commit:** \`${meta.commitSha}\``);
  if (meta.defaultBranch) metaLines.push(`- **Branch:** \`${meta.defaultBranch}\``);
  metaLines.push(
    `- **Files:** ${meta.fileCount}`,
    `- **Nodes:** ${graph.nodes.length} (files + functions + classes)`,
    `- **Edges:** ${graph.edges.length}`,
  );

  return [
    `# ${repoName}`,
    "",
    `RepoGraph context file. Generated by \`@repograph/core\` — a structural map of this repository for AI coding assistants (Claude Code, Cursor, Continue, or any MCP-compatible client).`,
    "",
    "## About",
    "",
    aboutSection(graph, techStack),
    "",
    "## Scan Metadata",
    "",
    ...metaLines,
    "",
    "## Architecture",
    "",
    "### Language Breakdown",
    "",
    languageBreakdown(graph.languageStats),
    "",
    "### Entry Points",
    "",
    entryPointsSection(graph),
    "",
    "## Directory Structure",
    "",
    "```",
    buildDirectoryTree(fileNodes),
    "```",
    "",
    "## Tech Stack",
    "",
    techStackTable(techStack),
    "",
    "## Module Map",
    "",
    moduleMap(graph),
    "",
    "## Critical Files (Most-Imported)",
    "",
    criticalFiles(graph),
    "",
    "## Circular Dependencies",
    "",
    circularDeps(graph),
    "",
  ].join("\n");
}
