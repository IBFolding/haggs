import assert from "node:assert/strict";
import test from "node:test";

import { defaultGrey } from "./grey";
import { greyFrameSvg, shotPrompt } from "./grey-control";
import { FIGURE_HEIGHT, WALK_MID, figureSegments } from "./grey-figure";

const at = { x: 0, z: 0 };
const key = (segs: ReturnType<typeof figureSegments>) => JSON.stringify(segs.map((s) => [s.a, s.b].map((p) => [p.x, p.y, p.z].map((n) => +n.toFixed(4)))));

test("a standing figure does not move, and is as tall as a person", () => {
  assert.equal(key(figureSegments(at, 0, "stand")), key(figureSegments(at, 3, "stand")));
  const top = Math.max(...figureSegments(at, 0, "stand").filter((s) => !s.face).flatMap((s) => [s.a.y, s.b.y + (s.head ? s.r : 0)]));
  assert.ok(Math.abs(top - FIGURE_HEIGHT) < 0.1, `height ${top}`);
});

test("a walker is where it was put at the middle of the clip, and has crossed the room by the end", () => {
  const mid = figureSegments(at, WALK_MID, "walk");
  const hips = mid.find((s) => s.r === 0.12)!;
  assert.ok(Math.abs(hips.a.x) < 1e-9 && Math.abs(hips.a.z) < 0.05, "at its mark in the middle");
  const late = figureSegments(at, WALK_MID + 2, "walk").find((s) => s.r === 0.12)!;
  assert.ok(late.a.z < hips.a.z - 1.5, "walks toward the camera, which is at negative z");
});

test("the legs swing against each other while walking", () => {
  const a = figureSegments(at, 0.2, "walk");
  const feet = a.filter((s) => s.r === 0.035).map((s) => s.b.z);
  assert.ok(Math.abs(feet[0]! - feet[1]!) > 0.1, "one foot is ahead of the other");
});

test("walkers change the control picture over time, standing figures do not, and the words say so", () => {
  const stand = defaultGrey(["A"]);
  const walk = { ...stand, pose: "walk" as const };
  const size = { w: 640, h: 352 };
  assert.notEqual(greyFrameSvg(walk, 0.1, size), greyFrameSvg(walk, 0.6, size));
  assert.equal(greyFrameSvg(stand, 0.1, size), greyFrameSvg(stand, 0.6, size));
  assert.ok(shotPrompt("A beat.", walk).includes("walks toward the camera") && shotPrompt("A beat.", walk).includes("Nobody else is in the shot"), "one figure stays one person");
  assert.ok(shotPrompt("A beat.", { ...walk, subjects: [...walk.subjects, { id: "b", label: "B", x: 1, z: 0 }] }).includes("2 people walk toward the camera"));
  assert.ok(!shotPrompt("A beat.", stand).includes("walk toward"));
});

test("a face mark sits in front of the head, so which way someone looks can be seen", () => {
  const segs = figureSegments(at, 0, "stand", 0);
  const head = segs.find((s) => s.head)!, face = segs.find((s) => s.face)!;
  assert.ok(face.a.z < head.a.z, "facing 0 looks toward negative z, where the camera starts");
  const turned = figureSegments(at, 0, "stand", 180);
  assert.ok(turned.find((s) => s.face)!.a.z > turned.find((s) => s.head)!.a.z, "turned round, the mark is on the other side");
});

test("a walker coming toward the camera stops short of the lens", () => {
  const cam = { x: 0, z: -4, min: 3.2 };
  for (const t of [0, 2, 4, 5]) {
    const hips = figureSegments(at, t, "walk", 0, cam).find((s) => s.r === 0.12)!;
    assert.ok(Math.hypot(hips.a.x - cam.x, hips.a.z - cam.z) >= 3.19, `too close at ${t}s`);
  }
  const free = figureSegments(at, 5, "walk", 0).find((s) => s.r === 0.12)!;
  assert.ok(free.a.z < -2.5, "without a camera in the way it keeps walking");
});
