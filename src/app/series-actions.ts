"use server";

import { cookies } from "next/headers";

import { createCloudRunner } from "../providers/cloud";
import { editEstimate, flux3Workflow } from "../providers/cloud-edits";
import { keepResult } from "../server/keep";
import { CLAUDE_COOKIE, COMFY_COOKIE, keyIn } from "../server/keys";
import { FORMATS, SERIES_SCHEMA, seriesRequest, validateSeries, type FormatId, type Series } from "../series/series";
import { askClaude } from "../writer/draft";

/** Claude writes the series: episodes of shots with the picture to make and the words on screen. Never retried automatically. */
export async function draftSeries(format: FormatId, topic: string, count: number): Promise<{ ok: true; series: Series } | { ok: false; reason: string; needsKey?: boolean }> {
  const key = keyIn(await cookies(), CLAUDE_COOKIE);
  if (!key) return { ok: false, reason: "Add a Claude key to write a series.", needsKey: true };
  if (!FORMATS.some((f) => f.id === format)) return { ok: false, reason: "Pick a format for the series." };
  let request;
  try {
    request = seriesRequest(format, topic.slice(0, 1000), count);
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That can't be written." };
  }
  const result = await askClaude<Series>({ key, request, schema: SERIES_SCHEMA, read: validateSeries });
  return result.ok ? { ok: true, series: result.draft } : { ok: false, reason: result.reason };
}

export const priceOfStill = async (resolution: "1K" | "1.5K" = "1K") => editEstimate({ tool: "flux3", seconds: 0, resolution });

export type MadeStill = { ok: true; url: string } | { ok: false; reason: string; needsKey?: boolean };

/** One picture for a shot, from its beat, at the board's frame shape. Never retried automatically. */
export async function makeStill(prompt: string, ratio: "16:9" | "9:16", references: string[] = [], finish = "Cinematic, natural, no text, no watermark."): Promise<MadeStill> {
  const key = keyIn(await cookies(), COMFY_COOKIE);
  if (!key) return { ok: false, reason: "Add a Comfy key to make pictures.", needsKey: true };
  if (prompt.trim().length < 4) return { ok: false, reason: "Give the shot a description first." };
  try {
    const cloud = createCloudRunner({ apiKey: key, keep: keepResult });
    const { readFile } = await import("node:fs/promises");
    const { localFile } = await import("../server/local-media");
    const uploaded: string[] = [];
    for (const ref of references.slice(0, 4)) {
      const photo = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(ref);
      if (photo) {
        uploaded.push(await cloud.uploadBytes(Uint8Array.from(Buffer.from(photo[2]!, "base64")), photo[1]!));
        continue;
      }
      const file = ref.startsWith("/api/local/") ? localFile(process.env.HAGGS_LOCAL_MEDIA, ref.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV) : null;
      if (file) uploaded.push(await cloud.uploadBytes(new Uint8Array(await readFile(file.path)), file.type));
    }
    const result = await cloud.run(flux3Workflow({ prompt: `${prompt.trim().slice(0, 2000)} ${finish.slice(0, 300)}`, references: uploaded, ratio, resolution: "1K", seed: Math.floor(Math.random() * 2_000_000_000) }));
    return { ok: true, url: result.url };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The picture wasn't made." };
  }
}
