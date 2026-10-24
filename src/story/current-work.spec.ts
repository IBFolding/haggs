import assert from "node:assert/strict";
import { test } from "node:test";

import { currentWork, workSince } from "./current-work";
import type { Run } from "./runs";

const run = (id: string, at: number, kind: "image" | "video" = "image", favorite = false): Run => ({
  id, modelId: "m", modelName: "M", prompt: id, settings: {}, url: `/x/${id}`, kind, usd: null, at, ...(favorite ? { favorite } : {}),
});

test("a page shows only the kind it makes, from this stretch of work", () => {
  const all = [run("new-img", 100), run("new-vid", 100, "video"), run("old-img", 10)];
  assert.deepEqual(currentWork(all, "image", 50).map((r) => r.id), ["new-img"]);
  assert.deepEqual(currentWork(all, "video", 50).map((r) => r.id), ["new-vid"]);
});

test("a run made right at the start of the stretch counts", () => {
  assert.deepEqual(currentWork([run("a", 50)], "image", 50).map((r) => r.id), ["a"]);
});

test("a run just reused from the Gallery stays visible even when it is old", () => {
  assert.deepEqual(currentWork([run("old", 1)], "image", 50, "old").map((r) => r.id), ["old"]);
});

test("the stretch starts once per tab and a refresh keeps it", () => {
  const store = new Map<string, string>();
  const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  assert.equal(workSince(kv, 1000), 1000);
  assert.equal(workSince(kv, 9999), 1000);
});

test("a tab that blocks storage still gets a start time", () => {
  const blocked = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
  assert.equal(workSince(blocked, 7), 7);
});
