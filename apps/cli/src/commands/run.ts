import { promises as fs } from "node:fs";
import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import { isGitHubUrl, scan, type ScanResult } from "@repograph/core";
import { openInBrowser, printOutputs, printStats, writeOutputs } from "../ui/index.js";
import { DEFAULT_OPTIONS, type CliOptions } from "./options.js";

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

export async function validateTarget(
  target: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isGitHubUrl(target)) return { ok: true };
  if (isLikelyPath(target) || !target.includes(":")) {
    if (await isAccessibleDirectory(target)) return { ok: true };
    return { ok: false, reason: `path is not an accessible directory: ${path.resolve(target)}` };
  }
  return { ok: false, reason: `not a GitHub URL or local path: ${target}` };
}

export interface RunOptions {
  /** Optional URL hash to deep-link the opened HTML to (e.g. "roadmap", "brain"). */
  openHash?: string;
}

/**
 * Shared pipeline behind every command: validate → scan → print stats →
 * write outputs → optionally open the HTML (deep-linked when a hash is given).
 */
export async function runScanAndWrite(
  target: string,
  raw: Partial<CliOptions>,
  run: RunOptions = {},
): Promise<void> {
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

  if (result.rawFiles.length === 0) {
    scanSpinner.warn(
      chalk.yellow("No scannable source files found (empty repo, all excluded, or unsupported languages)."),
    );
  } else {
    scanSpinner.succeed(
      `Scanned ${result.rawFiles.length} files → ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges`,
    );
  }

  printStats(result);

  const writeSpinner = ora({ text: "Writing outputs…", color: "cyan" }).start();
  try {
    const written = await writeOutputs(result, opts);
    writeSpinner.succeed("Outputs written:");
    printOutputs(written);
    if (opts.open) {
      try {
        await openInBrowser(written.htmlPath, run.openHash);
      } catch (err) {
        console.error(chalk.yellow(`(could not auto-open browser: ${(err as Error).message})`));
      }
    }
  } catch (err) {
    writeSpinner.fail(chalk.red(`Write failed: ${(err as Error).message}`));
    process.exit(1);
  }
}
