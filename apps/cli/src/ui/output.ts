import { promises as fs } from "node:fs";
import path from "node:path";
import chalk from "chalk";
import open from "open";
import type { ScanResult } from "@repograph/core";
import type { CliOptions } from "../commands/options.js";
import { renderGraphHtml } from "./html.js";

export interface WrittenOutputs {
  jsonPath?: string;
  markdownPath?: string;
  htmlPath: string;
}

export async function writeOutputs(result: ScanResult, opts: CliOptions): Promise<WrittenOutputs> {
  await fs.mkdir(opts.output, { recursive: true });

  const jsonStr = result.toJson();
  const titleParts = [
    result.graph.metadata.owner,
    result.graph.metadata.name,
  ].filter(Boolean);
  const title =
    titleParts.length === 2
      ? `${titleParts[0]}/${titleParts[1]}`
      : path.basename(result.graph.metadata.target.replace(/\/+$/, "")) || result.graph.metadata.target;

  const htmlPath = path.join(opts.output, "repograph-graph.html");
  await fs.writeFile(htmlPath, renderGraphHtml(jsonStr, title), "utf8");

  const written: WrittenOutputs = { htmlPath };

  if (opts.format === "json" || opts.format === "both") {
    const jsonPath = path.join(opts.output, "repograph-graph.json");
    await fs.writeFile(jsonPath, jsonStr, "utf8");
    written.jsonPath = jsonPath;
  }
  if (opts.format === "markdown" || opts.format === "both") {
    const markdownPath = path.join(opts.output, "repograph-context.md");
    await fs.writeFile(markdownPath, result.toMarkdown(), "utf8");
    written.markdownPath = markdownPath;
  }
  return written;
}

export function printOutputs(written: WrittenOutputs): void {
  const lines = [
    `  ${chalk.cyan(written.htmlPath)} ${chalk.dim("(interactive graph)")}`,
  ];
  if (written.jsonPath) lines.push(`  ${chalk.cyan(written.jsonPath)} ${chalk.dim("(raw graph data)")}`);
  if (written.markdownPath) lines.push(`  ${chalk.cyan(written.markdownPath)} ${chalk.dim("(MCP context)")}`);
  console.log(lines.join("\n"));

  if (written.markdownPath) {
    console.log(
      `\n${chalk.dim("MCP context written. Load it into your AI assistant of choice:")}\n` +
        `  ${chalk.dim("• Claude Code:")} ${chalk.bold(`claude /add-dir ${written.markdownPath}`)}\n` +
        `  ${chalk.dim("• Cursor / Continue / any MCP client:")} ${chalk.bold(
          `add ${written.markdownPath} as a project context resource`,
        )}`,
    );
  }
}

export async function openInBrowser(filePath: string): Promise<void> {
  await open(filePath);
}
