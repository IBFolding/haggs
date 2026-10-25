"use server";

import { cookies } from "next/headers";

import { createCloudRunner, type Kept } from "../providers/cloud";
import { keepResult } from "../server/keep";
import { COMFY_COOKIE, keyIn } from "../server/keys";

/**
 * Brings back renders you made earlier, from your own Comfy account. It only
 * reads your finished jobs; nothing is generated and nothing is charged. Only
 * your own key works here, never a plan's shared one, so nobody can list jobs
 * that aren't theirs.
 */

export type Recoverable = { job: string; at: number; filename: string; subfolder: string; kind: "image" | "video" | "audio"; preview: string | null };
const kindOf = (name: string): Recoverable["kind"] => (/\.(mp4|webm)$/i.test(name) ? "video" : /\.(mp3|wav|flac)$/i.test(name) ? "audio" : "image");
const ok = { filename: /^[-\w.]{1,200}$/, subfolder: /^[-\w/]{0,100}$/ };

async function runner() {
  const key = keyIn(await cookies(), COMFY_COOKIE);
  return key ? createCloudRunner({ apiKey: key, keep: keepResult }) : null;
}

export async function listComfyRenders(): Promise<{ ok: true; items: Recoverable[] } | { ok: false; reason: string; needsKey?: boolean }> {
  const cloud = await runner();
  if (!cloud) return { ok: false, reason: "Add your own Comfy key (the key chip in the header) to bring back renders from your Comfy account.", needsKey: true };
  try {
    const files = await cloud.recent(40);
    const good = files.filter((f) => ok.filename.test(f.filename) && ok.subfolder.test(f.subfolder) && !f.subfolder.includes(".."));
    const items: Recoverable[] = [];
    for (let i = 0; i < good.length; i += 6) {
      items.push(...(await Promise.all(good.slice(i, i + 6).map(async (f) => ({ ...f, kind: kindOf(f.filename), preview: await cloud.signed(f) })))));
    }
    return { ok: true, items };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "Your Comfy account couldn't be read." };
  }
}

export async function recoverComfyRender(file: { filename: string; subfolder: string }): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const cloud = await runner();
  if (!cloud) return { ok: false, reason: "Add your own Comfy key first." };
  if (!ok.filename.test(file.filename) || !ok.subfolder.test(file.subfolder) || file.subfolder.includes("..")) return { ok: false, reason: "That file name isn't one haggs can fetch." };
  try {
    const bytes = await cloud.fetchOutput(file);
    const ext = file.filename.split(".").pop()!.toLowerCase().replace("jpeg", "jpg") as Kept;
    return { ok: true, url: await keepResult(bytes, ext) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message.replace(/^\[comfy-cloud\] /, "") : "That render couldn't be fetched." };
  }
}
