import assert from "node:assert/strict";
import { test } from "node:test";

import { searchRuns } from "./gallery-search";
import type { Run } from "./runs";

const run = (over: Partial<Run>): Run => ({ id: "r", modelId: "m", modelName: "FLUX 3", prompt: "a fox in snow", settings: {}, url: "/x.png", kind: "image", usd: 0.07, at: 1, ...over });
const runs = [
  run({ id: "1", prompt: "A red fox in a snowy forest" }),
  run({ id: "2", prompt: "Neon street at night", modelName: "Veo 3.1", kind: "video" }),
  run({ id: "3", prompt: "Advertisement for Ember mug", modelName: "Ad", settings: { ratio: "4:5" } }),
];

test("an empty search keeps everything", () => {
  assert.equal(searchRuns(runs, "").length, 3);
  assert.equal(searchRuns(runs, "   ").length, 3);
});

test("every word must match, in any order, ignoring case", () => {
  assert.deepEqual(searchRuns(runs, "snowy FOX").map((r) => r.id), ["1"]);
  assert.deepEqual(searchRuns(runs, "fox night").map((r) => r.id), []);
});

test("it also searches the model, the kind and the settings", () => {
  assert.deepEqual(searchRuns(runs, "veo").map((r) => r.id), ["2"]);
  assert.deepEqual(searchRuns(runs, "video").map((r) => r.id), ["2"]);
  assert.deepEqual(searchRuns(runs, "4:5").map((r) => r.id), ["3"]);
});

test("punctuation in the query doesn't break it", () => {
  assert.deepEqual(searchRuns(runs, "mug.").map((r) => r.id), ["3"]);
  assert.deepEqual(searchRuns(runs, "(").length, 3);
});
