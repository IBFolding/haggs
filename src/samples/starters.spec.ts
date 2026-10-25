import assert from "node:assert/strict";
import { test } from "node:test";

import { ACCESSORY_SAMPLES, CHARACTER_SAMPLES, FOUND_SAMPLES, PLACE_SAMPLES } from "./starters";
import { blank, characterPrompt } from "../characters/character";
import { blankPlace } from "../locations/location";
import { searchWords } from "../found/found";
import { diagnose, summarize } from "../story/doctor";
import { EXAMPLE_FILM } from "./example-film";

test("every character sample fills every trait and makes a sheet prompt", () => {
  assert.ok(CHARACTER_SAMPLES.length >= 3);
  for (const t of CHARACTER_SAMPLES) {
    assert.deepEqual(Object.keys(t).sort(), Object.keys(blank()).sort(), t.name);
    for (const [k, v] of Object.entries(t)) assert.ok(v !== undefined && v !== null, `${t.name}.${k}`);
    assert.ok(t.name !== "New character" && characterPrompt(t, false).length > 40);
  }
  assert.equal(new Set(CHARACTER_SAMPLES.map((t) => t.name)).size, CHARACTER_SAMPLES.length);
});

test("every place sample fills every field", () => {
  assert.ok(PLACE_SAMPLES.length >= 3);
  for (const p of PLACE_SAMPLES) {
    assert.deepEqual(Object.keys(p).sort(), Object.keys(blankPlace()).sort(), p.name);
    assert.ok(p.name !== "New place" && p.setting && p.details);
  }
});

test("accessory samples have a name and words", () => {
  assert.ok(ACCESSORY_SAMPLES.length >= 3);
  for (const a of ACCESSORY_SAMPLES) assert.ok(a.name.length > 2 && a.words.length > 15);
});

test("found-footage samples give a brief whose search words are usable", () => {
  assert.ok(FOUND_SAMPLES.length >= 3);
  for (const s of FOUND_SAMPLES) assert.ok(searchWords(s.brief).length >= 2, s.brief);
});

test("the example film reads as a slow, soft cut with real advice", () => {
  const findings = diagnose(EXAMPLE_FILM.metrics);
  assert.ok(summarize(findings).score < 65);
  assert.ok(findings.filter((f) => f.level !== "good").every((f) => f.fix.length > 10));
  assert.ok(EXAMPLE_FILM.name.length > 3);
});
