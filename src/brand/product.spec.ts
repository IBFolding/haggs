import assert from "node:assert/strict";
import { test } from "node:test";

import { createProductStore } from "./product";
import { memoryKv } from "../story/kv";

test("products are kept newest first, edited in place, and removed", async () => {
  const store = createProductStore(memoryKv());
  const a = await store.save({ name: "Ember mug", words: "a speckled mug", picture: null, price: "$28" });
  const b = await store.save({ name: "Lamp", words: "", picture: "/x.png", price: "" });
  assert.deepEqual((await store.list()).map((p) => p.name), ["Lamp", "Ember mug"]);
  const edited = await store.save({ ...a, words: "a glazed mug" });
  assert.equal(edited.id, a.id);
  assert.equal((await store.list())[0]!.words, "a glazed mug");
  await store.remove(b.id);
  assert.equal((await store.list()).length, 1);
});

test("a product needs a name", async () => {
  await assert.rejects(createProductStore(memoryKv()).save({ name: "  ", words: "", picture: null, price: "" }), /name/i);
});
