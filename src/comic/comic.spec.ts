import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_W, STARTERS, emptyStyle, styleSheetPrompt, styleWords, bubbleSlots, comicProject, imageRatio, layoutPanels, newPanel, panelPrompt, wrapWords } from "./comic";

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

test("a style sheet becomes words that go into every panel", () => {
  const sheet = { ...emptyStyle(), notes: "Heavy shadows, a rain-soaked city at night.", palette: ["electric blue", "deep violet"], line: "bold" as const };
  const w = styleWords(sheet);
  assert.match(w, /bold linework\./);
  assert.match(w, /Colour palette: electric blue, deep violet\./);
  assert.match(w, /Art direction: Heavy shadows, a rain-soaked city at night\./);
  assert.equal(styleWords(emptyStyle()), "");
  assert.match(styleWords({ ...emptyStyle(), refs: ["/a.png"] }), /Match the art style of the reference/);
  const p = panelPrompt(newPanel({ action: "She leaps across the alley." }), "ink", [], undefined, sheet);
  assert.match(p, /electric blue/);
});

test("the style sheet page asks for poses, swatches and line samples and no words", () => {
  const p = styleSheetPrompt("noir", { ...emptyStyle(), palette: ["red"] }, ["Juno: curly black hair."]);
  assert.match(p, /Noir graphic novel/);
  assert.match(p, /Juno: curly black hair/);
  assert.match(p, /three poses/);
  assert.match(p, /colour swatches/);
  assert.match(p, /No text/);
});

test("the starter story is original: a young hero and a lightning storm", () => {
  const s = STARTERS[0]!;
  assert.equal(s.id, "spark");
  assert.ok(s.panels.some((p) => /lightning/i.test(p.action)));
  assert.ok(!s.panels.some((p) => /wheat|farmer|baseball glove|jar/i.test(p.action)));
});

test("motion comic preserves selected order, source art, timing and editable dialogue without generating", () => {
  const a = newPanel({ action: "A opens the door", include: false });
  const b = newPanel({ action: "B looks back", seconds: 7, motion: "Slow push", caption: "LATER", lines: [{ who: "B", text: "Wait." }] });
  const c = newPanel({ action: "C leaves", seconds: 500 });
  const project = comicProject("Custom story", [c, a, b], { [a.id]: "a.png", [b.id]: "b.png", [c.id]: "c.png" }, true);
  const board = project.boards![0]!;
  assert.equal(board.aspect, "9:16");
  assert.deepEqual(board.shots.map((s) => s.seconds), [15, 7]);
  assert.deepEqual(board.shots.map((s) => s.render?.url), ["c.png", "b.png"]);
  assert.deepEqual(board.shots[1]!.refs, ["b.png"]);
  assert.match(board.shots[1]!.beat, /Motion: Slow push/);
  assert.equal(board.shots[1]!.voices![0]!.text, "Wait.");
  assert.equal(board.shots[1]!.voices![0]!.url, undefined);
  assert.ok(board.shots.every((s) => s.render?.kind === "image"));
  assert.throws(() => comicProject("none", [a], { [a.id]: "a.png" }), /at least one/);
});
