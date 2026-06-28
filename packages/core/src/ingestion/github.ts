import { Buffer } from "node:buffer";
import { detectLanguage, isExcludedPath, type RawFile } from "./types.js";

const GITHUB_API = "https://api.github.com";

interface ParsedRepo {
  owner: string;
  repo: string;
}

// GitHub login: alphanumerics + single hyphens, ≤39 chars.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// Repo name: alphanumerics, dot, underscore, hyphen — but never "." or ".."
// (which would let a crafted URL traverse to other api.github.com endpoints).
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function validateRepo(owner: string, repo: string): ParsedRepo {
  if (!OWNER_RE.test(owner)) throw new Error(`Invalid GitHub owner: ${JSON.stringify(owner)}`);
  if (!REPO_RE.test(repo) || repo === "." || repo === "..") {
    throw new Error(`Invalid GitHub repo name: ${JSON.stringify(repo)}`);
  }
  return { owner, repo };
}

export function parseGitHubUrl(url: string): ParsedRepo {
  const trimmed = url.trim().replace(/\.git$/, "");
  const ssh = /^git@github\.com:([^/]+)\/(.+)$/.exec(trimmed);
  if (ssh) return validateRepo(ssh[1]!, ssh[2]!);
  const https = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/.exec(trimmed);
  if (https) return validateRepo(https[1]!, https[2]!);
  throw new Error(`Not a recognizable GitHub URL: ${url}`);
}

export function isGitHubUrl(target: string): boolean {
  return /^(https?:\/\/github\.com\/|git@github\.com:)/.test(target.trim());
}

interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
}

interface TreeResponse {
  sha: string;
  tree: TreeEntry[];
  truncated: boolean;
}

interface RepoResponse {
  default_branch: string;
}

interface BlobResponse {
  content: string;
  encoding: "base64" | "utf-8";
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repograph-core",
  };
  const token = process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"];
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const hasToken = (): boolean => !!(process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"]);

async function ghJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: authHeaders() });
  } catch (err) {
    throw new Error(`Network error reaching GitHub (${url}): ${(err as Error).message}`);
  }
  if (!res.ok) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (res.status === 404) {
      throw new Error(
        `GitHub repo or path not found (404). Check the URL is correct and public${
          hasToken() ? "" : ", or set GITHUB_TOKEN for private repos"
        }.`,
      );
    }
    if (res.status === 403 && remaining === "0") {
      throw new Error(
        `GitHub API rate limit exceeded (403).${
          hasToken() ? " Wait for the limit to reset." : " Set GITHUB_TOKEN/GH_TOKEN to raise the limit from 60 to 5000 requests/hour."
        }`,
      );
    }
    if (res.status === 401) {
      throw new Error("GitHub authentication failed (401). Check that GITHUB_TOKEN/GH_TOKEN is valid.");
    }
    const body = (await res.text()).slice(0, 300);
    throw new Error(`GitHub API ${res.status} for ${url}: ${body}`);
  }
  return (await res.json()) as T;
}

// owner/repo are validated by parseGitHubUrl; encode anyway so they can never
// alter the request path. ref/sha come from GitHub's own API responses.
const enc = encodeURIComponent;

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const meta = await ghJson<RepoResponse>(`${GITHUB_API}/repos/${enc(owner)}/${enc(repo)}`);
  return meta.default_branch;
}

async function getTree(owner: string, repo: string, ref: string): Promise<TreeResponse> {
  return ghJson<TreeResponse>(
    `${GITHUB_API}/repos/${enc(owner)}/${enc(repo)}/git/trees/${enc(ref)}?recursive=1`,
  );
}

async function getBlobContent(owner: string, repo: string, sha: string): Promise<string> {
  const blob = await ghJson<BlobResponse>(
    `${GITHUB_API}/repos/${enc(owner)}/${enc(repo)}/git/blobs/${enc(sha)}`,
  );
  if (blob.encoding === "base64") return Buffer.from(blob.content, "base64").toString("utf8");
  return blob.content;
}

const BATCH_SIZE = 16;
const MAX_FILE_BYTES = 1_000_000;

async function batched<I, O>(items: I[], size: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.all(slice.map(fn));
    out.push(...results);
  }
  return out;
}

export async function ingestGitHub(url: string): Promise<RawFile[]> {
  const { owner, repo } = parseGitHubUrl(url);
  const branch = await getDefaultBranch(owner, repo);
  const tree = await getTree(owner, repo, branch);
  if (tree.truncated) {
    console.warn(`[repograph] GitHub tree for ${owner}/${repo} was truncated — large repo, partial results.`);
  }

  const blobs = tree.tree.filter(
    (e) =>
      e.type === "blob" &&
      !isExcludedPath(e.path) &&
      (e.size ?? 0) <= MAX_FILE_BYTES,
  );

  const settled = await batched(blobs, BATCH_SIZE, async (entry): Promise<RawFile | null> => {
    try {
      const content = await getBlobContent(owner, repo, entry.sha);
      return {
        path: entry.path,
        content,
        language: detectLanguage(entry.path),
        size: entry.size ?? Buffer.byteLength(content, "utf8"),
      };
    } catch (err) {
      console.warn(`[repograph] skipped ${entry.path}: ${(err as Error).message}`);
      return null;
    }
  });

  return settled.filter((f): f is RawFile => f !== null);
}
