import assert from "node:assert/strict";
import { test } from "node:test";

import { ANGLES, reshootFrameAt, reshootPrompt } from "./reshoot";
import { newShot } from "./model";

test("a reshoot asks for the same scene from a new angle, keeping who and where", () => {
  assert.ok(ANGLES.length >= 8);
  const p = reshootPrompt("low", "Ellis checks the cracked light — ELLIS: It was like that.");
  assert.match(p, /same scene as image 1/i);
  assert.match(p, /low angle/i);
  assert.match(p, /Ellis checks the cracked light/);
  assert.doesNotMatch(p, /It was like that/, "the spoken line isn't part of the picture");
  assert.throws(() => reshootPrompt("sideways" as never, "x"), /angle/);
});

test("the frame comes from the middle of what you see of the shot", () => {
  const vid = { ...newShot(), seconds: 3, trimIn: 1, render: { url: "/a.mp4", kind: "video" as const, usd: null, promptHash: "", at: 1 } };
  assert.equal(reshootFrameAt(vid), 2.5);
  const still = { ...newShot(), seconds: 3, render: { url: "/a.png", kind: "image" as const, usd: null, promptHash: "", at: 1 } };
  assert.equal(reshootFrameAt(still), 0);
});
