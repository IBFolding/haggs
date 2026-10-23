import assert from "node:assert/strict";
import { test } from "node:test";

import { fitArgs } from "./video-fit";

test("a video wider than Comfy's tools accept is scaled down to 1920, one that fits is left alone", () => {
  assert.equal(fitArgs(1344, 768), null);
  assert.equal(fitArgs(1920, 1080), null);
  assert.equal(fitArgs(2160, 1216), null);
  const a = fitArgs(2560, 1440)!;
  assert.ok(a.includes("scale=1920:-2"));
  assert.deepEqual(fitArgs(1440, 2560)!.filter((x) => x.startsWith("scale")), ["scale=-2:1920"], "a tall video is limited by its height");
});
