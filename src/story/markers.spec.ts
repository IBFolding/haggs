import assert from "node:assert/strict";
import { test } from "node:test";

import { addMarker, editMarker, removeMarker, stepMarker } from "./markers";
import { createProject } from "./model";

const base = () => createProject("x");

test("a marker is a note at a moment, kept in time order and inside the cut", () => {
  let p = addMarker(base(), 8.04, "Trim this", 20);
  p = addMarker(p, 2, "Music in", 20);
  p = addMarker(p, 99, "Too late", 20);
  assert.deepEqual(p.markers!.map((m) => [m.at, m.text]), [[2, "Music in"], [8, "Trim this"], [20, "Too late"]]);
  assert.throws(() => addMarker(base(), -1, "x", 20), /inside/);
});

test("markers can be reworded and removed; none left means none kept", () => {
  let p = addMarker(base(), 3, "A", 10);
  const id = p.markers![0]!.id;
  p = editMarker(p, id, "  Changed  ");
  assert.equal(p.markers![0]!.text, "Changed");
  p = removeMarker(p, id);
  assert.equal(p.markers, undefined);
});

test("stepping jumps to the next or previous marker from where you are", () => {
  let p = addMarker(base(), 2, "a", 20);
  p = addMarker(p, 6, "b", 20);
  p = addMarker(p, 12, "c", 20);
  assert.equal(stepMarker(p, 0, 1), 2);
  assert.equal(stepMarker(p, 6, 1), 12);
  assert.equal(stepMarker(p, 6, -1), 2);
  assert.equal(stepMarker(p, 12, 1), null);
  assert.equal(stepMarker(p, 1, -1), null);
});
