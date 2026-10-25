import assert from "node:assert/strict";
import { test } from "node:test";

import { AD_FORMATS, adJobs, adPrompt, MAX_BATCH } from "./ads";
import type { BrandKit } from "./brand";

const kit: BrandKit = { id: "k", name: "Kiln", url: "", logo: null, colors: ["#d9532b"], fonts: [], about: "", tone: "warm", createdAt: 0, updatedAt: 0 };
const mug = { id: "p1", name: "Ember mug", words: "a speckled terracotta stoneware mug", picture: "/api/local/mug.png", price: "" };
const lamp = { id: "p2", name: "Lamp", words: "", picture: null, price: "" };

test("every format has a shape the model accepts and a name", () => {
  const ok = ["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"];
  for (const f of AD_FORMATS) assert.ok(ok.includes(f.ratio) && f.name.length > 3 && f.id, f.id);
  assert.deepEqual(AD_FORMATS.map((f) => f.id), ["product", "poster", "marketplace", "social", "story"]);
});

test("the prompt carries the product, the brand and the format's direction", () => {
  const p = adPrompt(AD_FORMATS[1]!, mug, kit, "");
  assert.match(p, /speckled terracotta/);
  assert.match(p, /Kiln/);
  assert.match(p, /#d9532b/);
  assert.match(p, /poster/i);
});

test("a marketplace listing is plain: white background and no text", () => {
  const p = adPrompt(AD_FORMATS.find((f) => f.id === "marketplace")!, mug, null, "");
  assert.match(p, /white background/i);
  assert.match(p, /no text/i);
});

test("an audience changes the scene but not the product", () => {
  const p = adPrompt(AD_FORMATS[0]!, mug, kit, "students on a budget");
  assert.match(p, /students on a budget/);
  assert.match(p, /speckled terracotta/);
});

test("a product without words is drawn from its name", () => {
  assert.match(adPrompt(AD_FORMATS[0]!, lamp, null, ""), /Lamp/);
});

test("jobs are products times formats times audiences, in order, and capped at a batch of 20", () => {
  const jobs = adJobs([mug, lamp], [AD_FORMATS[0]!, AD_FORMATS[1]!], [""]);
  assert.equal(jobs.length, 4);
  assert.deepEqual(jobs.map((j) => `${j.product.id}/${j.format.id}`), ["p1/product", "p1/poster", "p2/product", "p2/poster"]);
  const many = adJobs([mug, lamp], AD_FORMATS, ["a", "b", "c"]);
  assert.equal(many.length, MAX_BATCH);
  assert.equal(MAX_BATCH, 20);
});

test("an audience list with nothing in it means one run for everyone", () => {
  assert.equal(adJobs([mug], [AD_FORMATS[0]!], []).length, 1);
});
