"use server";

import { greyStillEnabled, greyVideoEnabled, greyMatteEnabled, greyMatteEstimateUsd, GREY_GENERATION_HOLD } from "../server/grey-generation-policy";
import { runWorkflow } from "./workflow-actions";
import {runWithGreyCap} from "../server/grey-spending-live";
import {cookies} from "next/headers";
import {COMFY_COOKIE,LOCAL_COOKIE,keyIn} from "../server/keys";
import {userNow} from "../server/auth";
import {editEstimate} from "../providers/cloud-edits";
import {createGreyMediaConsent,type GreyMediaConsent,type GreyMediaKind} from "../server/grey-media-consent";
import {sharedGreyQuoteStore} from "../server/grey-quote-store";
import {platformOn} from "../server/platform";
import { runEdit, type EditResult } from "./actions";
import { normalizeScene, type GreyScene } from "../story/grey-scene";
import { createCloudRunner } from "../providers/cloud";
import { CONTROL_STRENGTH, GREY_SHOT_OUTPUT, GREY_SHOT_USD, greyShotWorkflow } from "../comfy/grey-shot";
import { tidy, type GreyFrame } from "../story/grey";
import { shotPrompt } from "../story/grey-control";
import { checkGenerationStorage } from "../server/generation-storage";
import { renderControlVideo } from "../server/grey-control-video";
import { keepResult } from "../server/keep";
import { readMedia } from "../server/media";
import { charged, comfyAccess } from "../server/platform";

export async function greyGenerationAvailability(){return {enabled:greyStillEnabled()||greyVideoEnabled(),still:greyStillEnabled(),video:greyVideoEnabled(),matte:greyMatteEnabled(),reason:GREY_GENERATION_HOLD};}
/** This restricted wrapper is the only paid still-image entry point used by Grey Room. */
export async function makeGreyFirstFrame(input:{frame:string;prompt:string;ratio:"9:16"|"16:9"},approval?:GreyMediaConsent):Promise<EditResult>{
  if(!greyStillEnabled())return {ok:false,reason:GREY_GENERATION_HOLD};
  const permit=await mediaConsent.consume("still",input,approval);if(!permit.ok)return permit;
  return runWithGreyCap("still",()=>runEdit({tool:"kontext",frame:input.frame,prompt:input.prompt,ratio:input.ratio}),editEstimate({tool:"kontext",seconds:0}));
}

export type GreyShot = { ok: true; url: string; usd: number; seconds: number } | { ok: false; reason: string; needsKey?: true };

/**
 * The grey blockout made into the finished shot. `frame` is the styled first frame (the "make it real" picture);
 * the blockout's camera move and figures become a control video the model follows. Open weights: no partner credits,
 * the GPU time is billed to the account. Never retried automatically.
 */
export async function makeGreyShot(input: { grey: GreyFrame; frame: string; beat: string; vertical: boolean; scene?: GreyScene | undefined },approval?:GreyMediaConsent): Promise<GreyShot> {
  if(!greyVideoEnabled())return {ok:false,reason:GREY_GENERATION_HOLD};
  const permit=await mediaConsent.consume("video",input,approval);if(!permit.ok)return permit;
  return runWithGreyCap("video",async()=>{
  const acc = await comfyAccess(GREY_SHOT_USD, "Grey Room shot", "Add a Comfy key to make the shot.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, async (key) => {
    try {
      const grey = tidy(input.grey);
      const first = await readMedia(input.frame).catch(() => null);
      if (!first) return { ok: false as const, reason: "The first frame couldn't be read. Make it real first." };
      const size = input.vertical ? { w: 704, h: 1280 } : { w: 1280, h: 704 };
      const scene = input.scene ? normalizeScene(input.scene) : undefined;
      const control = await renderControlVideo(grey, size, scene);
      const cloud = createCloudRunner({ apiKey: key, keep: keepResult, beforeRun: checkGenerationStorage, timeoutMs: 20 * 60_000 });
      const image = await cloud.uploadBytes(first.bytes, first.mime);
      const video = await cloud.uploadBytes(control.bytes, "video/mp4");
      const made = await cloud.run(greyShotWorkflow({ prompt: shotPrompt(input.beat, grey, scene), image, video, seed: Math.floor(Math.random() * 2_000_000_000), vertical: input.vertical, strength: grey.pose === "walk" ? CONTROL_STRENGTH.walk : CONTROL_STRENGTH.stand }), GREY_SHOT_OUTPUT);
      if (made.kind !== "video") return { ok: false as const, reason: "The model didn't return a video." };
      return { ok: true as const, url: made.url, usd: GREY_SHOT_USD, seconds: control.seconds };
    } catch (caught) {
      return { ok: false as const, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The shot didn't finish." };
    }
  });
  },GREY_SHOT_USD);
}

const mediaConsent=createGreyMediaConsent({
 store:sharedGreyQuoteStore(process.env),
 policy:kind=>({enabled:kind==='still'?greyStillEnabled():kind==='matte'?greyMatteEnabled():greyVideoEnabled(),estimateUsd:kind==='still'?editEstimate({tool:'kontext',seconds:0}):kind==='matte'?(greyMatteEstimateUsd()??0):GREY_SHOT_USD}),
 identity:async()=>{
  const jar=await cookies(),own=keyIn(jar,COMFY_COOKIE),user=await userNow();
  if(!own&&(!platformOn()||!user))return undefined;
  return {own:own??null,user:user?.id??null,local:jar.get(LOCAL_COOKIE)?.value??null,platform:own?null:process.env.COMFY_PLATFORM_KEY,gate:process.env.HAGGS_GATE??null};
 },
});
export async function quoteGreyMedia(kind:GreyMediaKind,input:unknown){return mediaConsent.quote(kind,input);}

/** The cut-out or area finder on Comfy Cloud. Same rules as the other paid Grey Room actions: switched on by the owner, an estimate you approve, held against your cap. */
export async function runGreyCloudMatte(input:{prompt:string;files:Record<string,string>},approval?:GreyMediaConsent){
  if(!greyMatteEnabled())return {ok:false as const,reason:"Cut-out on Comfy Cloud is not enabled. Use Your GPU or ask the site owner to turn it on."};
  const permit=await mediaConsent.consume("matte",input,approval);if(!permit.ok)return {ok:false as const,reason:permit.reason};
  return runWithGreyCap("matte",()=>runWorkflow({file:input.prompt,destination:"cloud"},{},input.files),greyMatteEstimateUsd());
}
