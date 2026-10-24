import assert from "node:assert/strict";
import { test } from "node:test";

import { OUTFIT_IDEAS, castWords, castReferences } from "./cast";

test("the words after your prompt name the person, what they wear, and the place, each once", () => {
  const w = castWords("A walk through the rain", { characterLock: "Maya: a 30-year-old woman. Keep this person exactly the same in every shot.", placeLock: "Dock 9: a rainy container port. Keep this place exactly the same in every shot set here.", outfit: ["a green raincoat", "round glasses"] });
  assert.match(w, /^A walk through the rain/);
  assert.match(w, /Maya: a 30-year-old woman/);
  assert.match(w, /wearing a green raincoat and round glasses/i);
  assert.match(w, /Dock 9/);
  assert.equal(w.match(/Maya/g)!.length, 1);
});

test("with no one picked the prompt is left exactly as it was", () => {
  assert.equal(castWords("A quiet street", {}), "A quiet street");
  assert.equal(castWords("A quiet street", { outfit: [] }), "A quiet street");
});

test("pictures of your cast go in as references only when you haven't attached a picture, and never past what the model takes", () => {
  assert.deepEqual(castReferences({ attached: [], character: "/c.png", place: "/p.png", max: 4 }), ["/c.png", "/p.png"]);
  assert.deepEqual(castReferences({ attached: ["/mine.png"], character: "/c.png", place: "/p.png", max: 4 }), []);
  assert.deepEqual(castReferences({ attached: [], character: "/c.png", place: "/p.png", max: 1 }), ["/c.png"]);
  assert.deepEqual(castReferences({ attached: [], character: "/c.png", place: null, max: 0 }), []);
});

test("pictures of accessories follow the character and place, within what the model takes", () => {
  assert.deepEqual(castReferences({ attached: [], character: "/c.png", place: "/p.png", accessories: ["/a.png", "/b.png"], max: 4 }), ["/c.png", "/p.png", "/a.png", "/b.png"]);
  assert.deepEqual(castReferences({ attached: [], character: "/c.png", place: "/p.png", accessories: ["/a.png"], max: 2 }), ["/c.png", "/p.png"]);
  assert.deepEqual(castReferences({ attached: [], character: null, place: null, accessories: ["/a.png"], max: 4 }), ["/a.png"]);
  assert.deepEqual(castReferences({ attached: ["/mine.png"], character: null, place: null, accessories: ["/a.png"], max: 4 }), []);
});

test("there are accessories and clothes to start from", () => {
  assert.ok(OUTFIT_IDEAS.length >= 10);
});
