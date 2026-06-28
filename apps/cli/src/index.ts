#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@repograph/core";
import { registerPullCommand } from "./commands/pull.js";
import { registerRoadmapCommand } from "./commands/roadmap.js";

const program = new Command()
  .name("repograph")
  .description("Scan a repo: interactive dependency graph (globe/map/web/brain), learning roadmap, and MCP context.")
  .version(VERSION)
  .showHelpAfterError();

registerPullCommand(program);
registerRoadmapCommand(program);

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
