export type ExportFormat = "json" | "markdown" | "both";

export interface ExportOptions {
  format: ExportFormat;
  outputDir: string;
  filenamePrefix: string;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "both",
  outputDir: ".",
  filenamePrefix: "repograph",
};
