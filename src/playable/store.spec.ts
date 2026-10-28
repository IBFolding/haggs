import assert from "node:assert/strict";
import { test } from "node:test";

import { memoryKv } from "../story/kv";
import { defaultSpec, withArt } from "./spec";
import { HISTORY, createGameStore } from "./store";

const clock = () => {
  let t = 1000;
  return () => (t += 1);
};
const ids = () => {
  let n = 0;
  return () => `g${++n}`;
};

test("games are created, listed newest first, and read back", async () => {
  const store = createGameStore(memoryKv(), clock(), ids());
  const a = await store.create(defaultSpec("runner"), [{ who: "you", text: "a runner", at: 1 }]);
  const b = await store.create(defaultSpec("match"));
  assert.deepEqual((await store.list()).map((s) => s.id), [b.id, a.id]);
  const read = await store.get(a.id);
  assert.deepEqual(read?.spec, defaultSpec("runner"));
  assert.equal(read?.chat[0]?.text, "a runner");
  await store.say(a.id, { who: "note", text: "hi", at: 2 });
  assert.equal((await store.list())[0]!.id, a.id, "touched games come first");
});

test("a change keeps the spec before it, and undo goes back step by step", async () => {
  const store = createGameStore(memoryKv(), clock(), ids());
  const game = await store.create(defaultSpec("collector"));
  const faster = { ...game.spec, title: "Faster" };
  const fastest = { ...game.spec, title: "Fastest" };
  await store.change(game.id, faster, { who: "you", text: "faster", at: 1 });
  await store.change(game.id, fastest);
  assert.equal((await store.list())[0]!.title, "Fastest");
  assert.equal((await store.undo(game.id))?.spec.title, "Faster");
  assert.equal((await store.undo(game.id))?.spec.title, defaultSpec("collector").title);
  assert.equal(await store.undo(game.id), undefined, "nothing left to undo");
  const chat = (await store.get(game.id))!.chat.map((l) => l.text);
  assert.deepEqual(chat, ["faster", "Undid the last change.", "Undid the last change."]);
});

test("history is capped", async () => {
  const store = createGameStore(memoryKv(), clock(), ids());
  const game = await store.create(defaultSpec("runner"));
  for (let i = 0; i < HISTORY + 5; i++) await store.change(game.id, { ...game.spec, title: `v${i}` });
  assert.equal((await store.get(game.id))!.history.length, HISTORY);
});

test("the summary carries the background art as the cover", async () => {
  const store = createGameStore(memoryKv(), clock(), ids());
  const game = await store.create(withArt(defaultSpec("runner"), "background", { url: "https://blob.example.com/bg.png" }));
  assert.equal((await store.list())[0]!.cover, "https://blob.example.com/bg.png");
  assert.equal((await store.list())[0]!.template, "runner");
  assert.ok(game.id);
});

test("removing a game drops it from the list; a broken record reads as missing", async () => {
  const kv = memoryKv();
  const store = createGameStore(kv, clock(), ids());
  const game = await store.create(defaultSpec("match"));
  await store.remove(game.id);
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.get(game.id), undefined);
  await kv.set("playable/bad", { id: "bad", spec: { template: "shooter" } });
  assert.equal(await store.get("bad"), undefined);
  assert.equal(await store.change("missing", defaultSpec("match")), undefined);
});
