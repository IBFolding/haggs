import assert from "node:assert/strict";
import { test } from "node:test";

import { checkFrames, parseFocus } from "./focus";

const jpeg = (n = 10) => `data:image/jpeg;base64,${"A".repeat(n)}`;

test("a clean answer is read into a point per picture", () => {
  const out = parseFocus('[{"i":0,"x":0.31,"y":0.4},{"i":1,"x":0.8,"y":0.22}]', ["a", "b"]);
  assert.deepEqual(out, { a: { x: 0.31, y: 0.4 }, b: { x: 0.8, y: 0.22 } });
});

test("an answer wrapped in words or a code fence is still read", () => {
  const out = parseFocus('Here you go:\n```json\n[{"i":0,"x":0.5,"y":0.3}]\n```\nHope that helps.', ["a"]);
  assert.deepEqual(out, { a: { x: 0.5, y: 0.3 } });
});

test("points outside the picture are pulled in, and unknown or broken entries are ignored", () => {
  const out = parseFocus('[{"i":0,"x":1.7,"y":-0.2},{"i":5,"x":0.5,"y":0.5},{"i":1,"x":"left","y":0.5},{"i":0}]', ["a", "b"]);
  assert.deepEqual(out, { a: { x: 1, y: 0 } });
});

test("an answer that is not a list gives nothing rather than an error", () => {
  assert.deepEqual(parseFocus("I can't tell.", ["a"]), {});
  assert.deepEqual(parseFocus("", ["a"]), {});
  assert.deepEqual(parseFocus('{"x":0.5}', ["a"]), {});
});

test("only a few small jpegs are accepted at a time", () => {
  assert.equal(checkFrames([{ id: "a", jpeg: jpeg() }]), null);
  assert.match(checkFrames([]) ?? "", /nothing/i);
  assert.match(checkFrames(Array.from({ length: 9 }, (_, i) => ({ id: String(i), jpeg: jpeg() }))) ?? "", /at a time/i);
  assert.match(checkFrames([{ id: "a", jpeg: "https://evil.test/x.jpg" }]) ?? "", /picture/i);
  assert.match(checkFrames([{ id: "a", jpeg: jpeg(600_000) }]) ?? "", /too big/i);
  assert.match(checkFrames([{ id: "a", jpeg: "data:image/svg+xml;base64,AAAA" }]) ?? "", /picture/i);
});
