import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject, newShot, type Project, type Shot } from "./model";
import { nextStep, progress } from "./next-step";

const withShots = (shots: Shot[]): Project => ({ ...createProject("t"), boards: [{ id: "main", name: "Main", kind: "board", shots, notes: [] }] });
const made = (kind: "image" | "video", extra: Partial<Shot> = {}): Shot => ({ ...newShot(), ...extra, render: { url: "/x", kind, usd: null, promptHash: "", at: 1 } });

test("an empty board starts with the shots, on Sheets", () => {
  assert.deepEqual(nextStep(withShots([])), { label: "Write the shots", tab: "sheets" });
  assert.deepEqual(progress(withShots([])), { sheets: false, board: false, cut: false, media: false });
});

test("pictures come first, then motion, then the cut", () => {
  const bare = withShots([newShot(), newShot()]);
  assert.deepEqual(nextStep(bare), { label: "Make 2 pictures", tab: "board" });
  // A render whose hash doesn't match the words now is stale and comes first.
  assert.match(nextStep(withShots([made("image"), newShot()])).label, /^Remake 1 stale shot$/);
  const locked = withShots([made("image", { locked: true }), made("video", { locked: true })]);
  assert.deepEqual(nextStep(locked), { label: "Cut and render", tab: "cut" });
  assert.deepEqual(progress(locked), { sheets: true, board: true, cut: true, media: true });
});
