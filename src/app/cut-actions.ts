"use server";
import { checkGenerationStorage } from "../server/generation-storage";

import { partnerRefusal } from "../server/open-only";
import { extractTerminalFrame } from "../server/terminal-frame";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import { createCloudRunner } from "../providers/cloud";
import { flux3Workflow } from "../providers/cloud-edits";
import { OPEN_RESHOOT, reshootPrompt, toCameraAngle, type Camera } from "../story/reshoot";
import { runWorkflow } from "./workflow-actions";
import { hosted, isBlobUrl, putBlob } from "../server/blob";
import { charged, comfyAccess } from "../server/platform";
import { ffmpegBin } from "../server/ffmpeg";
import { keepResult } from "../server/keep";
import { readMedia } from "../server/media";
import { COMFY_COOKIE, keyIn } from "../server/keys";
import { localFile, localUrl } from "../server/local-media";

const run = promisify(execFile);

/** A frame of a take kept in the app's file store. The take is fetched to a scratch file and ffmpeg (shipped with the build) reads it there. */
async function hostedFrame(url: string, at: number): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!isBlobUrl(url)) return { ok: false, reason: "Only takes in this app's store can give a frame." };
  if (!Number.isFinite(at) || at < 0 || at > 7200) return { ok: false, reason: "That moment isn't in the take." };
  const dir = await mkdtemp(join(tmpdir(), "haggs-frame-"));
  try {
    const src = join(dir, "take.mp4");
    await writeFile(src, (await readMedia(url)).bytes);
    const out = join(dir, "frame.png");
    const ff = ffmpegBin();
    await run(ff, ["-loglevel", "error", "-y", "-ss", String(at), "-i", src, "-frames:v", "1", out]).catch(() => undefined);
    // Past the last frame ffmpeg writes nothing: take the very last frame there is.
    if (!(await stat(out).then((s) => s.size > 0, () => false))) await run(ff, ["-loglevel", "error", "-y", "-sseof", "-0.1", "-i", src, "-update", "1", "-frames:v", "1", out]).catch(() => undefined);
    const bytes = await readFile(out).catch(() => null);
    return bytes ? { ok: true, url: await putBlob(new Uint8Array(bytes), "png", "frames") } : { ok: false, reason: "ffmpeg couldn't read a frame from that take." };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * One frame of a take, kept as a picture: what a bridge starts or ends on.
 * Pictures are their own frame. Development only: it reads the local media
 * folder with ffmpeg.
 */
export async function frameAt(url: string, at: number, kind: "image" | "video"): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (kind === "image") return { ok: true, url };
  if (hosted()) return hostedFrame(url, at);
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

export type Reshot = { ok: true; url: string; source: string; usd: number } | { ok: false; reason: string; needsKey?: boolean };

/** The same scene from a new angle: a frame of the shot is the reference for a FLUX 3 still. Never retried automatically. */
export async function reshoot(url: string, at: number, kind: "image" | "video", move: Camera, beat: string): Promise<Reshot> {
  { const refused = await partnerRefusal(); if (refused) return { ok: false, reason: refused }; }
  const own = keyIn(await cookies(), COMFY_COOKIE);
  if (own) return reshootWith(own, url, at, kind, move, beat);
  const acc = await comfyAccess(0.1001, "Reshoot", "Add a Comfy key to reshoot.");
  if (!acc.ok) return { ok: false, reason: acc.reason, ...(acc.needsKey ? { needsKey: true as const } : {}) };
  return charged(acc, (key) => reshootWith(key, url, at, kind, move, beat));
}

async function reshootWith(key: string, url: string, at: number, kind: "image" | "video", move: Camera, beat: string): Promise<Reshot> {
  try {
    const frame = await frameAt(url, at, kind);
    if (!frame.ok) return frame;
    const prompt = reshootPrompt({ az: Number(move.az) || 0, el: Number(move.el) || 0, zoom: Number(move.zoom) || 0 }, beat);
    const picture = await readMedia(frame.url).catch(() => null);
    if (!picture) return { ok: false, reason: "That shot's picture couldn't be read." };
    const cloud = createCloudRunner({ apiKey: key, keep: keepResult, beforeRun: checkGenerationStorage });
    const uploaded = await cloud.uploadBytes(picture.bytes, picture.mime);
    const result = await cloud.run(flux3Workflow({ prompt, references: [uploaded], ratio: "16:9", resolution: "1.5K", seed: Math.floor(Math.random() * 2_000_000_000) }));
    return { ok: true, url: result.url, source: frame.url, usd: 0.1001 };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "The reshoot didn't run." };
  }
}

/**
 * The same reshoot on open weights: Comfy's Qwen-Image-Edit multi-angle
 * workflow, driven by the dial's angle, height and zoom. It runs on Comfy
 * Cloud's GPUs, so it is billed as GPU time on your plan rather than at a
 * per-picture price Comfy publishes. Never retried automatically.
 */
export async function reshootOpen(url: string, at: number, kind: "image" | "video", move: Camera): Promise<Reshot> {
  const frame = await frameAt(url, at, kind);
  if (!frame.ok) return frame;
  const angle = toCameraAngle({ az: Number(move.az) || 0, el: Number(move.el) || 0, zoom: Number(move.zoom) || 0 });
  const r = await runWorkflow(
    { template: OPEN_RESHOOT.template },
    { [`${OPEN_RESHOOT.node}/horizontal_angle`]: angle.horizontal_angle, [`${OPEN_RESHOOT.node}/vertical_angle`]: angle.vertical_angle, [`${OPEN_RESHOOT.node}/zoom`]: angle.zoom },
    { [OPEN_RESHOOT.image]: frame.url },
  );
  if (!r.ok) return r;
  if (r.kind !== "image") return { ok: false, reason: "The multi-angle workflow didn't return a picture." };
  return { ok: true, url: r.url, source: frame.url, usd: 0 };
}

/** A title card as a picture in the local media folder: words on black at the cut's frame shape. Development only; it writes to the media folder. */
export async function makeCard(text: string, sub: string, aspect: "16:9" | "9:16"): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!text.trim()) return { ok: false, reason: "Write the words for the card first." };
  try {
    const sharp = (await import("sharp")).default;
    const { cardSize, cardSvg } = await import("../story/card");
    const { keepResult } = await import("../server/keep");
    const png = await sharp(Buffer.from(cardSvg(text, sub, cardSize(aspect)))).png().toBuffer();
    return { ok: true, url: await keepResult(new Uint8Array(png), "png") };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The card couldn't be made." };
  }
}

/** Words on a transparent picture in the local media folder, to lay over the film as a timed title. Development only. */
export async function makeTitle(text: string, place: "center" | "lower" | "top", aspect: "16:9" | "9:16"): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!text.trim()) return { ok: false, reason: "Write the words for the title first." };
  try {
    const sharp = (await import("sharp")).default;
    const { cardSize, titleSvg } = await import("../story/card");
    const { keepResult } = await import("../server/keep");
    const png = await sharp(Buffer.from(titleSvg(text.slice(0, 200), place, cardSize(aspect)))).png().toBuffer();
    return { ok: true, url: await keepResult(new Uint8Array(png), "png") };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The title couldn't be made." };
  }
}

/** Extract the actual final decoded frame of the selected, trimmed clip. No generation. */
export async function terminalFrame(url:string, from:number, seconds:number):Promise<{ok:true;url:string}|{ok:false;reason:string}> {
 if(!Number.isFinite(from)||from<0||from>7200||!Number.isFinite(seconds)||seconds<=0||seconds>120) return {ok:false,reason:"Choose a clip between 0 and 120 seconds with a valid trim."};
 const dir=await mkdtemp(join(tmpdir(),"haggs-terminal-"));
 try {
   let src:string;
   if(hosted()) {
     if(!isBlobUrl(url))return {ok:false,reason:"This clip must be in the app’s media store before a frame can be extracted."};
     src=join(dir,"source.mp4");await writeFile(src,(await readMedia(url)).bytes);
   } else {
     const root=process.env.HAGGS_LOCAL_MEDIA;
     if(!root||process.env.NODE_ENV==="production"||!url.startsWith("/api/local/")) return {ok:false,reason:"Local extraction needs a video in the configured local media folder."};
     const file=localFile(root,url.slice("/api/local/".length).split("/").map(decodeURIComponent),process.env.NODE_ENV);
     if(!file)return {ok:false,reason:"That clip is not in the configured local media folder."};src=file.path;
   }
   const out=join(dir,"last.png");
   // image2 update overwrites one output for each decoded frame: the final file
   // is the actual last frame inside the selected range, not a midpoint proxy.
   await extractTerminalFrame(ffmpegBin(),src,out,from,seconds);
   const bytes=await readFile(out);return {ok:true,url:`data:image/png;base64,${bytes.toString("base64")}`};
 }catch{return {ok:false,reason:"The selected clip’s final frame could not be decoded. Your existing media is unchanged."};}
 finally{await rm(dir,{recursive:true,force:true});}
}
