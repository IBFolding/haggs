import assert from "node:assert/strict";
import { test } from "node:test";

import { PRESETS, cameraWords, reshootFrameAt, reshootPrompt, sameCamera } from "./reshoot";
import { newShot } from "./model";

test("the dial's position becomes plain words about where the camera has gone", () => {
  assert.match(cameraWords({ az: 40, el: 0, zoom: 0 }), /three-quarter view from the right/i);
  assert.match(cameraWords({ az: -90, el: 0, zoom: 0 }), /side-on profile from the left/i);
  assert.match(cameraWords({ az: 180, el: 0, zoom: 0 }), /reverse angle/i);
  assert.match(cameraWords({ az: 0, el: 40, zoom: 0 }), /high angle looking down/i);
  assert.match(cameraWords({ az: 0, el: -30, zoom: 0 }), /low angle looking up/i);
  assert.match(cameraWords({ az: 0, el: 75, zoom: 0 }), /top-down/i);
  assert.match(cameraWords({ az: 0, el: 0, zoom: -1 }), /closer/i);
  assert.match(cameraWords({ az: 0, el: 0, zoom: 1 }), /wider/i);
  const both = cameraWords({ az: -45, el: -25, zoom: 1 });
  assert.match(both, /left/);
  assert.match(both, /low angle/);
  assert.match(both, /wider/);
});

test("an unmoved camera is recognised, and a reshoot of it is refused", () => {
  assert.ok(sameCamera({ az: 0, el: 0, zoom: 0 }));
  assert.ok(sameCamera({ az: 6, el: -4, zoom: 0.1 }));
  assert.ok(!sameCamera({ az: 40, el: 0, zoom: 0 }));
  assert.throws(() => reshootPrompt({ az: 0, el: 0, zoom: 0 }, "x"), /move the camera/i);
});

test("a reshoot asks for the same scene from the new camera, keeping who and where, with no spoken line", () => {
  const p = reshootPrompt({ az: 180, el: 0, zoom: 0 }, "Ellis checks the cracked light — ELLIS: It was like that.");
  assert.match(p, /same scene as image 1/i);
  assert.match(p, /reverse angle/i);
  assert.match(p, /Ellis checks the cracked light/);
  assert.doesNotMatch(p, /It was like that/);
  assert.ok(PRESETS.length >= 6);
  for (const preset of PRESETS) assert.ok(!sameCamera(preset.move), preset.id);
});

test("the frame comes from the middle of what you see of the shot", () => {
  const vid = { ...newShot(), seconds: 3, trimIn: 1, render: { url: "/a.mp4", kind: "video" as const, usd: null, promptHash: "", at: 1 } };
  assert.equal(reshootFrameAt(vid), 2.5);
  const still = { ...newShot(), seconds: 3, render: { url: "/a.png", kind: "image" as const, usd: null, promptHash: "", at: 1 } };
  assert.equal(reshootFrameAt(still), 0);
});
