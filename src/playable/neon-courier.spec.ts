import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { memoryKv } from "../story/kv";
import { createGameStore } from "./store";
import { saveNeonCourier, NEON_COURIER_ID } from "./neon-courier";

const original = JSON.parse(readFileSync("public/playable/neon-courier/game.json", "utf8"));
test("exact courier export retains every atlas and code, and repeat import preserves edits/history", async () => {
  const kv = memoryKv();
  const game = await saveNeonCourier(kv, async () => original);
  assert.equal(game.id, NEON_COURIER_ID);
  assert.deepEqual(game.spec, original);
  const store = createGameStore(kv);
  const edited = await store.change(game.id, { ...game.spec, title: "My courier" });
  assert.deepEqual(await saveNeonCourier(kv, async () => { throw new Error("should not download"); }), edited);
  assert.equal((await store.list()).length, 1);
  assert.equal(edited?.history.length, 1);
});
test("unreadable existing save is preserved and failed download does not create a record", async () => {
  const kv = memoryKv();
  await assert.rejects(saveNeonCourier(kv, async () => { throw new Error("offline"); }));
  assert.equal(await kv.get(`playable/${NEON_COURIER_ID}`), undefined);
  const broken = { id: NEON_COURIER_ID, spec: { title: "Keep this" }, history: [original] };
  await kv.set(`playable/${NEON_COURIER_ID}`, broken);
  await assert.rejects(saveNeonCourier(kv, async () => original), /preserved/);
  assert.deepEqual(await kv.get(`playable/${NEON_COURIER_ID}`), broken);
});
