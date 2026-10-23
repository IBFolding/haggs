import assert from "node:assert/strict";
import { test } from "node:test";

import { LOOK_ROWS, lookPhrase, withLook, type LookChoice } from "./look";

test("every row has choices with the words they add, and grades carry their colours", () => {
  assert.deepEqual(LOOK_ROWS.map((r) => r.id), ["camera", "framing", "light", "film", "look", "grade"]);
  for (const row of LOOK_ROWS) {
    assert.ok(row.options.length >= 5, row.id);
    for (const o of row.options) assert.ok(o.words.length > 4, `${row.id}/${o.id}`);
  }
  assert.ok(LOOK_ROWS.find((r) => r.id === "grade")!.options.every((o) => o.swatch && o.swatch.length >= 3));
});

test("the chosen look becomes plain words after the prompt, lens and aperture included", () => {
  const c: LookChoice = { camera: "large-format", lens: "anamorphic", focal: 50, aperture: 2.8, framing: "medium", light: "practical-night", film: "tungsten-500t", look: "neo-noir", grade: "teal-orange" };
  const words = lookPhrase(c);
  assert.match(words, /large-format camera/i);
  assert.match(words, /anamorphic 50mm lens at f\/2\.8/);
  assert.match(words, /medium shot/i);
  assert.match(words, /teal and orange/i);
  assert.equal(withLook("A detective in the rain", c), `A detective in the rain. ${words}`);
  assert.equal(withLook("A detective in the rain", {}), "A detective in the rain");
});
