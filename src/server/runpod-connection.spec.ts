import test from "node:test";
import assert from "node:assert/strict";
import { sealRunpod, unsealRunpod } from "./runpod-connection";
test("RunPod key is sealed, account bound, tamper checked and expires", () => {
  const value = {
      id: "fixture",
      endpoint: "fixture-endpoint",
      key: "fixture-not-a-real-api-key",
      owner: "owner-one",
      expires: Date.now() + 10000,
    },
    sealed = sealRunpod(value);
  assert.ok(!sealed.includes(value.key));
  assert.deepEqual(unsealRunpod(sealed, "owner-one"), value);
  assert.equal(unsealRunpod(sealed, "owner-two"), undefined);
  assert.equal(unsealRunpod("x" + sealed.slice(1), "owner-one"), undefined);
  assert.equal(
    unsealRunpod(sealRunpod({ ...value, expires: 0 }), "owner-one"),
    undefined,
  );
});
