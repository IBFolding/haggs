import assert from "node:assert/strict";
import { test } from "node:test";

import { blockAt, DEFAULT_SHEET, layout, parseSheet, STYLES } from "./beats";

test("a sheet is a tempo line and one block per line: words, beats, style", () => {
  const p = parseSheet("bpm 150\nCOMFY | 2 | white\nIS POWER. | 3 | green\n");
  assert.equal(p.bpm, 150);
  assert.deepEqual(p.blocks, [{ text: "COMFY", beats: 2, style: "white" }, { text: "IS POWER.", beats: 3, style: "green" }]);
  assert.deepEqual(p.problems, []);
});

test("beats and style are optional; comments and blank lines are ignored", () => {
  const p = parseSheet("# the opening\n\nHELLO\nWORLD | 4\n");
  assert.deepEqual(p.blocks.map((b) => [b.text, b.beats, b.style]), [["HELLO", 2, "white"], ["WORLD", 4, "white"]]);
  assert.equal(p.bpm, 120);
});

test("a bad line is reported with its number and skipped, the rest still parse", () => {
  const p = parseSheet("ONE | 2\nTWO | many\nTHREE | 2 | rainbow\nFOUR | 2");
  assert.deepEqual(p.blocks.map((b) => b.text), ["ONE", "FOUR"]);
  assert.equal(p.problems.length, 2);
  assert.match(p.problems[0]!, /line 2/i);
  assert.match(p.problems[1]!, /line 3.*style/i);
});

test("tempo, beats and length are kept sane", () => {
  assert.equal(parseSheet("bpm 20\nA").bpm, 60);
  assert.equal(parseSheet("bpm 900\nA").bpm, 220);
  assert.equal(parseSheet("A | 0.1").blocks[0]!.beats, 0.5);
  assert.equal(parseSheet("A | 99").blocks[0]!.beats, 32);
  const many = Array.from({ length: 200 }, (_, i) => `W${i}`).join("\n");
  assert.equal(parseSheet(many).blocks.length, 120);
  assert.ok(parseSheet(many).problems.some((m) => /120/.test(m)));
});

test("long words are cut to fit on one slam", () => {
  assert.equal(parseSheet("X".repeat(80)).blocks[0]!.text.length, 40);
});

test("the timeline puts each block on the beat grid and knows the length", () => {
  const t = layout(parseSheet("bpm 120\nA | 2\nB | 4\nC | 2"));
  assert.equal(t.secondsPerBeat, 0.5);
  assert.deepEqual(t.items.map((i) => [i.startSeconds, i.endSeconds]), [[0, 1], [1, 3], [3, 4]]);
  assert.equal(t.totalSeconds, 4);
});

test("blockAt finds the block and how many beats into it, and nothing past the end", () => {
  const t = layout(parseSheet("bpm 120\nA | 2\nB | 4"));
  const a = blockAt(t, 0.5)!; assert.equal(a.item.block.text, "A"); assert.equal(a.beats, 1);
  const b = blockAt(t, 1.25)!; assert.equal(b.item.block.text, "B"); assert.equal(b.beats, 0.5);
  assert.equal(blockAt(t, 3), null);
  assert.equal(blockAt(t, -1), null);
});

test("the default sheet parses cleanly and uses only known styles", () => {
  const p = parseSheet(DEFAULT_SHEET);
  assert.deepEqual(p.problems, []);
  assert.ok(p.blocks.length >= 10);
  for (const b of p.blocks) assert.ok(STYLES.includes(b.style));
});
