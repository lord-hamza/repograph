import { ingestGitHub, isGitHubUrl } from "./github.js";
import { ingestLocal } from "./local.js";
import type { RawFile } from "./types.js";

export type { RawFile, Language } from "./types.js";
export { detectLanguage, isExcludedPath } from "./types.js";
export { ingestGitHub, parseGitHubUrl, isGitHubUrl } from "./github.js";
export { ingestLocal } from "./local.js";

export async function ingest(target: string): Promise<RawFile[]> {
  return isGitHubUrl(target) ? ingestGitHub(target) : ingestLocal(target);
}
