"use server";

import { readFile } from "node:fs/promises";
import { cookies } from "next/headers";

import { createCloudRunner } from "../providers/cloud";
import { watchVideoWorkflow } from "../providers/cloud-edits";
import { ANALYSIS_PROMPT, parseShots, type RefShot } from "../recreate/recreate";
import { fittedVideo } from "../server/video-fit";
import { COMFY_COOKIE, keyIn } from "../server/keys";
import { localFile } from "../server/local-media";
import { mediaAllowed, readMedia } from "../server/media";

export type Analysed = { ok: true; shots: RefShot[] } | { ok: false; reason: string; needsKey?: boolean };

/** A video model (Gemini, on Comfy) watches the reference edit and lists its shots. A few cents; never retried automatically. */
export async function analyzeEdit(url: string, seconds: number): Promise<Analysed> {
  const key = keyIn(await cookies(), COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to read an edit.", needsKey: true };
  if (!mediaAllowed(url)) return { ok: false, reason: "Add the video from your computer first." };
  if (!(seconds > 0 && seconds <= 180)) return { ok: false, reason: "Use a reference of up to three minutes." };
  try {
    const local = url.startsWith("/api/local/") ? localFile(process.env.HAGGS_LOCAL_MEDIA, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV) : null;
    if (url.startsWith("/api/local/") && !local) return { ok: false, reason: "That video isn't in the media folder." };
    const media = local ? { bytes: local.type.startsWith("video/") ? await fittedVideo(local.path) : new Uint8Array(await readFile(local.path)), mime: local.type } : await readMedia(url);
    const cloud = createCloudRunner({ apiKey: key, keep: async () => "", timeoutMs: 15 * 60_000 });
    const video = await cloud.uploadBytes(media.bytes, media.mime);
    const { text } = await cloud.runText(watchVideoWorkflow({ video, prompt: ANALYSIS_PROMPT }), "20");
    return { ok: true, shots: parseShots(text, seconds) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The edit couldn't be read." };
  }
}
