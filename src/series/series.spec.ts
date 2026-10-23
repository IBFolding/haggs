import assert from "node:assert/strict";
import { test } from "node:test";

import { FORMATS, buildSeries, seriesRequest, validateSeries, SERIES_SCHEMA } from "./series";

const draft = {
  title: "What if",
  episodes: [
    { hook: "What if a human could eat endlessly?", shots: [{ picture: "A giant glowing belly in a neon city, cartoon 3D", seconds: 4, caption: "WHAT IF a human could eat endlessly?" }, { picture: "The city runs out of burgers, shelves empty", seconds: 4, caption: "The city runs out of food" }] },
    { hook: "What if teeth never stopped growing?", shots: [{ picture: "A man in a bright bathroom pulls his lip back, teeth too long", seconds: 4, caption: "" }] },
  ],
};

test("formats cover the shapes of short social series, each with its own instructions", () => {
  assert.deepEqual(FORMATS.map((f) => f.id), ["what-if", "pov", "story", "influencer"]);
  for (const f of FORMATS) assert.ok(f.rules.length > 40, f.id);
  assert.ok(SERIES_SCHEMA);
});

test("the request names the format, the topic and how many videos, and asks for vertical shots of 3–5 seconds", () => {
  const r = seriesRequest("what-if", "food and bodies", 3);
  assert.match(r.user, /food and bodies/);
  assert.match(r.user, /3 videos/);
  assert.match(r.system, /vertical/i);
  assert.throws(() => seriesRequest("nope" as never, "x", 3), /format/);
  assert.throws(() => seriesRequest("pov", "", 3), /topic/);
  assert.throws(() => seriesRequest("pov", "x", 0), /1–8/);
});

test("a draft is checked: every episode has shots, seconds are 3–5, captions are short", () => {
  assert.equal(validateSeries(draft).episodes.length, 2);
  assert.throws(() => validateSeries({ title: "x", episodes: [] }), /episode/);
  assert.throws(() => validateSeries({ title: "x", episodes: [{ hook: "h", shots: [] }] }), /shot/);
  const long = validateSeries({ title: "x", episodes: [{ hook: "h", shots: [{ picture: "p p p p", seconds: 40, caption: "c".repeat(300) }] }] });
  assert.equal(long.episodes[0]!.shots[0]!.seconds, 5);
  assert.equal(long.episodes[0]!.shots[0]!.caption.length, 120);
});

test("a series becomes one project: a vertical board per episode, a shot per picture, captions and hooks kept", () => {
  const p = buildSeries(validateSeries(draft), "what-if");
  assert.equal(p.name, "What if");
  assert.equal(p.boards!.length, 2);
  assert.equal(p.boards![0]!.name, "1 · What if a human could eat endlessly?");
  assert.equal(p.boards![0]!.aspect, "9:16");
  const shot = p.boards![0]!.shots[0]!;
  assert.equal(shot.caption, "WHAT IF a human could eat endlessly?");
  assert.equal(shot.seconds, 4);
  assert.equal(shot.model.id, "minimax/minimax-h3");
  assert.equal(shot.model.settings.ratio, "9:16");
  assert.equal(shot.render, undefined, "no pictures yet: making them costs money");
  assert.match(shot.beat, /giant glowing belly/);
});

import { staleShots } from "../story/assemble";
import { view } from "../story/boards";
import { pictureWords } from "./series";

test("a picture's words carry the persona and the look, once", () => {
  const w = pictureWords("A man at a fridge", { look: "cel-shaded 2D anime", lock: "Maya: a 30-year-old woman, braided hair" });
  assert.match(w, /A man at a fridge/);
  assert.match(w, /Maya: a 30-year-old woman/);
  assert.match(w, /cel-shaded 2D anime/);
  assert.match(w, /vertical 9:16/i);
  assert.equal(pictureWords("x", {}).includes("undefined"), false);
});

test("pictures made on the page arrive on their shots, current rather than stale, with the persona as reference", () => {
  const s = validateSeries(draft);
  const p = buildSeries(s, "what-if", { look: "storybook watercolour", lock: "Maya: a woman", refs: ["/sheet.png"], pictures: { "0.0": "/a.png", "1.0": "/b.png" } });
  const e0 = p.boards![0]!.shots;
  assert.equal(e0[0]!.render?.url, "/a.png");
  assert.equal(e0[1]!.render, undefined);
  assert.deepEqual(e0[0]!.refs, ["/sheet.png"]);
  assert.deepEqual(staleShots(view(p, p.boards![0]!.id)), []);
  assert.equal(p.boards![1]!.shots[0]!.render?.url, "/b.png");
});
