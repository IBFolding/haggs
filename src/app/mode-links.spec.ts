import assert from "node:assert/strict";
import { test } from "node:test";

import { modeLinks } from "./mode-links";

test("every Photos page offers the same tabs, in the same order", () => {
  assert.deepEqual(modeLinks("Photos", true).map((l) => l.href), ["/photos", "/edit", "/characters", "/locations", "/accessories", "/comic", "/ads"]);
});

test("Edit a photo is left out while no model can run it", () => {
  assert.deepEqual(modeLinks("Photos", false).map((l) => l.href), ["/photos", "/characters", "/locations", "/accessories", "/comic", "/ads"]);
});

test("every Video page offers the same tabs, Found footage and the Sizzle doctor included", () => {
  assert.deepEqual(modeLinks("Video", true).map((l) => l.label), ["Make a clip", "Series", "Recreate an edit", "Found footage", "Sizzle doctor"]);
});
