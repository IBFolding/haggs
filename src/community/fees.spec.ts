import assert from "node:assert/strict";
import { test } from "node:test";

import { FEE_MAX_CENTS, checkFee, feeLabel, split } from "./fees";

test("a creator's fee is free or 1–12 cents a run, in whole cents", () => {
  assert.equal(FEE_MAX_CENTS, 12);
  assert.equal(checkFee(0), 0);
  assert.equal(checkFee(12), 12);
  assert.throws(() => checkFee(13), /12¢/);
  assert.throws(() => checkFee(-1), /12¢/);
  assert.throws(() => checkFee(2.5), /whole cents/);
});

test("each paid run splits 80% to the creator and the rest to haggs, never losing a cent", () => {
  assert.deepEqual(split(12), { creator: 9, platform: 3 });
  assert.deepEqual(split(10), { creator: 8, platform: 2 });
  assert.deepEqual(split(1), { creator: 0, platform: 1 });
  assert.deepEqual(split(0), { creator: 0, platform: 0 });
  for (let c = 0; c <= 12; c++) assert.equal(split(c).creator + split(c).platform, c);
});

test("the fee reads plainly on the Run button", () => {
  assert.equal(feeLabel(0), "free to use");
  assert.equal(feeLabel(12), "+ 12 credits to the creator");
});
