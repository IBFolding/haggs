"use server";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expandWords, parseSearch, pickFile, rankFound, searchUrl, type Found } from "../found/found";
import { hosted } from "../server/blob";
import { keepResult } from "../server/keep";

const run = promisify(execFile);
const HEADERS = { "user-agent": "haggs/1 (open-source film studio; found footage)" };

export type Searched = { ok: true; found: Found[] } | { ok: false; reason: string };
export type Kept = { ok: true; url: string; seconds: number } | { ok: false; reason: string };

/** Searches the Prelinger films on archive.org. A free public API: no key, nothing spent. */
export async function findFootage(words: string[]): Promise<Searched> {
  try {
    // Ask wide (any word, in any form), then put the scenes that fit best first: the archive alone returns the most watched.
    const ask = async (mode: "any" | "all" | "title", list: string[], rows: number) => {
      const res = await fetch(searchUrl(list, rows, mode), { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`The archive answered ${res.status}. Try again in a minute.`);
      return parseSearch(await res.json());
    };
    const exact = words.length > 1 ? await ask("all", words.slice(0, 3), 40) : [];
    const wide = expandWords(words);
    // Films with the word in their title, and the most-watched films that mention it anywhere.
    const [named, rest] = await Promise.all([ask("title", wide, 60), ask("any", wide, 100)]);
    const merged = [...new Map([...exact, ...named, ...rest].map((f) => [f.id, f])).values()];
    const ranked = rankFound(merged, words);
    if (!ranked.length) return { ok: false, reason: `Nothing in the archive matched ${words.slice(0, 4).join(", ")}. The Prelinger films are mostly mid-century: try plainer words like "car", "factory", "kitchen", "school".` };
    return { ok: true, found: ranked.slice(0, 24) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The archive couldn't be reached." };
  }
}

/** Keeps one scene in the local media folder so it can be restyled and rendered. Only archive.org links are fetched. Development only. */
export async function keepFootage(id: string): Promise<Kept> {
  if (!/^[A-Za-z0-9._-]{2,120}$/.test(id)) return { ok: false, reason: "That isn't an archive item." };
  try {
    const meta = await fetch(`https://archive.org/metadata/${id}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
    const file = meta.ok ? pickFile(id, await meta.json()) : null;
    if (!file) return { ok: false, reason: "This film has no web-sized copy to keep. Pick another." };
    const res = await fetch(file.url, { headers: HEADERS, signal: AbortSignal.timeout(5 * 60_000) });
    if (!res.ok || !new URL(res.url).hostname.endsWith("archive.org")) return { ok: false, reason: "The archive wouldn't serve that file." };
    const url = await keepResult(new Uint8Array(await res.arrayBuffer()), "mp4");
    let seconds = 5;
    if (hosted()) return { ok: true, url, seconds };
    try {
      const root = process.env.HAGGS_LOCAL_MEDIA!;
      const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `${root}/${url.slice("/api/local/".length)}`]);
      seconds = Math.max(1, Math.min(8, Number(stdout.trim()) || 5));
    } catch {
      /* no ffprobe: five seconds is a fair first guess */
    }
    return { ok: true, url, seconds };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The scene couldn't be kept." };
  }
}
