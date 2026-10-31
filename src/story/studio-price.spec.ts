import assert from "node:assert/strict";
import { test } from "node:test";
import { studioPrice } from "./studio-price";
import { cloudEstimate } from "../providers/cloud-price";
import { creditsOf } from "./price-text";
import { minimaxWorkflow } from "../providers/cloud";

const estimate = (duration: number, resolution = "768P", referenceCount = 0, firstFrame = false) =>
  studioPrice({ modelId: "minimax/minimax-h3", settings: { duration, resolution }, referenceCount, firstFrame });

test("campaign: selected 4s agrees with settled 108.62 Comfy credits, not the 6s default", () => {
  assert.equal(estimate(6).comfyCredits, 162.93);
  const selected = estimate(4);
  assert.equal(selected.comfyCredits, 108.62);
  assert.equal(selected.usd, 0.5148);
  assert.equal(selected.haggsCredits, 52);
  assert.equal(selected.label, "Est. 52 credits");
  assert.match(selected.detail, /108\.62 Comfy credits/);
  assert.match(selected.detail, /52 Haggs credits/);
  assert.match(selected.detail, /4s at 768P/);
  assert.match(selected.detail, /estimates, not a spending limit/);
});

test("all supported durations and resolutions follow the submitted workflow settings without changing plan math", () => {
  for (const resolution of ["768P", "2K"] as const) for (let seconds = 4; seconds <= 15; seconds++) {
    const price = estimate(seconds, resolution);
    const node = minimaxWorkflow({ prompt: "A lamp on a desk", seconds, resolution, seed: 1 })["1"]!;
    assert.equal(node.inputs["model.duration"], seconds);
    assert.equal(node.inputs["model.resolution"], resolution);
    assert.equal(price.comfyCredits, Math.round(seconds * (resolution === "2K" ? 0.1859 : 0.1287) * 211 * 100) / 100);
    assert.equal(price.haggsCredits, creditsOf(cloudEstimate({ seconds, resolution, references: 0 })));
  }
});

test("references surcharge starts after five; first-frame execution has no reference surcharge", () => {
  assert.equal(estimate(4, "768P", 5).comfyCredits, 108.62);
  assert.equal(estimate(4, "768P", 7).comfyCredits, 132.76);
  assert.equal(estimate(4, "768P", 7, true).comfyCredits, 108.62);
  assert.equal(estimate(4, "768P", 15).comfyCredits, estimate(4, "768P", 9).comfyCredits);
});

test("invalid or incomplete configurations never reuse a previous price", () => {
  for (const duration of [NaN, Infinity, 3, 16, 4.5]) assert.equal(estimate(duration).usd, null);
  assert.equal(estimate(4, "1080P").usd, null);
  assert.equal(estimate(4, "768P", -1).usd, null);
  assert.equal(studioPrice({ modelId: "minimax/minimax-h3", settings: {}, referenceCount: 0, firstFrame: false }).usd, null);
  assert.equal(estimate(6).comfyCredits, 162.93);
  assert.equal(estimate(4).comfyCredits, 108.62);
});

test("unknown models are unavailable; other current-settings table prices show credits with an unverified estimate detail", () => {
  const input = { modelId: "unknown/model", settings: {}, referenceCount: 0, firstFrame: false };
  assert.equal(studioPrice(input).label, "Estimate unavailable");
  for (const otherUsd of [NaN, Infinity, -1]) assert.equal(studioPrice({ ...input, otherUsd }).usd, null);
  const known = studioPrice({ ...input, otherUsd: 0.25 });
  assert.equal(known.label, "Est. 25 credits");
  assert.match(known.detail, /current provider rate is unverified/);
  assert.equal(known.comfyCredits, null);
  assert.equal(known.haggsCredits, 25);
});
