import assert from "node:assert/strict";
import { test } from "node:test";

import { creditsOf, creditsText, perUnitText, totalText } from "./price-text";

test("a price is a whole number of credits, rounded up the way a run is charged", () => {
  assert.equal(creditsOf(0.772), 78);
  assert.equal(creditsOf(0.07), 7);
  assert.equal(creditsOf(0.003), 1);
  assert.equal(creditsOf(1.5), 150);
});

test("it reads as words a person can say, one credit being singular", () => {
  assert.equal(creditsText(0.772), "78 credits");
  assert.equal(creditsText(0.01), "1 credit");
  assert.equal(creditsText(0), "free");
  assert.equal(creditsText(null), "···");
});

test("thousands get a separator so a big number is easy to read", () => {
  assert.equal(creditsText(12.5), "1,250 credits");
});

test("a total is charged run by run, so it is the sum of each run's credits", () => {
  assert.equal(totalText([0.003, 0.003, 0.003]), "3 credits");
  assert.equal(totalText([0.07, 0.07, 0.035]), "18 credits");
  assert.equal(totalText([]), "0 credits");
});

test("a rate per second or per picture keeps the part of a credit that matters", () => {
  assert.equal(perUnitText(0.0023, "second"), "0.23 credits a second");
  assert.equal(perUnitText(0.07, "image"), "7 credits an image");
  assert.equal(perUnitText(0.018, "second"), "1.8 credits a second");
  assert.equal(perUnitText(0.4, "second"), "40 credits a second");
});
