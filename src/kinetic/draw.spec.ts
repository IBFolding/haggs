import assert from "node:assert/strict";
import { test } from "node:test";

import { drawFrame, palette, slamScale } from "./draw";
import { layout, parseSheet } from "./beats";

/** A canvas stand-in that records what was drawn. */
function fake() {
  const calls: { op: string; args: unknown[]; fill?: string }[] = [];
  const ctx: Record<string, unknown> = { fillStyle: "", font: "", textAlign: "", textBaseline: "", globalAlpha: 1 };
  for (const op of ["save", "restore", "translate", "scale", "transform", "beginPath", "rect", "clip"]) ctx[op] = () => undefined;
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
