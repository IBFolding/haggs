import assert from "node:assert/strict";
import { test } from "node:test";

import { CARD_H, CARD_W, addNote, empty, groupCards, membersOf, moveCard, moveFrame, place, prune, removeFrame, resizeFrame } from "./workspace";

test("new pictures are laid out in free cells and never on top of each other", () => {
  const first = place(empty(), ["a", "b", "c"]);
  const spots = new Set(Object.values(first.cards).map((c) => `${c.x},${c.y}`));
  assert.equal(spots.size, 3);
  const more = place(first, ["a", "d"]);
  assert.deepEqual(more.cards.a, first.cards.a, "a picture already placed does not move");
  assert.equal(new Set(Object.values(more.cards).map((c) => `${c.x},${c.y}`)).size, 4);
});

test("grouping draws a named frame around the chosen pictures", () => {
  const l = moveCard(moveCard(place(empty(), ["a", "b"]), "a", 100, 100), "b", 500, 300);
  const g = groupCards(l, ["a", "b"], "Moodboard");
  assert.equal(g.frames.length, 1);
  const f = g.frames[0]!;
  assert.equal(f.name, "Moodboard");
  assert.ok(f.x < 100 && f.y < 100, "the frame reaches past the first picture");
  assert.ok(f.x + f.w > 500 + CARD_W && f.y + f.h > 300 + CARD_H, "and past the last");
  assert.deepEqual(membersOf(g, f.id).sort(), ["a", "b"]);
});

test("a picture outside every frame belongs to none", () => {
  const l = groupCards(moveCard(moveCard(place(empty(), ["a", "b"]), "a", 100, 100), "b", 1600, 1200), ["a"], "One");
  assert.deepEqual(membersOf(l, l.frames[0]!.id), ["a"]);
});

test("dragging a frame carries the pictures inside it and leaves the rest", () => {
  let l = moveCard(moveCard(place(empty(), ["a", "b", "z"]), "a", 100, 100), "b", 360, 100);
  l = moveCard(l, "z", 1800, 900);
  l = groupCards(l, ["a", "b"], "Pair");
  const moved = moveFrame(l, l.frames[0]!.id, 50, 70);
  assert.deepEqual([moved.cards.a!.x, moved.cards.a!.y], [150, 170]);
  assert.deepEqual([moved.cards.b!.x, moved.cards.b!.y], [410, 170]);
  assert.deepEqual(moved.cards.z, l.cards.z);
  assert.equal(moved.frames[0]!.x, l.frames[0]!.x + 50);
});

test("ungrouping removes the frame and keeps every picture where it is", () => {
  const l = groupCards(place(empty(), ["a", "b"]), ["a", "b"], "Gone");
  const after = removeFrame(l, l.frames[0]!.id);
  assert.equal(after.frames.length, 0);
  assert.deepEqual(after.cards, l.cards);
});

test("a frame cannot be shrunk to nothing", () => {
  const l = groupCards(place(empty(), ["a"]), ["a"], "x");
  const r = resizeFrame(l, l.frames[0]!.id, 5, 5);
  assert.ok(r.frames[0]!.w >= 160 && r.frames[0]!.h >= 120);
});

test("pictures that are gone from the page are dropped from the workspace, notes stay", () => {
  const l = addNote(place(empty(), ["a", "b"]), "Try warmer light", 40, 40);
  const p = prune(l, ["a"]);
  assert.deepEqual(Object.keys(p.cards), ["a"]);
  assert.equal(p.notes.length, 1);
});

test("a frame around pictures near the top-left edge still starts on the table", () => {
  const g = groupCards(place(empty(), ["a"]), ["a"], "Edge");
  assert.ok(g.frames[0]!.x >= 0 && g.frames[0]!.y >= 0);
  assert.deepEqual(membersOf(g, g.frames[0]!.id), ["a"]);
});
