#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@repograph/core";
import { registerPullCommand } from "./commands/pull.js";

const program = new Command()
  .name("repograph")
  .description("Scan a repo, generate a dependency graph and MCP context file.")
  .version(VERSION)
  .showHelpAfterError();

registerPullCommand(program);

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
