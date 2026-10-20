import { existsSync, realpathSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

/**
 * Plays files from one folder on this machine, for development only.
 *
 * Private footage — an unreleased series, a client's rushes — should be
 * watchable in the app without being copied into the repo or uploaded
 * anywhere. This serves exactly one folder (HAGGS_LOCAL_MEDIA), only media
 * and haggs project files, never in production, and refuses any path or
 * symlink that resolves outside that folder.
 */

const TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export type LocalFile = { path: string; type: string; size: number };

export function localFile(root: string | undefined, segments: string[], env: string | undefined): LocalFile | null {
  if (env === "production" || !root) return null;
  const name = segments.join("/");
  const type = name.endsWith(".haggs.json") ? "application/json" : TYPES[extname(name).toLowerCase()];
  if (!type) return null;
  const base = resolve(root);
  const wanted = resolve(base, ...segments);
  if (wanted !== base && !wanted.startsWith(base + sep)) return null;
  if (!existsSync(wanted)) return null;
  // Resolve links last: a link inside the folder may still point outside it.
  const real = realpathSync(wanted);
  const realBase = realpathSync(base);
  if (!real.startsWith(realBase + sep)) return null;
  const stat = statSync(real);
  if (!stat.isFile()) return null;
  return { path: real, type, size: stat.size };
}

export function localUrl(...segments: string[]): string {
  return "/api/local/" + segments.map(encodeURIComponent).join("/");
}

export function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from, to] = match;
  let start: number;
  let end: number;
  if (!from) {
    start = Math.max(0, size - Number(to));
    end = size - 1;
  } else {
    start = Number(from);
    end = to ? Math.min(Number(to), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}


/**
 * Remote models cannot reach this machine, so a local media URL is read here
 * and sent as a data URI. Public URLs and data URIs pass through unchanged.
 */
export async function inlineLocal(urls: string[], root: string | undefined, env: string | undefined): Promise<string[]> {
  const { readFile } = await import("node:fs/promises");
  return Promise.all(
    urls.map(async (url) => {
      if (!url.startsWith("/api/local/")) return url;
      const segments = url.slice("/api/local/".length).split("/").map(decodeURIComponent);
      const file = localFile(root, segments, env);
      if (!file || file.type === "application/json") throw new Error("A local picture on this shot can't be sent to the model.");
      return `data:${file.type};base64,${(await readFile(file.path)).toString("base64")}`;
    }),
  );
}
