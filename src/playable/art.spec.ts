import assert from "node:assert/strict";
import { test } from "node:test";

import { KEY_COLOUR, artPrompt, artSettings, keyDistance, keyOut } from "./art";
import { defaultSpec, slotsOf } from "./spec";

test("sprites are asked for on the key colour; backgrounds wide and empty", () => {
  const spec = defaultSpec("runner");
  const [player, , , background] = slotsOf(spec);
  assert.match(artPrompt(spec, player!), new RegExp(KEY_COLOUR));
  assert.match(artPrompt(spec, player!), /courier/);
  assert.match(artPrompt(spec, background!), /16:9/);
  assert.doesNotMatch(artPrompt(spec, background!), /magenta/);
  assert.equal(artSettings(player!).aspect_ratio, "1:1");
  assert.equal(artSettings(background!).aspect_ratio, "16:9");
});

test("keying: magenta goes, near-magenta fades, everything else stays", () => {
  assert.equal(keyDistance(255, 0, 255), 0);
  assert.equal(keyDistance(30, 200, 40), 1);
  assert.equal(keyDistance(255, 255, 255), 1, "white is not magenta");
  const soft = keyDistance(200, 120, 220);
  assert.ok(soft > 0 && soft < 1);
  const px = new Uint8ClampedArray([255, 0, 255, 255, 20, 180, 60, 255, 200, 120, 220, 255]);
  keyOut(px);
  assert.equal(px[3], 0);
  assert.equal(px[7], 255);
  assert.ok(px[11]! > 0 && px[11]! < 255);
});
