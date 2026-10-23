import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Cut } from "../story/cut";
import { MAX_FILE_BYTES, stageHosted } from "./render-hosted";

const URL_A = "https://abc.public.blob.vercel-storage.com/haggs/guest/results/a.mp4";
const URL_B = "https://abc.public.blob.vercel-storage.com/haggs/guest/results/b.mp4";
const clip = (url: string, i: number) => ({ shotId: String(i), index: i, heading: "", url, kind: "video" as const, start: i * 2, from: 0, seconds: 2 });
const cutOf = (...urls: string[]): Cut => ({ clips: urls.map(clip), total: urls.length * 2, voices: [], music: null, aspect: "16:9", skipped: [] });
const reply = (n: number, said = n) => async () => new Response(new Uint8Array(n), { headers: { "content-length": String(said) } });

async function scratch<T>(run: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "haggs-test-"));
  try { return await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("each store file is fetched once and the cut points at the local copies", () =>
  scratch(async (dir) => {
    let calls = 0;
    const staged = await stageHosted(cutOf(URL_A, URL_B, URL_A), dir, (async () => (calls += 1, new Response(new Uint8Array(10)))) as typeof fetch);
    assert.equal(calls, 2);
    assert.deepEqual(staged.clips.map((c) => c.url), ["/api/local/media/m1.mp4", "/api/local/media/m2.mp4", "/api/local/media/m1.mp4"]);
  }));

test("only this app's own store is fetched", () =>
  scratch(async (dir) => {
    await assert.rejects(stageHosted(cutOf("https://evil.test/x.mp4"), dir, reply(1) as typeof fetch), /isn't in this app's store/);
  }));

test("a file that says it is huge, or turns out to be, is refused before it fills the disk", () =>
  scratch(async (dir) => {
    await assert.rejects(stageHosted(cutOf(URL_A), dir, reply(10, MAX_FILE_BYTES + 1) as typeof fetch), /too big/);
    await assert.rejects(stageHosted(cutOf(URL_A, URL_B), dir, reply(60) as typeof fetch, { file: 100, total: 100 }), /too big/, "the total is capped too");
    await assert.rejects(stageHosted(cutOf(URL_A), dir, reply(500, 10) as typeof fetch, { file: 100, total: 1000 }), /too big/, "a file bigger than it said is caught after it arrives");
  }));
