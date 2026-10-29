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

test("a sample product saved before it had a photo finds its photo by name; others find none", async () => {
  const { samplePhotoFor } = await import("./product");
  const { SAMPLES } = await import("./samples");
  assert.equal(samplePhotoFor({ name: " Ember mug " }, SAMPLES), "/samples/ad-ember.webp");
  assert.equal(samplePhotoFor({ name: "halo desk lamp" }, SAMPLES), "/samples/ad-halo.webp");
  assert.equal(samplePhotoFor({ name: "My own mug" }, SAMPLES), null);
});

test("a made product photo is described from the product, alone on a plain background, with no text", async () => {
  const { productPhotoPrompt } = await import("./product");
  const p = productPhotoPrompt({ name: "Ridge 3", words: "a navy trail shoe with an orange sole." });
  assert.match(p, /^Studio product photograph of a navy trail shoe with an orange sole, the product alone/);
  assert.match(p, /No text, no logos/);
  assert.match(productPhotoPrompt({ name: "Halo lamp", words: "" }), /of Halo lamp,/);
});
