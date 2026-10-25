import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_FRAMES, spriteArgs, spriteLayout, spritePlan } from "./sprites";

test("the grid fits every frame: columns across, enough rows down", () => {
  assert.deepEqual(spriteLayout(8, 4), { columns: 4, rows: 2, frames: 8 });
  assert.deepEqual(spriteLayout(10, 4), { columns: 4, rows: 3, frames: 10 });
  assert.deepEqual(spriteLayout(5, 8), { columns: 5, rows: 1, frames: 5 });
});

test("the plan clamps frames, columns and size to sensible limits and keeps sizes even", () => {
  const p = spritePlan({ seconds: 4, frames: 500, columns: 99, size: 5000 });
  assert.equal(p.frames, MAX_FRAMES);
  assert.ok(p.columns <= p.frames && p.columns >= 1);
  assert.ok(p.size <= 512 && p.size % 2 === 0);
  const q = spritePlan({ seconds: 4, frames: 0, columns: 0, size: 1 });
  assert.ok(q.frames >= 2 && q.size >= 32);
});

test("frames are spread evenly across the clip, so the loop covers all of it", () => {
  const p = spritePlan({ seconds: 4, frames: 8, columns: 4, size: 128 });
  assert.equal(p.fps, 2);
});

test("the ffmpeg arguments sample, scale to a square cell, and tile", () => {
  const a = spriteArgs("in.mp4", "out.png", spritePlan({ seconds: 4, frames: 8, columns: 4, size: 128 }));
  const vf = a[a.indexOf("-vf") + 1]!;
  assert.match(vf, /fps=2/);
  assert.match(vf, /scale=128:128/);
  assert.match(vf, /tile=4x2/);
  assert.ok(a.includes("-frames:v") && a.includes("1") && a.at(-1) === "out.png" && a.includes("in.mp4"));
});

test("a clip with no length can't be turned into a sheet", () => {
  assert.throws(() => spritePlan({ seconds: 0, frames: 8, columns: 4, size: 128 }), /length/i);
});
