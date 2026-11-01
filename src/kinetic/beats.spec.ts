import assert from "node:assert/strict";
import { test } from "node:test";

import { blockAt, DEFAULT_SHEET, layout, parseSheet, STYLES, type Block, type WordsBlock } from "./beats";

const W = (b: Block | undefined) => b as WordsBlock;

test("a sheet is a tempo line and one block per line: words, beats, style", () => {
  const p = parseSheet("bpm 150\nCOMFY | 2 | white\nIS POWER. | 3 | green\n");
  assert.equal(p.bpm, 150);
  assert.deepEqual(p.blocks, [{ text: "COMFY", beats: 2, style: "white" }, { text: "IS POWER.", beats: 3, style: "green" }]);
  assert.deepEqual(p.problems, []);
});

test("beats and style are optional; comments and blank lines are ignored", () => {
  const p = parseSheet("# the opening\n\nHELLO\nWORLD | 4\n");
  assert.deepEqual(p.blocks.map((b) => [W(b).text, b.beats, W(b).style]), [["HELLO", 2, "white"], ["WORLD", 4, "white"]]);
  assert.equal(p.bpm, 120);
});

test("a bad line is reported with its number and skipped, the rest still parse", () => {
  const p = parseSheet("ONE | 2\nTWO | many\nTHREE | 2 | rainbow\nFOUR | 2");
  assert.deepEqual(p.blocks.map((b) => W(b).text), ["ONE", "FOUR"]);
  assert.equal(p.problems.length, 2);
  assert.match(p.problems[0]!, /line 2/i);
  assert.match(p.problems[1]!, /line 3.*style/i);
});

test("tempo, beats and length are kept sane", () => {
  assert.equal(parseSheet("bpm 20\nA").bpm, 60);
  assert.equal(parseSheet("bpm 900\nA").bpm, 220);
  assert.equal(parseSheet("A | 0.1").blocks[0]!.beats, 0.5);
  assert.equal(parseSheet("A | 99").blocks[0]!.beats, 32);
  const many = Array.from({ length: 500 }, () => "W | 0.5").join("\n");
  assert.equal(parseSheet("bpm 220\n" + many).blocks.length, 400);
  assert.ok(parseSheet("bpm 220\n" + many).problems.some((m) => /400/.test(m)));
});

test("a film runs at most five minutes, and the rest is left out with a note", () => {
  const long = Array.from({ length: 400 }, (_, i) => `W${i} | 4`).join("\n");
  const p = parseSheet("bpm 120\n" + long);
  const total = layout(p).totalSeconds;
  assert.ok(total <= 300 && total > 296, `runs ${total}s`);
  assert.ok(p.problems.some((m) => /5 minutes/.test(m)));
  assert.ok(layout(parseSheet("bpm 120\n" + Array.from({ length: 140 }, (_, i) => `W${i} | 4`).join("\n"))).totalSeconds > 270, "a 4.6 minute film is allowed");
});

test("long words are cut to fit on one slam", () => {
  assert.equal(W(parseSheet("X".repeat(80)).blocks[0]).text.length, 40);
});

test("the timeline puts each block on the beat grid and knows the length", () => {
  const t = layout(parseSheet("bpm 120\nA | 2\nB | 4\nC | 2"));
  assert.equal(t.secondsPerBeat, 0.5);
  assert.deepEqual(t.items.map((i) => [i.startSeconds, i.endSeconds]), [[0, 1], [1, 3], [3, 4]]);
  assert.equal(t.totalSeconds, 4);
});

test("blockAt finds the block and how many beats into it, and nothing past the end", () => {
  const t = layout(parseSheet("bpm 120\nA | 2\nB | 4"));
  const a = blockAt(t, 0.5)!; assert.equal(W(a.item.block).text, "A"); assert.equal(a.beats, 1);
  const b = blockAt(t, 1.25)!; assert.equal(W(b.item.block).text, "B"); assert.equal(b.beats, 0.5);
  assert.equal(blockAt(t, 3), null);
  assert.equal(blockAt(t, -1), null);
});

test("the default sheet parses cleanly and uses only known styles", () => {
  const p = parseSheet(DEFAULT_SHEET);
  assert.deepEqual(p.problems, []);
  assert.ok(p.blocks.length >= 10);
  for (const b of p.blocks.filter((x) => !x.kind)) assert.ok(STYLES.includes(W(b).style));
  assert.ok(p.blocks.some((b) => b.kind === "count"), "the default shows a counter");
});

test("image and clip blocks name a picture or a clip, with beats, an optional label and an optional zoom", () => {
  const p = parseSheet("@image Kiln | 2 | BRAND-READY AD\n@clip app-1 | 3 | A REAL EDITOR | zoom 0.7 0.4 2.2\n@image portrait");
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.blocks[0], { kind: "image", name: "kiln", beats: 2, label: "BRAND-READY AD" });
  assert.deepEqual(p.blocks[1], { kind: "clip", name: "app-1", beats: 3, label: "A REAL EDITOR", zoom: { x: 0.7, y: 0.4, scale: 2.2 } });
  assert.deepEqual(p.blocks[2], { kind: "image", name: "portrait", beats: 2, label: "" });
});

test("a zoom is kept inside the picture and at a sensible scale", () => {
  const b = parseSheet("@clip a | 2 | X | zoom 5 -3 99").blocks[0] as { zoom: { x: number; y: number; scale: number } };
  assert.deepEqual(b.zoom, { x: 1, y: 0, scale: 4 });
});

test("a counter counts up to a number, with an optional $ or % and decimals, and a label", () => {
  const p = parseSheet("@count 26 | 3 | READY-MADE APPS\n@count $0.07 | 3 | A PICTURE\n@count 99% | 2 | TESTED");
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.blocks.map((b) => b.kind === "count" && [b.value, b.prefix, b.suffix, b.decimals, b.label]), [[26, "", "", 0, "READY-MADE APPS"], [0.07, "$", "", 2, "A PICTURE"], [99, "", "%", 0, "TESTED"]]);
});

test("bad media and counter lines are reported and skipped", () => {
  const p = parseSheet("@image | 2\n@image Bad Name | 2\n@count lots | 2\n@sing x | 2\n@clip ok | 2");
  assert.equal(p.blocks.length, 1);
  assert.equal(p.problems.length, 4);
  assert.match(p.problems.join(" "), /@sing/);
});

test("media names a film uses are listed once, in order", async () => {
  const { mediaNames } = await import("./beats");
  assert.deepEqual(mediaNames(parseSheet("@image a | 2\n@clip b | 2\n@image a | 2\nWORDS").blocks), ["a", "b"]);
});

test("a stack lands its words one after another within its beats", () => {
  const p = parseSheet("@stack ONE / TWO / THREE | 4 | green");
  assert.deepEqual(p.problems, []);
  assert.deepEqual(p.blocks[0], { kind: "stack", words: ["ONE", "TWO", "THREE"], beats: 4, style: "green" });
  assert.equal((parseSheet("@stack A | 2").blocks[0] as { words: string[] }).words.length, 1);
  assert.equal((parseSheet("@stack " + Array.from({ length: 12 }, (_, i) => "W" + i).join(" / ")).blocks[0] as { words: string[] }).words.length, 6);
});

test("a bar fills to a percentage with a label", () => {
  const p = parseSheet("@bar 80 | 3 | SHIPPED\n@bar 250 | 2");
  assert.deepEqual(p.blocks[0], { kind: "bar", value: 80, beats: 3, label: "SHIPPED" });
  assert.equal((p.blocks[1] as { value: number }).value, 100);
});

test("bad stack and bar lines are reported", () => {
  const p = parseSheet("@stack | 2\n@bar lots | 2");
  assert.equal(p.blocks.length, 0);
  assert.equal(p.problems.length, 2);
});

test("withBpm sets the tempo line, replacing an old one or adding one at the top", async () => {
  const { withBpm } = await import("./beats");
  assert.equal(withBpm("bpm 120\nA | 2", 150), "bpm 150\nA | 2");
  assert.equal(withBpm("A | 2\n", 98.5), "bpm 98.5\nA | 2\n");
  assert.equal(parseSheet(withBpm("A | 2", 33)).bpm, 60);
});
