import assert from "node:assert/strict";
import { test } from "node:test";

import { runFromStill } from "./gallery-run";

test("a finished picture becomes a Gallery run with the price of one picture", () => {
  const run = runFromStill("a lighthouse at dusk", "Comic panel", { ok: true, url: "/api/local/a.png" });
  assert.deepEqual(run, { modelId: "still", modelName: "Comic panel", prompt: "a lighthouse at dusk", settings: {}, url: "/api/local/a.png", kind: "image", usd: 0.0686 });
});

test("a failed or empty picture is not kept", () => {
  assert.equal(runFromStill("x", "Comic panel", { ok: false }), null);
  assert.equal(runFromStill("x", "Comic panel", { ok: true }), null);
});
