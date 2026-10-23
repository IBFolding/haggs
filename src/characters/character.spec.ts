import assert from "node:assert/strict";
import { test } from "node:test";

import { TRAIT_ROWS, blank, changeNote, characterPrompt, createCharacterStore, identityLock, type Traits } from "./character";
import { memoryKv } from "../story/kv";

const t: Traits = { ...blank(), name: "Mara", age: 34, gender: "woman", build: "athletic", height: "tall", skin: "medium olive", hairStyle: "curly", hairLength: "shoulder-length", hairColor: "auburn", eyes: "green", face: "oval", facialHair: "none", glasses: "none", wardrobe: "olive field jacket over a grey henley", marks: "a small scar through the left eyebrow", look: "photoreal" };

test("every trait row offers real choices and the blank character fills them all", () => {
  assert.ok(TRAIT_ROWS.length >= 10);
  for (const row of TRAIT_ROWS) assert.ok(row.options.length >= 3, row.id);
  const b = blank();
  for (const row of TRAIT_ROWS) assert.ok(row.options.includes(b[row.id] as string), row.id);
});

test("the sheet prompt describes the person from the traits and asks for three views on plain grey", () => {
  const p = characterPrompt(t, false);
  assert.match(p, /34-year-old woman/);
  assert.match(p, /auburn curly shoulder-length hair/);
  assert.match(p, /green eyes/);
  assert.match(p, /small scar through the left eyebrow/);
  assert.match(p, /front, three-quarter and profile/i);
  assert.match(p, /plain grey/i);
  assert.doesNotMatch(p, /no facial hair|glasses/i, "traits that are 'none' say nothing");
  assert.match(characterPrompt({ ...t, glasses: "round wire-rim", facialHair: "short beard" }, false), /round wire-rim glasses.*short beard|short beard.*round wire-rim glasses/);
});

test("with a likeness, the prompt keeps the person in the photos and changes only what the traits say", () => {
  const p = characterPrompt(t, true);
  assert.match(p, /the person in the reference photos/i);
  assert.match(p, /keep their face/i);
  assert.match(p, /auburn/);
});

test("the identity lock is the sentence every shot carries, short and about the person", () => {
  const lock = identityLock(t);
  assert.ok(lock.length < 400);
  assert.match(lock, /Mara/);
  assert.match(lock, /green eyes/);
});

test("a change between two versions of a character reads as a plain note", () => {
  assert.equal(changeNote(t, { ...t, hairColor: "silver", build: "heavy" }), "build: heavy, hair colour: silver");
  assert.equal(changeNote(t, t), "");
});

test("characters are saved, listed newest first, and kept with their sheet and likeness", async () => {
  const store = createCharacterStore(memoryKv());
  const a = await store.save({ traits: t, sheet: "/api/local/a.png", likeness: [] });
  const b = await store.save({ traits: { ...t, name: "Ellis" }, sheet: "/api/local/b.png", likeness: ["/api/local/photo.png"] });
  assert.deepEqual((await store.list()).map((c) => c.traits.name), ["Ellis", "Mara"]);
  await store.save({ ...a, traits: { ...a.traits, hairColor: "silver" } });
  assert.equal((await store.load(a.id))!.traits.hairColor, "silver");
  assert.equal((await store.list()).length, 2);
  await store.remove(b.id);
  assert.deepEqual((await store.list()).map((c) => c.id), [a.id]);
});
