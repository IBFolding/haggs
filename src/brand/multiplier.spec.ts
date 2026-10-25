import assert from "node:assert/strict";
import { test } from "node:test";

import { multiplierJobs, multiplyPrompt, nearestRatio } from "./multiplier";
import { MAX_BATCH } from "./ads";

test("the nearest supported shape to a picture's size", () => {
  assert.equal(nearestRatio(1080, 1080), "1:1");
  assert.equal(nearestRatio(1080, 1350), "4:5");
  assert.equal(nearestRatio(1080, 1920), "9:16");
  assert.equal(nearestRatio(1920, 1080), "16:9");
  assert.equal(nearestRatio(1200, 628), "16:9");
  assert.equal(nearestRatio(0, 0), "1:1");
});

test("the prompt keeps the ad and changes who it speaks to", () => {
  const p = multiplyPrompt("students on a budget", "");
  assert.match(p, /image 1/i);
  assert.match(p, /students on a budget/);
  assert.match(p, /same product/i);
  assert.doesNotMatch(p, /translate/i);
});

test("a language asks for the words on the ad to be translated and nothing else to change", () => {
  const p = multiplyPrompt("", "Spanish");
  assert.match(p, /translate.*Spanish/i);
  assert.match(p, /same people/i);
});

test("both together", () => {
  const p = multiplyPrompt("new parents", "French");
  assert.match(p, /new parents/);
  assert.match(p, /French/);
});

test("jobs are every audience with every language, in order, at most a batch", () => {
  const jobs = multiplierJobs(["a", "b"], ["Spanish", "French"]);
  assert.deepEqual(jobs.map((j) => `${j.audience}/${j.language}`), ["a/Spanish", "a/French", "b/Spanish", "b/French"]);
  assert.equal(multiplierJobs(Array.from({ length: 30 }, (_, i) => `a${i}`), []).length, MAX_BATCH);
});

test("nothing chosen means nothing to make; one list alone is enough", () => {
  assert.equal(multiplierJobs([], []).length, 0);
  assert.deepEqual(multiplierJobs([], ["German"]).map((j) => j.language), ["German"]);
  assert.deepEqual(multiplierJobs(["x"], []).map((j) => j.audience), ["x"]);
});
