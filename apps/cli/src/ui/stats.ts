import chalk from "chalk";
import Table from "cli-table3";
import type { ScanResult } from "@repograph/core";

const HEALTHY = chalk.green;
const WARN = chalk.yellow;
const ERR = chalk.red;
const MUTED = chalk.dim;

function statusColor(value: number, opts: { warnIf?: (n: number) => boolean; errIf?: (n: number) => boolean }): (s: string) => string {
  if (opts.errIf?.(value)) return ERR;
  if (opts.warnIf?.(value)) return WARN;
  return HEALTHY;
}

function percent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function renderStats(result: ScanResult): string {
  const { graph, techStack, rawFiles } = result;
  const fileNodes = graph.nodes.filter((n) => n.type === "file");

  const summary = new Table({
    head: [chalk.bold("Metric"), chalk.bold("Value")],
    style: { head: [], border: [] },
  });
  summary.push(
    ["Files scanned", HEALTHY(String(rawFiles.length))],
    ["File nodes", HEALTHY(String(fileNodes.length))],
    ["Total nodes", HEALTHY(String(graph.nodes.length))],
    ["Edges", HEALTHY(String(graph.edges.length))],
    [
      "Entry points",
      statusColor(graph.entryPoints.length, { warnIf: (n) => n === 0 })(String(graph.entryPoints.length)),
    ],
    [
      "Orphans",
      statusColor(graph.orphanFiles.length, {
        warnIf: (n) => n > 0 && n < fileNodes.length / 2,
        errIf: (n) => n >= fileNodes.length / 2 && fileNodes.length > 0,
      })(String(graph.orphanFiles.length)),
    ],
    [
      "Circular deps",
      statusColor(graph.circularDependencies.length, { warnIf: (n) => n > 0 })(
        graph.circularDependencies.length === 0 ? "None" : String(graph.circularDependencies.length),
      ),
    ],
  );

  const langTable = new Table({
    head: [chalk.bold("Language"), chalk.bold("Files"), chalk.bold("%")],
    style: { head: [], border: [] },
  });
  const langEntries = Object.entries(graph.languageStats)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of langEntries) {
    langTable.push([lang, String(count), percent(count, rawFiles.length)]);
  }

  const topFiles = fileNodes
    .filter((n) => n.inDegree > 0)
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 5);
  const topTable = new Table({
    head: [chalk.bold("#"), chalk.bold("File"), chalk.bold("Imported by")],
    style: { head: [], border: [] },
  });
  topFiles.forEach((n, i) => topTable.push([String(i + 1), n.filePath, String(n.inDegree)]));

  const techList =
    techStack.length === 0
      ? MUTED("(none detected)")
      : techStack
          .slice(0, 12)
          .map((t) => `${chalk.cyan(t.name)} ${MUTED(`(${t.category}, ${t.confidence.toFixed(2)})`)}`)
          .join(", ");

  const sections: string[] = [
    chalk.bold.cyan("\nScan Summary"),
    summary.toString(),
    chalk.bold.cyan("\nLanguages"),
    langEntries.length > 0 ? langTable.toString() : MUTED("(no recognizable source files)"),
    chalk.bold.cyan("\nTech Stack"),
    techList,
  ];
  if (topFiles.length > 0) {
    sections.push(chalk.bold.cyan("\nMost-Imported Files"), topTable.toString());
  }
  if (graph.circularDependencies.length > 0) {
    sections.push(
      WARN.bold("\nCircular Dependencies"),
      graph.circularDependencies
        .slice(0, 5)
        .map((cycle, i) => `${i + 1}. ${cycle.join(" → ")}`)
        .join("\n"),
    );
  }
  return sections.join("\n");
}

export function printStats(result: ScanResult): void {
  console.log(renderStats(result));
}
