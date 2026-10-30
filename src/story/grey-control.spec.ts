import assert from "node:assert/strict";
import test from "node:test";

import { defaultGrey } from "./grey";
import { presetKeys } from "./grey-camera";
import { frameTimes, greyFrameSvg } from "./grey-control";

const size = { w: 1280, h: 720 };

test("one figure is drawn, and no words end up in the picture", () => {
  const svg = greyFrameSvg(defaultGrey(["Rowan"]), 0, size);
  assert.equal((svg.match(/<circle/g) ?? []).length, 1);
  assert.ok(!svg.includes("<text") && !svg.includes("Rowan"));
});

test("the camera path changes the picture over time", () => {
  const grey = defaultGrey(["A"]);
  const moving = { ...grey, camKeys: presetKeys("Push in", grey.cam) };
  assert.notEqual(greyFrameSvg(moving, 0, size), greyFrameSvg(moving, 5, size));
  assert.equal(greyFrameSvg(grey, 0, size), greyFrameSvg(grey, 5, size), "a still camera draws the same frame");
});

test("the frame times include both ends", () => {
  const t = frameTimes(2, 25);
  assert.equal(t.length, 51);
  assert.equal(t[0], 0);
  assert.equal(t.at(-1), 2);
});
