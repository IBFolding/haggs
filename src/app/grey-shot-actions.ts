"use server";

import { createCloudRunner } from "../providers/cloud";
import { GREY_SHOT_OUTPUT, GREY_SHOT_USD, greyShotWorkflow } from "../comfy/grey-shot";
import { tidy, type GreyFrame } from "../story/grey";
import { shotPrompt } from "../story/grey-control";
import { checkGenerationStorage } from "../server/generation-storage";
import { renderControlVideo } from "../server/grey-control-video";
import { keepResult } from "../server/keep";
import { readMedia } from "../server/media";
import { charged, comfyAccess } from "../server/platform";

export type GreyShot = { ok: true; url: string; usd: number; seconds: number } | { ok: false; reason: string; needsKey?: true };

/**
 * The grey blockout made into the finished shot. `frame` is the styled first frame (the "make it real" picture);
 * the blockout's camera move and figures become a control video the model follows. Open weights: no partner credits,
 * the GPU time is billed to the account. Never retried automatically.
 */
export async function makeGreyShot(input: { grey: GreyFrame; frame: string; beat: string; vertical: boolean }): Promise<GreyShot> {
  const acc = await comfyAccess(GREY_SHOT_USD, "Grey Room shot", "Add a Comfy key to make the shot.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, async (key) => {
    try {
      const grey = tidy(input.grey);
      const first = await readMedia(input.frame).catch(() => null);
      if (!first) return { ok: false as const, reason: "The first frame couldn't be read. Make it real first." };
      const size = input.vertical ? { w: 704, h: 1280 } : { w: 1280, h: 704 };
      const control = await renderControlVideo(grey, size);
      const cloud = createCloudRunner({ apiKey: key, keep: keepResult, beforeRun: checkGenerationStorage, timeoutMs: 20 * 60_000 });
      const image = await cloud.uploadBytes(first.bytes, first.mime);
      const video = await cloud.uploadBytes(control.bytes, "video/mp4");
      const made = await cloud.run(greyShotWorkflow({ prompt: shotPrompt(input.beat, grey), image, video, seed: Math.floor(Math.random() * 2_000_000_000), vertical: input.vertical }), GREY_SHOT_OUTPUT);
      if (made.kind !== "video") return { ok: false as const, reason: "The model didn't return a video." };
      return { ok: true as const, url: made.url, usd: GREY_SHOT_USD, seconds: control.seconds };
    } catch (caught) {
      return { ok: false as const, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The shot didn't finish." };
    }
  });
}
