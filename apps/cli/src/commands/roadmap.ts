import { Command } from "commander";
import { DEFAULT_OPTIONS, parseFormat, type CliOptions } from "./options.js";
import { runScanAndWrite } from "./run.js";

/**
 * Adds the shared options to a command that opens the interactive frontend.
 * These commands open the browser by default (the whole point), so they expose
 * `--no-open` instead of `--open`.
 */
function withFrontendOptions(cmd: Command): Command {
  return cmd
    .option("-o, --output <dir>", "Output directory for generated files", DEFAULT_OPTIONS.output)
    .option(
      "-f, --format <format>",
      "Output format: json | md | both",
      (v) => parseFormat(v),
      DEFAULT_OPTIONS.format,
    )
    .option("--no-open", "Do not open the page in the browser (just write files)")
    .option("-v, --verbose", "Verbose logging");
}

export function registerRoadmapCommand(program: Command): void {
  withFrontendOptions(
    program
      .command("roadmap <target>")
      .aliases(["learn"])
      .description("Scan a repo and open the interactive Learning Roadmap + Brain in your browser."),
  ).action(async (target: string, raw: Partial<CliOptions>) => {
    await runScanAndWrite(target, raw, { openHash: "roadmap" });
  });

  withFrontendOptions(
    program
      .command("brain <target>")
      .description("Scan a repo and open the 3D Brain view (neural map of the codebase)."),
  ).action(async (target: string, raw: Partial<CliOptions>) => {
    await runScanAndWrite(target, raw, { openHash: "brain" });
  });
}
