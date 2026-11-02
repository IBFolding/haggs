/** Stable, same-origin media URLs. No credentials or signed storage URLs are saved in projects. */
const PREFIX = "/api/media/";
const PATH = /^haggs\/u-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/;
export function privateMediaPath(url: string): { path: string; owner: string } | null {
  if (!url.startsWith(PREFIX) || url.length > 1500) return null;
  const path = url.slice(PREFIX.length);
  const match = PATH.exec(path);
  if (!match || path.split("/").some(p => p === "." || p === "..")) return null;
  return { path, owner: match[1]! };
}
export function privateMediaUrl(path: string): string {
  const url = PREFIX + path;
  if (!privateMediaPath(url)) throw new Error("Invalid private media path.");
  return url;
}
