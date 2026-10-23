import assert from "node:assert/strict";
import test from "node:test";
import { selBox, featherOf, whereIs, meaningful, regionPrompt, selFrom } from "./region";

test("a drag makes the same box in any direction and stays inside the picture", () => {
  assert.deepEqual(selFrom({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 }), { x: 0.2, y: 0.1, w: 0.3, h: 0.5 });
  const out = selFrom({ x: 0.9, y: 0.9 }, { x: 1.4, y: 1.4 });
  assert.ok(out.x + out.w <= 1 && out.y + out.h <= 1);
});

test("a stray click is not a selection", () => {
  assert.equal(meaningful({ x: 0.1, y: 0.1, w: 0.01, h: 0.2 }), false);
  assert.equal(meaningful(null), false);
  assert.equal(meaningful({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }), true);
});

test("the seam fades over a tenth of the patch, and the prompt names the place and says change only that", () => {
  assert.equal(featherOf({ x: 0, y: 0, w: 800, h: 500 }), 50);
  assert.equal(featherOf({ x: 0, y: 0, w: 20, h: 20 }), 4);
  assert.match(regionPrompt("Give him five fingers.", { x: 0.7, y: 0.1, w: 0.2, h: 0.2 }), /^Give him five fingers\. Make this change only in the upper right part of the frame\./);
});

test("the part that is kept is exactly what was boxed, in pixels", () => {
  assert.deepEqual(selBox({ x: 0.5, y: 0.25, w: 0.25, h: 0.5 }, 2048, 1152), { x: 1024, y: 288, w: 512, h: 576 });
});

import { findAlignment, sampleAt, type Gray } from "./region";

/** A smooth test picture with some structure, big enough to match on. */
function scene(w = 64, h = 64): Gray {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) data[y * w + x] = 128 + 60 * Math.sin(x / 5) * Math.cos(y / 7) + (x > 30 && x < 44 && y > 12 && y < 40 ? 50 : 0);
  return { w, h, data };
}
/** What a model that reframes would return: the scene enlarged and shifted. */
function reframed(src: Gray, scale: number, dx: number, dy: number): Gray {
  const data = new Float32Array(src.w * src.h);
  for (let y = 0; y < src.h; y += 1) for (let x = 0; x < src.w; x += 1) {
    const pu = (x + 0.5) / src.w, pv = (y + 0.5) / src.h;
    // piece(pu) shows original at (pu - ½ - dx)/scale + ½
    data[y * src.w + x] = sampleAt(src, (pu - 0.5 - dx) / scale + 0.5, (pv - 0.5 - dy) / scale + 0.5);
  }
  return { w: src.w, h: src.h, data };
}

test("a piece returned enlarged and shifted is lined up with the original again", () => {
  const orig = scene();
  const piece = reframed(orig, 1.1, 0.04, -0.06);
  const a = findAlignment(orig, piece, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
  assert.ok(Math.abs(a.scale - 1.1) < 0.03, `scale ${a.scale}`);
  assert.ok(Math.abs(a.dx - 0.04) < 0.02, `dx ${a.dx}`);
  assert.ok(Math.abs(a.dy + 0.06) < 0.02, `dy ${a.dy}`);
});

test("a piece that already lines up is left alone", () => {
  const orig = scene();
  const a = findAlignment(orig, orig, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
  assert.deepEqual([a.scale, a.dx, a.dy].map((n) => Math.round(n * 100) / 100), [1, 0, 0]);
});

test("the edited part does not pull the match off", () => {
  const orig = scene();
  const piece = reframed(orig, 1.05, -0.03, 0.02);
  for (let y = 26; y < 38; y += 1) for (let x = 26; x < 38; x += 1) (piece.data as Float32Array)[y * piece.w + x] = 255;
  const a = findAlignment(orig, piece, { x: 0.35, y: 0.35, w: 0.3, h: 0.3 });
  assert.ok(Math.abs(a.scale - 1.05) < 0.03 && Math.abs(a.dx + 0.03) < 0.02, JSON.stringify(a));
});

test("a selection is described by where it sits", () => {
  assert.equal(whereIs({ x: 0.45, y: 0.45, w: 0.1, h: 0.1 }), "the centre of the frame");
  assert.equal(whereIs({ x: 0.0, y: 0.7, w: 0.2, h: 0.2 }), "the lower left part of the frame");
  assert.equal(whereIs({ x: 0.0, y: 0.0, w: 1, h: 0.9 }), "the large centre of the frame");
});
