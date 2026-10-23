import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { Cut } from "../story/cut";
import { isBlobUrl } from "./blob";

/**
 * Rendering on a deployment: the cut's files live in the app's store, so each
 * is fetched once into a scratch folder and the cut is pointed at those
 * copies. After that it is the same render as on a developer's machine.
 */
export async function stageHosted(cut: Cut, scratch: string): Promise<Cut> {
  const media = join(scratch, "media");
  await mkdir(media, { recursive: true });
  const seen = new Map<string, string>();
  const stage = async (url: string): Promise<string> => {
    const found = seen.get(url);
    if (found) return found;
    if (!isBlobUrl(url)) throw new Error("A file in the cut isn't in this app's store.");
    const ext = (extname(new URL(url).pathname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin").slice(0, 8);
    const name = `m${seen.size + 1}${ext}`;
    const got = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(120_000) });
    if (!got.ok) throw new Error("A file in the cut couldn't be fetched from the store.");
    await writeFile(join(media, name), new Uint8Array(await got.arrayBuffer()));
    const local = `/api/local/media/${name}`;
    seen.set(url, local);
    return local;
  };
  const clips = [];
  for (const c of cut.clips) clips.push({ ...c, url: await stage(c.url) });
  const voices = [];
  for (const v of cut.voices) voices.push({ ...v, url: await stage(v.url) });
  const effects = [];
  for (const e of cut.effects ?? []) effects.push({ ...e, url: await stage(e.url) });
  const overlays = [];
  for (const o of cut.overlays ?? []) overlays.push({ ...o, url: await stage(o.url) });
  const music = cut.music ? { ...cut.music, url: await stage(cut.music.url) } : null;
  return { ...cut, clips, voices, music, ...(effects.length ? { effects } : {}), ...(overlays.length ? { overlays } : {}) };
}

export const readRendered = (path: string) => readFile(path);
