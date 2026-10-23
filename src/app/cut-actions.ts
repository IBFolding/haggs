"use server";

import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import { createCloudRunner } from "../providers/cloud";
import { flux3Workflow } from "../providers/cloud-edits";
import { reshootPrompt, type AngleId } from "../story/reshoot";
import { keepResult } from "../server/keep";
import { COMFY_COOKIE, keyIn } from "../server/keys";
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

export type Reshot = { ok: true; url: string; usd: number } | { ok: false; reason: string; needsKey?: boolean };

/** The same scene from a new angle: a frame of the shot is the reference for a FLUX 3 still. Never retried automatically. */
export async function reshoot(url: string, at: number, kind: "image" | "video", angle: AngleId, beat: string): Promise<Reshot> {
  const key = keyIn(await cookies(), COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to reshoot.", needsKey: true };
  try {
    const frame = await frameAt(url, at, kind);
    if (!frame.ok) return frame;
    const prompt = reshootPrompt(angle, beat);
    const { readFile } = await import("node:fs/promises");
    const file = localFile(process.env.HAGGS_LOCAL_MEDIA, frame.url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
    if (!file) return { ok: false, reason: "That shot's picture isn't in the local media folder." };
    const cloud = createCloudRunner({ apiKey: key, keep: keepResult });
    const uploaded = await cloud.uploadBytes(new Uint8Array(await readFile(file.path)), file.type);
    const result = await cloud.run(flux3Workflow({ prompt, references: [uploaded], ratio: "16:9", resolution: "1.5K", seed: Math.floor(Math.random() * 2_000_000_000) }));
    return { ok: true, url: result.url, usd: 0.1001 };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The reshoot didn't run." };
  }
}
