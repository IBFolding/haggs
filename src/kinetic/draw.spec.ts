import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_MOTION, drawFrame, palette, slamScale } from "./draw";
import { layout, parseSheet } from "./beats";

/** A canvas stand-in that records what was drawn. */
function fake() {
  const calls: { op: string; args: unknown[]; fill?: string }[] = [];
  const ctx: Record<string, unknown> = { fillStyle: "", font: "", textAlign: "", textBaseline: "", globalAlpha: 1 };
  for (const op of ["save", "restore", "translate", "scale", "transform", "beginPath", "rect", "clip", "roundRect", "fill", "strokeRect"]) ctx[op] = () => undefined;
  ctx.fillRect = (...args: unknown[]) => calls.push({ op: "fillRect", args, fill: String(ctx.fillStyle) });
  ctx.fillText = (...args: unknown[]) => calls.push({ op: "fillText", args, fill: String(ctx.fillStyle) });
  ctx.measureText = (t: string) => ({ width: t.length * 100 });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
const film = layout(parseSheet("bpm 120\nHELLO | 2 | white\nWORLD | 4 | flip"));

test("the current block's words are drawn in its colours on its background", () => {
  const { ctx, calls } = fake();
  assert.equal(drawFrame(ctx, 1920, 1080, film, 0.6), true);
  assert.ok(calls.some((c) => c.op === "fillText" && c.args[0] === "HELLO" && c.fill === palette("white").fg));
  assert.ok(calls.some((c) => c.op === "fillRect" && c.fill === palette("white").bg));
});

test("a flip block is dark text on the green ground", () => {
  const { ctx, calls } = fake();
  drawFrame(ctx, 1920, 1080, film, 1.5);
  assert.ok(calls.some((c) => c.op === "fillText" && c.args[0] === "WORLD" && c.fill === palette("flip").fg));
  assert.equal(palette("flip").bg, "#6ee7a0");
});

test("at the cut between blocks both are on screen (the whip pan)", () => {
  const { ctx, calls } = fake();
  drawFrame(ctx, 1920, 1080, film, 0.95);
  const words = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
  assert.ok(words.includes("HELLO") && words.includes("WORLD"));
});

test("a whip pan cannot begin before a short block starts", () => {
  const short = layout(parseSheet("bpm 120\nA | 2\nB | 0.5\nC | 2"));
  const { ctx } = fake();
  const translations: unknown[][] = [];
  ctx.translate = (...args: unknown[]) => { translations.push(args); };
  drawFrame(ctx, 1920, 1080, short, 1, {}, { ...DEFAULT_MOTION, whipBeats: 1 });
  assert.ok(!translations.some(([, y]) => y === 0), "the new block must start centered, not halfway through its outgoing pan");
});

test("zero whip-pan length makes a hard cut", () => {
  const { ctx, calls } = fake();
  drawFrame(ctx, 1920, 1080, film, 0.95, {}, { ...DEFAULT_MOTION, whipBeats: 0 });
  const words = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
  assert.ok(words.includes("HELLO"));
  assert.ok(!words.includes("WORLD"));
});

test("nothing is drawn after the end, and the call says so", () => {
  const { ctx, calls } = fake();
  assert.equal(drawFrame(ctx, 1920, 1080, film, 99), false);
  assert.equal(calls.length, 0);
});

test("a word overshoots as it lands and settles by the third of a beat", () => {
  assert.ok(slamScale(0) > 1.2);
  assert.ok(slamScale(0.34) <= 1.001);
  assert.ok(slamScale(1) === 1);
});

test("landing motion can be softened, removed, or changed to a spring", () => {
  assert.equal(slamScale(0, 0), 1);
  assert.ok(Math.abs(slamScale(0, 0.5) - (1 + (slamScale(0) - 1) * 0.5)) < 1e-12);
  assert.notEqual(slamScale(0.1, 1, "spring"), slamScale(0.1, 1, "smooth"));
  assert.equal(slamScale(1, 1, "spring"), 1);
});

test("drawing a frame applies the selected landing motion", () => {
  const { ctx } = fake();
  const scales: number[] = [];
  ctx.scale = (x: number) => { scales.push(x); };
  drawFrame(ctx, 1920, 1080, film, 0, {}, { ...DEFAULT_MOTION, intensity: 0, landing: "spring" });
  assert.deepEqual(scales, [1]);
});

function fakeMedia() {
  const calls: { op: string; args: unknown[] }[] = [];
  const { ctx, calls: base } = fake();
  (ctx as unknown as Record<string, unknown>).drawImage = (...args: unknown[]) => calls.push({ op: "drawImage", args });
  (ctx as unknown as Record<string, unknown>).createLinearGradient = () => ({ addColorStop: () => undefined });
  (ctx as unknown as Record<string, unknown>).roundRect = () => undefined;
  (ctx as unknown as Record<string, unknown>).fill = () => undefined;
  return { ctx, calls, base };
}
const media = { kiln: { el: {} as CanvasImageSource, width: 1360, height: 768 } };

test("an image block draws the picture and its label", () => {
  const { ctx, calls, base } = fakeMedia();
  const t = layout(parseSheet("bpm 120\n@image kiln | 2 | BRAND-READY AD"));
  assert.equal(drawFrame(ctx, 1920, 1080, t, 0.7, media), true);
  assert.ok(calls.some((c) => c.op === "drawImage"));
  assert.ok(base.some((c) => c.op === "fillText" && c.args[0] === "BRAND-READY AD"));
});

test("a media block whose file isn't there says which one is missing instead of failing", () => {
  const { ctx, base } = fakeMedia();
  const t = layout(parseSheet("bpm 120\n@clip nothing | 2"));
  assert.equal(drawFrame(ctx, 1920, 1080, t, 0.7, {}), true);
  assert.ok(base.some((c) => c.op === "fillText" && String(c.args[0]).toLowerCase().includes("nothing")));
});

test("a counter shows its number counting up and ends on the value", () => {
  const t = layout(parseSheet("bpm 120\n@count $0.07 | 4 | A PICTURE"));
  const shown = (s: number) => { const { ctx, calls } = fake(); drawFrame(ctx, 1920, 1080, t, s); return calls.filter((c) => c.op === "fillText").map((c) => String(c.args[0])); };
  assert.ok(shown(0.2).some((x) => x.startsWith("$0.0") && x !== "$0.07"));
  assert.ok(shown(1.9).includes("$0.07"));
  assert.ok(shown(1.9).includes("A PICTURE"));
});

test("a zoom moves in on its point as the block plays", async () => {
  const { zoomAt } = await import("./draw");
  const z = { x: 0.8, y: 0.2, scale: 2 };
  assert.equal(zoomAt(undefined, 0.5).scale > 1, true);
  assert.equal(zoomAt(z, 0).scale, 1);
  assert.ok(zoomAt(z, 1).scale > 1.9);
  assert.ok(zoomAt(z, 1).x > 0.7);
});

test("motion strength also bounds camera zoom and its default push", async () => {
  const { zoomAt } = await import("./draw");
  const z = { x: 0.8, y: 0.2, scale: 2 };
  assert.deepEqual(zoomAt(z, 0.5, 0), { x: 0.5, y: 0.5, scale: 1 });
  assert.deepEqual(zoomAt(undefined, 0.5, 0), { x: 0.5, y: 0.5, scale: 1 });
  assert.ok(zoomAt(z, 1, 0.5).scale < zoomAt(z, 1, 1).scale);
});

test("a theme changes the colours: the accent is the flip ground and the ink is the dark ground", () => {
  assert.equal(palette("flip", { accent: "#ff7a00" }).bg, "#ff7a00");
  assert.equal(palette("white", { ink: "#101828" }).bg, "#101828");
  const { ctx, calls } = fake();
  drawFrame(ctx, 1920, 1080, layout(parseSheet("bpm 120\nHI | 2 | flip")), 0.4, {}, DEFAULT_MOTION, { theme: { accent: "#ff7a00" } });
  assert.ok(calls.some((c) => c.op === "fillRect" && c.fill === "#ff7a00"));
});

test("a zoom-through cut still shows both blocks at the boundary", () => {
  const t = layout(parseSheet("bpm 120\nHELLO | 2 | white\nWORLD | 4 | flip"));
  const { ctx, calls } = fake();
  drawFrame(ctx, 1920, 1080, t, 0.95, {}, DEFAULT_MOTION, { transition: "zoom" });
  const words = calls.filter((c) => c.op === "fillText").map((c) => c.args[0]);
  assert.ok(words.includes("HELLO") && words.includes("WORLD"));
});

test("a stack shows more of its words as the beats pass", () => {
  const t = layout(parseSheet("bpm 120\n@stack ONE / TWO / THREE | 6 | white"));
  const shown = (s: number) => { const { ctx, calls } = fake(); drawFrame(ctx, 1920, 1080, t, s); return calls.filter((c) => c.op === "fillText").map((c) => c.args[0]); };
  assert.deepEqual(shown(0.1), ["ONE"]);
  assert.deepEqual(shown(1.2), ["ONE", "TWO"]);
  assert.deepEqual(shown(2.6), ["ONE", "TWO", "THREE"]);
});

test("a bar shows its percentage rising to the value and its label", () => {
  const t = layout(parseSheet("bpm 120\n@bar 80 | 4 | SHIPPED"));
  const shown = (s: number) => { const { ctx, calls } = fake(); drawFrame(ctx, 1920, 1080, t, s); return calls.filter((c) => c.op === "fillText").map((c) => String(c.args[0])); };
  assert.ok(shown(0.2).some((x) => /^\d+%$/.test(x) && x !== "80%"));
  assert.ok(shown(1.9).includes("80%"));
  assert.ok(shown(1.9).includes("SHIPPED"));
});

test("the frame works at a vertical size too, with the same words", () => {
  const { ctx, calls } = fake();
  assert.equal(drawFrame(ctx, 720, 1280, layout(parseSheet("bpm 120\nVERTICAL | 2 | green")), 0.5), true);
  assert.ok(calls.some((c) => c.op === "fillText" && c.args[0] === "VERTICAL"));
});
