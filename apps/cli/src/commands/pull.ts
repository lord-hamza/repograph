import { promises as fs } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { isGitHubUrl, scan, type ScanResult } from "@repograph/core";
import { openInBrowser, printOutputs, printStats, writeOutputs } from "../ui/index.js";
import { DEFAULT_OPTIONS, parseFormat, type CliOptions } from "./options.js";

function isLikelyPath(target: string): boolean {
  return (
    target === "." ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.startsWith("/") ||
    target.startsWith("~")
  );
}

async function isAccessibleDirectory(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function validateTarget(target: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isGitHubUrl(target)) return { ok: true };
  if (isLikelyPath(target) || !target.includes(":")) {
    if (await isAccessibleDirectory(target)) return { ok: true };
    return { ok: false, reason: `path is not an accessible directory: ${path.resolve(target)}` };
  }
  return { ok: false, reason: `not a GitHub URL or local path: ${target}` };
}

export function registerPullCommand(program: Command): void {
  program
    .command("pull <target>")
    .description("Scan a repo (GitHub URL, local path, or '.') and write graph + MCP outputs.")
    .option("-o, --output <dir>", "Output directory for generated files", DEFAULT_OPTIONS.output)
    .option(
      "-f, --format <format>",
      "Output format: json | md | both",
      (v) => parseFormat(v),
      DEFAULT_OPTIONS.format,
    )
    .option("--open", "Open the graph HTML in the default browser", DEFAULT_OPTIONS.open)
    .option("-v, --verbose", "Verbose logging", DEFAULT_OPTIONS.verbose)
    .action(async (target: string, raw: Partial<CliOptions>) => {
      const opts: CliOptions = { ...DEFAULT_OPTIONS, ...raw };

      const check = await validateTarget(target);
      if (!check.ok) {
        console.error(chalk.red(`error: ${check.reason}`));
        process.exit(1);
      }

      const scanSpinner = ora({ text: "Scanning repository…", color: "cyan" }).start();
      let result: ScanResult;
      try {
        result = await scan(target);
      } catch (err) {
        scanSpinner.fail(chalk.red(`Scan failed: ${(err as Error).message}`));
        if (opts.verbose) console.error(err);
        process.exit(1);
      }
      scanSpinner.succeed(
        `Scanned ${result.rawFiles.length} files → ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges`,
      );

      printStats(result);

      const writeSpinner = ora({ text: "Writing outputs…", color: "cyan" }).start();
      try {
        const written = await writeOutputs(result, opts);
        writeSpinner.succeed("Outputs written:");
        printOutputs(written);
        if (opts.open) {
          try {
            await openInBrowser(written.htmlPath);
          } catch (err) {
            console.error(chalk.yellow(`(could not auto-open browser: ${(err as Error).message})`));
          }
        }
      } catch (err) {
        writeSpinner.fail(chalk.red(`Write failed: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
