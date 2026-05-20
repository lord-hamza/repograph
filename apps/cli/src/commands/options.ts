import type { ExportFormat } from "@repograph/core";

export interface CliOptions {
  output: string;
  format: ExportFormat;
  open: boolean;
  verbose: boolean;
}

export const DEFAULT_OPTIONS: CliOptions = {
  output: process.cwd(),
  format: "both",
  open: false,
  verbose: false,
};

export function parseFormat(value: string): ExportFormat {
  const v = value.toLowerCase();
  if (v === "json" || v === "md" || v === "markdown" || v === "both") {
    return v === "md" ? "markdown" : (v as ExportFormat);
  }
  throw new Error(`Invalid --format: ${value} (expected: json | md | both)`);
}
