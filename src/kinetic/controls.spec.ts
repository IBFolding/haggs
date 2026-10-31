import assert from "node:assert/strict";
import { test } from "node:test";

import { setTempo } from "./controls";

test("the tempo control replaces only the sheet's bpm directive", () => {
  const sheet = "# launch\nbpm 150\nOPEN | 2 | white\n@count 26 | 3 | APPS\n";
  assert.equal(setTempo(sheet, 172), "# launch\nbpm 172\nOPEN | 2 | white\n@count 26 | 3 | APPS\n");
});

test("the tempo control adds a directive when the sheet does not have one", () => {
  assert.equal(setTempo("OPEN | 2\n", 140), "bpm 140\nOPEN | 2\n");
});

test("the tempo control keeps the same bounds as the sheet parser", () => {
  assert.equal(setTempo("bpm 150\nA", 20), "bpm 60\nA");
  assert.equal(setTempo("bpm 150\nA", 900), "bpm 220\nA");
  assert.equal(setTempo("bpm 150\nA", Number.NaN), "bpm 150\nA");
});
