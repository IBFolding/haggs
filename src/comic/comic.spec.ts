import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_W, STARTERS, bubbleSlots, comicProject, imageRatio, layoutPanels, newPanel, panelPrompt, wrapWords } from "./comic";

test("a strip puts three panels in a row, inside the page, never overlapping", () => {
  const { rects, width, height } = layoutPanels(["wide", "wide", "wide", "wide"], "strip");
  assert.equal(rects.length, 4);
  assert.equal(rects[0]!.y, rects[1]!.y);
  assert.ok(rects[3]!.y > rects[0]!.y + rects[0]!.h, "the fourth starts a new row");
  assert.ok(rects.every((r) => r.x >= 0 && r.x + r.w <= width));
  assert.ok(rects[2]!.x + rects[2]!.w < rects[2]!.x + rects[2]!.w + 1 && height > rects[3]!.y + rects[3]!.h);
  assert.equal(width, PAGE_W);
});

test("a row is as tall as its tallest panel, so the row stays square", () => {
  const { rects } = layoutPanels(["wide", "tall"], "page");
  assert.equal(rects[0]!.h, rects[1]!.h);
  assert.ok(rects[0]!.h > rects[0]!.w * 0.9, "the tall panel sets the height");
});

test("a webtoon is one column, each panel under the last", () => {
  const { rects } = layoutPanels(["wide", "square", "tall"], "webtoon");
  assert.ok(rects.every((r) => r.x === rects[0]!.x));
  assert.ok(rects[1]!.y > rects[0]!.y + rects[0]!.h && rects[2]!.y > rects[1]!.y + rects[1]!.h);
});

test("speech is wrapped on whole words", () => {
  assert.deepEqual(wrapWords("Come on... give me a good one!", 14), ["Come on...", "give me a good", "one!"]);
  assert.deepEqual(wrapWords("", 10), []);
  assert.deepEqual(wrapWords("Supercalifragilistic", 5), ["Supercalifragilistic"]);
});

test("bubbles sit inside their panel and never more than two", () => {
  const rect = { x: 100, y: 50, w: 400, h: 225 };
  const slots = bubbleSlots(rect, 3);
  assert.equal(slots.length, 2);
  for (const s of slots) assert.ok(s.x >= rect.x && s.y >= rect.y && s.x + s.w <= rect.x + rect.w && s.y + s.h <= rect.y + rect.h);
});

test("the picture prompt carries the look, who is in it and asks for no text", () => {
  const p = panelPrompt(newPanel({ action: "She catches the glowing orb." }), "ink", ["Mae: red hair, yellow coat. Keep this person exactly the same."], "A wheat field at dusk.");
  assert.match(p, /bold black ink outlines/);
  assert.match(p, /Mae: red hair/);
  assert.match(p, /The panel shows: She catches the glowing orb\./);
  assert.match(p, /No text, no speech bubbles/);
  assert.equal(imageRatio("tall"), "9:16");
  assert.equal(imageRatio("wide"), "16:9");
});

test("panels become a project of shots, one per picture that exists", () => {
  const a = newPanel({ action: "One", caption: "NIGHT." });
  const b = newPanel({ action: "Two" });
  const p = comicProject("Storm", [a, b], { [a.id]: "/api/local/a.png" });
  const shots = p.boards![0]!.shots;
  assert.equal(shots.length, 1);
  assert.equal(shots[0]!.caption, "NIGHT.");
  assert.equal(shots[0]!.render?.url, "/api/local/a.png");
  assert.throws(() => comicProject("x", [b], {}), /at least one/);
});

test("the starter stories are whole: every panel says what happens", () => {
  for (const s of STARTERS) assert.ok(s.panels.length >= 4 && s.panels.every((p) => p.action.length > 20), s.id);
});
