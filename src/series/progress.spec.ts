import assert from "node:assert/strict";
import { test } from "node:test";
import { seriesProgress } from "./progress";
const series = { title: "Test", episodes: [{ hook: "One", shots: [{ picture: "A", seconds: 4, caption: "", narration: "Hello" }, { picture: "B", seconds: 4, caption: "", narration: "" }] }] };
test("episode progress ignores stale keys and counts only required voice lines", () => {
  assert.deepEqual(seriesProgress(series, { "0.0": "a", "9.9": "old" }, { "0.1": "b" }, { "0.1": "irrelevant", "9.9": "old" }), [{ total: 2, images: 1, videos: 1, narration: 0, narrationTotal: 1 }]);
});
test("completed media is counted without asserting a finished exported episode", () => {
  assert.equal(seriesProgress(series, { "0.0": "a", "0.1": "b" }, {}, { "0.0": "voice" })[0]?.narration, 1);
});
