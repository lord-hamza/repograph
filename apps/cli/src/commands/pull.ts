import { Command } from "commander";
import { DEFAULT_OPTIONS, parseFormat, type CliOptions } from "./options.js";
import { runScanAndWrite } from "./run.js";

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
      await runScanAndWrite(target, raw);
    });
}
