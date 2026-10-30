import assert from "node:assert/strict";
import { test } from "node:test";
import { greyMuxArgs } from "./grey-mux";

test("Blender return seeks only the original audio, not the rendered picture", () => {
  const args = greyMuxArgs("picture.mp4", "original.mp4", "out.mp4", true, 2.5);
  assert.deepEqual(args.slice(3, 9), ["-i", "picture.mp4", "-ss", "2.5", "-i", "original.mp4"]);
});
test("silent source keeps the complete rendered picture", () => {
  const args = greyMuxArgs("picture.mp4", "original.mp4", "out.mp4", false, 2);
  assert.ok(!args.includes("-ss"));
  assert.ok(!args.includes("original.mp4"));
});
test("invalid audio offsets are rejected", () => {
  for (const start of [-1, Infinity, NaN]) assert.throws(() => greyMuxArgs("v", "a", "o", true, start), /non-negative/);
});
