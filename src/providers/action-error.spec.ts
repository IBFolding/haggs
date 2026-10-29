import assert from "node:assert/strict";
import { test } from "node:test";
import { ProviderError } from "./types";
import { generationFailure } from "./action-error";

test("save failure job IDs cannot impersonate authentication or credit status", () => {
  for (const id of ["job-401-abc", "job-402-def"]) {
    const error = new ProviderError("comfy-cloud", `Comfy finished job ${id}, but saving failed: storage unavailable. Recover this job; do not generate again.`);
    const result = generationFailure(error, "comfy-cloud");
    assert.equal(result.reason, error.message);
    assert.equal(result.needsKey, undefined);
  }
});
test("real provider status codes still explain key and credit failures", () => {
  assert.match(generationFailure(new ProviderError("comfy-cloud", "rejected", 401), "comfy-cloud").reason, /key was rejected/);
  assert.match(generationFailure(new ProviderError("comfy-cloud", "rejected", 402), "comfy-cloud").reason, /out of credits/);
});
