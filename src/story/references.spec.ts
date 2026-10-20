import assert from "node:assert/strict";
import { test } from "node:test";

import type { Shot } from "./model";
import { inputsFor } from "./references";

const shot = (over: Partial<Shot> = {}): Shot => ({ id: "s", heading: "", beat: "", threadIds: [], seconds: 5, model: { id: "m", settings: {} }, refs: ["maya.png", "dock.png"], ...over });

test("a shot with a still starts from it, and its references come after", () => {
  const still = { url: "still.png", kind: "image" as const, usd: null, promptHash: "", at: 1 };
  assert.deepEqual(inputsFor(shot({ render: still }), 3), { images: ["still.png", "maya.png", "dock.png"], firstFrame: true });
});

test("a shot without a still sends its references as references, never as a first frame", () => {
  assert.deepEqual(inputsFor(shot(), 3), { images: ["maya.png", "dock.png"], firstFrame: false });
  const video = { url: "take.mp4", kind: "video" as const, usd: 1, promptHash: "", at: 1 };
  assert.deepEqual(inputsFor(shot({ render: video }), 3).firstFrame, false, "a video take is not a first frame");
});

test("the model's image limit is respected, still first", () => {
  const still = { url: "still.png", kind: "image" as const, usd: null, promptHash: "", at: 1 };
  assert.deepEqual(inputsFor(shot({ render: still }), 2).images, ["still.png", "maya.png"]);
  assert.deepEqual(inputsFor(shot(), 0), { images: [], firstFrame: false });
  assert.deepEqual(inputsFor(shot({ refs: [] }), 3), { images: [], firstFrame: false });
});

test("a shot renders at its own length, rounded up to what the model allows", async () => {
  const { renderSeconds } = await import("./references");
  const range = { type: "range" as const, label: "Duration", min: 4, max: 15, default: 6, unit: "s" };
  assert.equal(renderSeconds(shot({ seconds: 3 }), range), 4, "below the minimum rounds up, and the cut trims it");
  assert.equal(renderSeconds(shot({ seconds: 6.5 }), range), 7);
  assert.equal(renderSeconds(shot({ seconds: 30 }), range), 15);
  assert.equal(renderSeconds(shot({ seconds: null }), range), null, "no length on the shot leaves the model's setting alone");
  assert.equal(renderSeconds(shot({ seconds: 5 }), undefined), null);
});
