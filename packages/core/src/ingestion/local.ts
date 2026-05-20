import { promises as fs } from "node:fs";
import path from "node:path";
import { detectLanguage, isExcludedPath, type RawFile } from "./types.js";

const MAX_FILE_BYTES = 1_000_000;

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

async function walk(root: string, current: string, out: RawFile[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const abs = path.join(current, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (isExcludedPath(rel)) continue;

    if (entry.isDirectory()) {
      await walk(root, abs, out);
      continue;
    }

    if (!entry.isFile()) continue;

    let stat: import("node:fs").Stats;
    try {
      stat = await fs.lstat(abs);
    } catch {
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) continue;

    let buf: Buffer;
    try {
      buf = await fs.readFile(abs);
    } catch {
      continue;
    }
    if (looksBinary(buf)) continue;

    out.push({
      path: rel,
      content: buf.toString("utf8"),
      language: detectLanguage(rel),
      size: stat.size,
    });
  }
}

export async function ingestLocal(target: string): Promise<RawFile[]> {
  const root = path.resolve(target);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    throw new Error(`Local ingestion target is not a directory: ${root}`);
  }
  const out: RawFile[] = [];
  await walk(root, root, out);
  return out;
}
