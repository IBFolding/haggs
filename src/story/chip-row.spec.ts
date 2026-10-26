import assert from "node:assert/strict";
import test from "node:test";

import { isCustom, visibleOptions } from "./chip-row";

const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

test("a short row shows every choice", () => {
  assert.deepEqual(visibleOptions(["x", "y"], "x", false), { shown: ["x", "y"], hidden: 0 });
});

test("a long row folds after eight and says how many are hidden", () => {
  const r = visibleOptions(many, "a", false);
  assert.equal(r.shown.length, 8);
  assert.equal(r.hidden, 4);
});

test("the picked choice stays visible even when it is in the folded part", () => {
  const r = visibleOptions(many, "k", false);
  assert.ok(r.shown.includes("k"));
  assert.equal(r.hidden, 3);
});

test("expanding shows everything", () => {
  assert.deepEqual(visibleOptions(many, "a", true), { shown: many, hidden: 0 });
});

test("your own words count as custom, a listed choice or nothing does not", () => {
  assert.equal(isCustom(many, "a"), false);
  assert.equal(isCustom(many, ""), false);
  assert.equal(isCustom(many, "a dusty attic"), true);
});
