import assert from "node:assert/strict";
import test from "node:test";

import { CONTROL_STRENGTH, GREY_SHOT_OUTPUT, greyShotWorkflow } from "./grey-shot";

const make = (over = {}) => greyShotWorkflow({ prompt: "A woman stands in a hall.", image: "first.png", video: "control.mp4", ...over }) as unknown as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

test("the first frame, the control video and the words go where the graph reads them", () => {
  const g = make({ seed: 11 });
  assert.equal(g["200"]!.inputs.image, "first.png");
  assert.equal(g["199"]!.inputs.file, "control.mp4");
  assert.equal(g["129:211"]!.inputs.on_false, "A woman stands in a hall.", "the switch is what is read while prompt enhance is off");
  assert.equal(g["129:212"]!.inputs.value, false, "prompt enhance stays off, or the words above would be ignored");
  assert.equal(g["129:704"]!.inputs.seed, 11);
});

test("a tall shot swaps the frame size, and nothing is shared between calls", () => {
  const tall = make({ vertical: true });
  assert.deepEqual([tall["129:113"]!.inputs.value, tall["129:98"]!.inputs.value], [704, 1280]);
  const wide = make();
  assert.deepEqual([wide["129:113"]!.inputs.value, wide["129:98"]!.inputs.value], [1280, 704]);
  assert.equal(make({ prompt: "x" })["129:211"]!.inputs.on_false, "x");
  assert.equal(make()["129:211"]!.inputs.on_false, "A woman stands in a hall.");
});

test("the saved video is the output node, and the graph is whole", () => {
  const g = make();
  assert.equal(g[GREY_SHOT_OUTPUT]!.class_type, "SaveVideo");
  const ids = new Set(Object.keys(g));
  for (const node of Object.values(g)) for (const v of Object.values(node.inputs)) if (Array.isArray(v) && typeof v[0] === "string") assert.ok(ids.has(v[0]), `a link points at a node that is missing: ${v[0]}`);
});

test("a walking figure is followed more loosely than a standing one", () => {
  assert.ok(CONTROL_STRENGTH.walk < CONTROL_STRENGTH.stand);
  assert.equal(make()["129:115"]!.inputs.strength, 1);
  assert.equal(make({ strength: CONTROL_STRENGTH.walk })["129:115"]!.inputs.strength, 0.7);
  assert.equal(make({ strength: 5 })["129:115"]!.inputs.strength, 1, "never above one");
});
