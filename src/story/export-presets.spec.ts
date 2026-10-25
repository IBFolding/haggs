import assert from "node:assert/strict";
import { test } from "node:test";

import { PRESETS, applyPreset, presetById, withFocus } from "./export-presets";
import { createProject, newShot, type Project } from "./model";

const project = (): Project => ({ ...createProject("Reel"), shots: [{ ...newShot(), id: "a" }, { ...newShot(), id: "b", fit: "fill", focus: { x: 0.2, y: 0.3 } }] });

test("three presets: X, TikTok and Reels and Shorts, YouTube; all aim for -14 LUFS", () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ["x", "vertical", "youtube"]);
  for (const p of PRESETS) assert.equal(p.loudness, -14, p.id);
  assert.equal(presetById("vertical")?.aspect, "9:16");
  assert.equal(presetById("x")?.aspect, "16:9");
  assert.equal(presetById("nope"), undefined);
});

test("the wide presets set the frame and leave every shot's own framing alone", () => {
  const out = applyPreset(project(), presetById("x")!);
  assert.equal(out.aspect, "16:9");
  assert.equal(out.shots[1]!.focus?.x, 0.2);
  assert.equal(out.shots[0]!.fit, undefined);
});

test("the vertical preset fills the frame, keeping any focus a shot already has and defaulting the rest to the middle", () => {
  const out = applyPreset(project(), presetById("vertical")!);
  assert.equal(out.aspect, "9:16");
  assert.deepEqual([out.shots[0]!.fit, out.shots[0]!.focus], ["fill", { x: 0.5, y: 0.4 }]);
  assert.deepEqual([out.shots[1]!.fit, out.shots[1]!.focus], ["fill", { x: 0.2, y: 0.3 }]);
});

test("a focus found by looking at the picture replaces the default but not a hand-set one", () => {
  const out = applyPreset(project(), presetById("vertical")!, { a: { x: 0.7, y: 0.35 }, b: { x: 0.9, y: 0.9 } });
  assert.deepEqual(out.shots[0]!.focus, { x: 0.7, y: 0.35 });
  assert.deepEqual(out.shots[1]!.focus, { x: 0.2, y: 0.3 }, "the focus you set by hand wins");
});

test("a found focus outside the picture is pulled back in", () => {
  const out = applyPreset(project(), presetById("vertical")!, { a: { x: 3, y: -1 } });
  assert.deepEqual(out.shots[0]!.focus, { x: 1, y: 0 });
});

test("applying a preset does not change the project it was given", () => {
  const before = project();
  const copy = JSON.stringify(before);
  applyPreset(before, presetById("vertical")!);
  assert.equal(JSON.stringify(before), copy);
});

test("found faces replace the focus on the shots they cover, even after a preset has filled in the middle", () => {
  const filled = applyPreset(project(), presetById("vertical")!);
  const out = withFocus(filled, { a: { x: 0.8, y: 0.3 } });
  assert.deepEqual(out.shots[0]!.focus, { x: 0.8, y: 0.3 });
  assert.equal(out.shots[0]!.fit, "fill");
  assert.deepEqual(out.shots[1]!.focus, { x: 0.2, y: 0.3 }, "a shot with nothing found keeps what it had");
});

test("found faces are ignored for shots that aren't in the project", () => {
  const out = withFocus(project(), { zzz: { x: 0.1, y: 0.1 } });
  assert.equal(out.shots.length, 2);
  assert.equal(out.shots[0]!.focus, undefined);
  assert.deepEqual(out.shots[1]!.focus, { x: 0.2, y: 0.3 });
});
