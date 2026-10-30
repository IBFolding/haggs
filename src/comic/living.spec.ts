import test from "node:test";
import assert from "node:assert/strict";
import { newPanel } from "./comic";
import { animationRequest, currentAnimation } from "./living";

test("animation uses each panel's artwork as its starting frame and keeps text out of generated art", () => {
  const panel = newPanel({ action: "Juno runs", motion: "Rain drifts", shape: "square", seconds: 3, caption: "NIGHT", lines: [{ who: "Juno", text: "Come back!" }] });
  const request = animationRequest(panel, "picture-a");
  assert.deepEqual(request.images, ["picture-a"]);
  assert.equal(request.settings.duration, 4);
  assert.equal(request.settings.ratio, "1:1");
  assert.match(request.prompt, /Rain drifts/);
  assert.doesNotMatch(request.prompt, /Come back!/);
  assert.equal(panel.caption, "NIGHT");
});

test("replacing artwork invalidates playback without deleting the previous clip", () => {
  const clip = { url: "clip-a", source: "picture-a", prompt: "motion", model: "model" };
  assert.equal(currentAnimation(clip, "picture-a"), clip);
  assert.equal(currentAnimation(clip, "picture-b"), undefined);
  assert.equal(currentAnimation(clip, undefined), undefined);
  assert.equal(currentAnimation(undefined, "picture-a"), undefined);
  assert.equal(clip.url, "clip-a");
});

test("generation fingerprint changes with artwork, motion and duration", () => {
  const p = newPanel({ action: "A storm", seconds: 5 });
  const key = JSON.stringify(animationRequest(p, "a"));
  for (const request of [animationRequest(p, "b"), animationRequest({ ...p, motion: "Pan left" }, "a"), animationRequest({ ...p, seconds: 8 }, "a")]) assert.notEqual(JSON.stringify(request), key);
});
