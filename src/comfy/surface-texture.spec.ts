import assert from "node:assert/strict";
import { it } from "node:test";

import { surfaceWords, texturePrompt } from "./surface-texture";

it("asks for a flat, even, repeating material with nothing else in it", () => {
  const p = texturePrompt("aged red brick");
  assert.match(p, /aged red brick/);
  assert.match(p, /seamless/i);
  assert.match(p, /flat/i);
  assert.match(p, /no perspective/i);
  assert.equal(texturePrompt("  "), "");
});

it("finds a surface by plain words, defaulting to its name", () => {
  assert.equal(surfaceWords("Wall", ""), "the wall");
  assert.equal(surfaceWords("Floor", "  the wooden floor in the foreground "), "the wooden floor in the foreground");
  assert.equal(surfaceWords("", ""), "the surface");
});
