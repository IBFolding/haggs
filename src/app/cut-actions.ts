"use server";

import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { localFile, localUrl } from "../server/local-media";

const run = promisify(execFile);

/**
 * One frame of a take, kept as a picture: what a bridge starts or ends on.
 * Pictures are their own frame. Development only: it reads the local media
 * folder with ffmpeg.
 */
export async function frameAt(url: string, at: number, kind: "image" | "video"): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (kind === "image") return { ok: true, url };
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root || process.env.NODE_ENV === "production") return { ok: false, reason: "Taking a frame needs the local media folder (development)." };
  if (!url.startsWith("/api/local/")) return { ok: false, reason: "Only takes on this machine can give a frame here." };
  if (!Number.isFinite(at) || at < 0 || at > 7200) return { ok: false, reason: "That moment isn't in the take." };
  const file = localFile(root, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
  if (!file) return { ok: false, reason: "That take isn't in the local media folder." };
  const name = `${new Date().toISOString().slice(0, 10)}-frame-${crypto.randomUUID().slice(0, 8)}.png`;
  await mkdir(join(root, "haggs-renders"), { recursive: true });
  const out = join(root, "haggs-renders", name);
  const made = () => stat(out).then((s) => s.size > 0, () => false);
  try {
    await run("ffmpeg", ["-loglevel", "error", "-y", "-ss", String(at), "-i", file.path, "-frames:v", "1", out]);
  } catch {
    // Read below with the fallback.
  }
  // Past the last frame ffmpeg writes nothing: take the very last frame there is.
  if (!(await made())) await run("ffmpeg", ["-loglevel", "error", "-y", "-sseof", "-0.1", "-i", file.path, "-update", "1", "-frames:v", "1", out]).catch(() => undefined);
  return (await made()) ? { ok: true, url: localUrl("haggs-renders", name) } : { ok: false, reason: "ffmpeg couldn't read a frame from that take." };
}
