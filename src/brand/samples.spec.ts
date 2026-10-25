import assert from "node:assert/strict";
import { test } from "node:test";

import { SAMPLES } from "./samples";
import { adJobs, adPrompt, AD_FORMATS } from "./ads";

test("every sample is a complete brand and product that makes a prompt", () => {
  assert.ok(SAMPLES.length >= 3);
  for (const s of SAMPLES) {
    assert.ok(s.brand.name && s.brand.colors.length >= 2 && s.brand.tone && s.brand.about, s.id);
    assert.ok(s.product.name && s.product.words.length > 20, s.id);
    assert.match(adPrompt(AD_FORMATS[0]!, s.product, { ...s.brand, id: "x", createdAt: 0, updatedAt: 0 }, ""), new RegExp(s.brand.name));
    assert.ok(s.audiences.length >= 2);
  }
  assert.equal(new Set(SAMPLES.map((s) => s.id)).size, SAMPLES.length);
});

test("a sample's default batch is small and cheap", () => {
  for (const s of SAMPLES) assert.ok(adJobs([{ ...s.product, id: "p", picture: null, price: "" }], AD_FORMATS.filter((f) => s.formats.includes(f.id)), []).length <= 3);
});
