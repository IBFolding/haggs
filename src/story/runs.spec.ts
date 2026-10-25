import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryKv } from "./kv";
import { createRunStore, type NewRun } from "./runs";

const made = (over: Partial<NewRun> = {}): NewRun => ({
  modelId: "fal-ai/flux/schnell",
  modelName: "FLUX.1 Schnell",
  prompt: "a wet neon alley",
  settings: { imageSize: "square_hd" },
  url: `https://example.test/${Math.random()}.png`,
  kind: "image",
  usd: 0.003,
  ...over,
});

test("a recorded run comes back from list", async () => {
  const runs = createRunStore(memoryKv());
  await runs.record(made({ prompt: "one" }));
  const all = await runs.list();
  assert.equal(all.length, 1);
  assert.equal(all[0]!.prompt, "one");
  assert.ok(all[0]!.id);
  assert.ok(all[0]!.at > 0);
});

test("list returns newest first", async () => {
  const runs = createRunStore(memoryKv());
  await runs.record(made({ prompt: "first" }));
  await runs.record(made({ prompt: "second" }));
  assert.deepEqual((await runs.list()).map((r) => r.prompt), ["second", "first"]);
});

test("the cap drops the oldest runs", async () => {
  const runs = createRunStore(memoryKv(), 3);
  for (const prompt of ["a", "b", "c", "d"]) await runs.record(made({ prompt }));
  assert.deepEqual((await runs.list()).map((r) => r.prompt), ["d", "c", "b"]);
});

// Favouriting is a deliberate keep. A run you starred must not quietly age out
// because you generated sixty more after it.
test("a favourite is never dropped by the cap", async () => {
  const runs = createRunStore(memoryKv(), 3);
  const keep = await runs.record(made({ prompt: "keep" }));
  await runs.setFavorite(keep.id, true);
  for (const prompt of ["a", "b", "c", "d"]) await runs.record(made({ prompt }));

  const all = await runs.list();
  assert.ok(all.some((r) => r.prompt === "keep"), "the favourite survived");
  assert.equal(all.filter((r) => !r.favorite).length, 3);
});

test("favourites beyond the cap are all kept", async () => {
  const runs = createRunStore(memoryKv(), 2);
  for (const prompt of ["a", "b", "c", "d"]) {
    const run = await runs.record(made({ prompt }));
    await runs.setFavorite(run.id, true);
  }
  assert.equal((await runs.list()).length, 4);
});

test("unfavouriting lets a run age out again", async () => {
  const runs = createRunStore(memoryKv(), 2);
  const run = await runs.record(made({ prompt: "keep" }));
  await runs.setFavorite(run.id, true);
  await runs.record(made({ prompt: "a" }));
  await runs.record(made({ prompt: "b" }));
  await runs.setFavorite(run.id, false);
  await runs.record(made({ prompt: "c" }));
  assert.equal((await runs.list()).some((r) => r.prompt === "keep"), false);
});

test("remove drops one run", async () => {
  const runs = createRunStore(memoryKv());
  const run = await runs.record(made());
  await runs.remove(run.id);
  assert.deepEqual(await runs.list(), []);
});

test("list is empty when storage holds junk", async () => {
  const kv = memoryKv();
  await kv.set("runs", "not an array");
  assert.deepEqual(await createRunStore(kv).list(), []);
});

test("records that are not runs are skipped", async () => {
  const kv = memoryKv();
  await kv.set("runs", [null, { id: "x" }]);
  assert.deepEqual(await createRunStore(kv).list(), []);
});

// Same read-modify-write hazard the project store had: two runs finishing at
// once must not lose one.
test("concurrent records both survive", async () => {
  const inner = memoryKv();
  const slow = {
    async get<T>(k: string) { await new Promise((r) => setTimeout(r, 5)); return inner.get<T>(k); },
    async set(k: string, v: unknown) { await new Promise((r) => setTimeout(r, 5)); return inner.set(k, v); },
    async remove(k: string) { await new Promise((r) => setTimeout(r, 5)); return inner.remove(k); },
  };
  const runs = createRunStore(slow);
  await Promise.all([runs.record(made({ prompt: "a" })), runs.record(made({ prompt: "b" }))]);
  assert.equal((await runs.list()).length, 2);
});

test("a removed run is remembered until the account has been told", async () => {
  const runs = createRunStore(memoryKv());
  const a = await runs.record(made());
  await runs.remove(a.id);
  assert.deepEqual(await runs.deleted(), [a.id]);
  await runs.settled([a.id]);
  assert.deepEqual(await runs.deleted(), []);
});

test("starring a run counts as a change, so it wins over an older copy", async () => {
  const runs = createRunStore(memoryKv());
  const a = await runs.record(made());
  await new Promise((r) => setTimeout(r, 5));
  await runs.setFavorite(a.id, true);
  const [after] = await runs.list();
  assert.ok((after!.rev ?? 0) > (a.rev ?? 0));
});

test("runs from the account come in newest first and replace the same id, and a patch doesn't count as a change", async () => {
  const runs = createRunStore(memoryKv());
  const a = await runs.record(made({ prompt: "mine" }));
  await runs.adopt([{ ...a, favorite: true, rev: a.rev! + 10 }, { ...a, id: "theirs", at: 1, rev: 1, prompt: "elsewhere" }]);
  const all = await runs.list();
  assert.deepEqual(all.map((r) => r.id), [a.id, "theirs"]);
  assert.equal(all[0]!.favorite, true);
  await runs.patch(a.id, { remote: "https://x.public.blob.vercel-storage.com/a.png" });
  assert.equal((await runs.list())[0]!.rev, a.rev! + 10);
});

test("a sound is a run too, and a recovered render keeps the moment it was made and the Comfy job it came from", async () => {
  const runs = createRunStore(memoryKv());
  const s = await runs.record(made({ kind: "audio", prompt: "rain on a tin roof", url: "/api/local/x.mp3", modelName: "ElevenLabs Sound Effects" }));
  assert.equal(s.kind, "audio");
  const old = await runs.record(made({ comfyJob: "job-1", url: "/api/local/old.png" }), 1_700_000_000_000);
  assert.equal(old.at, 1_700_000_000_000);
  assert.equal((await runs.list()).map((r) => r.id)[0], s.id, "newest first, so the recovered one sorts below");
  assert.equal((await runs.list()).find((r) => r.comfyJob === "job-1")!.at, 1_700_000_000_000);
});
