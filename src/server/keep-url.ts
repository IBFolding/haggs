import type { Kept } from "../providers/cloud";

/** The extension a kept result is saved under: what the file says it is, else what it was asked for. */
export function keptExtension(contentType: string, kind: "image" | "video"): Kept {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "video/webm") return "webm";
  if (type === "video/mp4") return "mp4";
  return kind === "video" ? "mp4" : "png";
}

/** Whether a provider's link is safe to copy: an outside https address, never this machine or a private network. */
export function mayFetchForKeeping(link: string): boolean {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host.includes(":")) return false;
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
    const [a, b] = parts as [number, number, number, number];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}
