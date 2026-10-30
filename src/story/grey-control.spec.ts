import assert from "node:assert/strict";
import test from "node:test";

import { defaultGrey } from "./grey";
import { presetKeys } from "./grey-camera";
import { controlSeconds, fitToClip, frameTimes, greyFrameSvg, shotPrompt } from "./grey-control";

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

test("the clip is as long as the move, in eight-frame steps, and never over five seconds", () => {
  const grey = defaultGrey(["A"]);
  assert.equal(controlSeconds(grey), 3.84, "a still camera gets about four seconds");
  const long = { ...grey, camKeys: presetKeys("Push in", grey.cam) };
  assert.ok(controlSeconds(long) <= 5 && controlSeconds(long) > 4, "a six second move is held to five at most");
  assert.equal((controlSeconds(long) * 25) % 8, 0, "frames minus one is a multiple of eight");
});

test("a long move is squeezed to fit rather than cut off", () => {
  const grey = defaultGrey(["A"]);
  const fitted = fitToClip({ ...grey, camKeys: presetKeys("Push in", grey.cam) });
  assert.equal(fitted.camKeys!.at(-1)!.t, controlSeconds({ ...grey, camKeys: presetKeys("Push in", grey.cam) }), "the move ends exactly when the clip does");
  assert.deepEqual(fitted.camKeys!.map((k) => k.distance), presetKeys("Push in", grey.cam).map((k) => k.distance), "the move itself is unchanged");
  assert.equal(fitToClip(grey), grey);
});

test("the words name the people and the camera", () => {
  const p = shotPrompt("Rowan waits.", defaultGrey(["Rowan"]));
  assert.ok(p.startsWith("Rowan waits.") && p.includes("The people are: Rowan.") && /camera/i.test(p));
});
