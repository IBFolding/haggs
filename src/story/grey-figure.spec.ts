import assert from "node:assert/strict";
import test from "node:test";

import { defaultGrey } from "./grey";
import { greyFrameSvg, shotPrompt } from "./grey-control";
import { FIGURE_HEIGHT, WALK_MID, figureSegments } from "./grey-figure";

const at = { x: 0, z: 0 };
const key = (segs: ReturnType<typeof figureSegments>) => JSON.stringify(segs.map((s) => [s.a, s.b].map((p) => [p.x, p.y, p.z].map((n) => +n.toFixed(4)))));

test("a standing figure does not move, and is as tall as a person", () => {
  assert.equal(key(figureSegments(at, 0, "stand")), key(figureSegments(at, 3, "stand")));
  const top = Math.max(...figureSegments(at, 0, "stand").flatMap((s) => [s.a.y, s.b.y + (s.head ? s.r : 0)]));
  assert.ok(Math.abs(top - FIGURE_HEIGHT) < 0.1, `height ${top}`);
});

test("a walker is where it was put at the middle of the clip, and has crossed the room by the end", () => {
  const mid = figureSegments(at, WALK_MID, "walk");
  const hips = mid.find((s) => s.r === 0.15)!;
  assert.ok(Math.abs(hips.a.x) < 1e-9 && Math.abs(hips.a.z) < 0.05, "at its mark in the middle");
  const late = figureSegments(at, WALK_MID + 2, "walk").find((s) => s.r === 0.15)!;
  assert.ok(late.a.z < hips.a.z - 1.5, "walks toward the camera, which is at negative z");
});

test("the legs swing against each other while walking", () => {
  const a = figureSegments(at, 0.2, "walk");
  const feet = a.filter((s) => s.r === 0.045).map((s) => s.b.z);
  assert.ok(Math.abs(feet[0]! - feet[1]!) > 0.1, "one foot is ahead of the other");
});

test("walkers change the control picture over time, standing figures do not, and the words say so", () => {
  const stand = defaultGrey(["A"]);
  const walk = { ...stand, pose: "walk" as const };
  const size = { w: 640, h: 352 };
  assert.notEqual(greyFrameSvg(walk, 0.1, size), greyFrameSvg(walk, 0.6, size));
  assert.equal(greyFrameSvg(stand, 0.1, size), greyFrameSvg(stand, 0.6, size));
  assert.ok(shotPrompt("A beat.", walk).includes("walk toward the camera"));
  assert.ok(!shotPrompt("A beat.", stand).includes("walk toward"));
});
