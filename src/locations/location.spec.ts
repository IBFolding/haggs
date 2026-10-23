import assert from "node:assert/strict";
import { test } from "node:test";

import { PLACE_ROWS, blankPlace, createPlaceStore, placeLock, placePrompt, type Place } from "./location";
import { memoryKv } from "../story/kv";

const p: Place = { ...blankPlace(), name: "Harbour bar", setting: "bar", where: "interior", timeOfDay: "night", weather: "rain outside", season: "autumn", era: "1980s", mood: "melancholy", style: "weathered wood and brass", details: "a jukebox in the corner, rain on the windows" };

test("every place row has real choices and the blank place fills them", () => {
  assert.ok(PLACE_ROWS.length >= 7);
  for (const r of PLACE_ROWS) assert.ok(r.options.length >= 2, r.id);
  const b = blankPlace();
  for (const r of PLACE_ROWS) assert.ok(r.options.includes(b[r.id] as string), r.id);
});

test("the plate prompt describes the place with nobody in it, from the traits", () => {
  const t = placePrompt(p, false);
  assert.match(t, /interior of a bar/i);
  assert.match(t, /night/);
  assert.match(t, /rain outside/);
  assert.match(t, /1980s/);
  assert.match(t, /weathered wood and brass/);
  assert.match(t, /jukebox in the corner/);
  assert.match(t, /no people/i);
  assert.match(placePrompt({ ...p, where: "exterior", setting: "street" }, false), /exterior of a street|street, exterior/i);
});

test("from a picture, the place in it is kept and only the traits change", () => {
  assert.match(placePrompt(p, true), /the place in the reference picture.*keep its layout/i);
});

test("the place lock is the sentence every shot set there carries", () => {
  const l = placeLock(p);
  assert.ok(l.length < 400);
  assert.match(l, /Harbour bar/);
  assert.match(l, /night/);
});

test("places are saved with their plate and extra views, newest first", async () => {
  const s = createPlaceStore(memoryKv());
  const a = await s.save({ traits: p, plate: "/api/local/a.png", views: [], reference: null });
  await s.save({ traits: { ...p, name: "Rooftop" }, plate: "/api/local/b.png", views: ["/api/local/b2.png"], reference: null });
  assert.deepEqual((await s.list()).map((x) => x.traits.name), ["Rooftop", "Harbour bar"]);
  await s.save({ ...a, views: ["/api/local/a2.png"] });
  assert.deepEqual((await s.load(a.id))!.views, ["/api/local/a2.png"]);
  await s.remove(a.id);
  assert.equal((await s.list()).length, 1);
});
