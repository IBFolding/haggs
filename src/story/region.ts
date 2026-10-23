/**
 * Picking something in a frame to change only that. The selection is drawn on
 * the picture as a box (fractions of its width and height); the part sent to
 * the model is that box with room around it, so the edit has context and the
 * seam lands on untouched pixels.
 */

export type Sel = { x: number; y: number; w: number; h: number };
export type Box = { x: number; y: number; w: number; h: number };

const unit = (n: number) => Math.min(1, Math.max(0, n));

/** The box two corners make, in any drag direction, kept inside the picture. */
export function selFrom(a: { x: number; y: number }, b: { x: number; y: number }): Sel {
  const x0 = unit(Math.min(a.x, b.x));
  const y0 = unit(Math.min(a.y, b.y));
  return { x: x0, y: y0, w: unit(Math.max(a.x, b.x)) - x0, h: unit(Math.max(a.y, b.y)) - y0 };
}

/** A drag too small to mean a box (a stray click) selects nothing. */
export const meaningful = (sel: Sel | null): sel is Sel => Boolean(sel && sel.w >= 0.03 && sel.h >= 0.03);

/** The selection itself in pixels: the only part of the model's version that is kept. */
export const selBox = (sel: Sel, width: number, height: number): Box => ({ x: Math.round(sel.x * width), y: Math.round(sel.y * height), w: Math.max(2, Math.round(sel.w * width)), h: Math.max(2, Math.round(sel.h * height)) });

/** How soft the seam is: a tenth of the shorter side, so the patch fades into the frame instead of showing an edge. */
export const featherOf = (box: Box) => Math.max(4, Math.round(Math.min(box.w, box.h) * 0.1));

/** Where a selection sits in the frame, in words a model can follow: "upper right", "centre", "lower left third". */
export function whereIs(sel: Sel): string {
  const cx = sel.x + sel.w / 2;
  const cy = sel.y + sel.h / 2;
  const across = cx < 0.36 ? "left" : cx > 0.64 ? "right" : "";
  const down = cy < 0.36 ? "upper" : cy > 0.64 ? "lower" : "";
  const place = [down, across].filter(Boolean).join(" ");
  const big = sel.w * sel.h > 0.45 ? "large " : "";
  return place ? `the ${big}${place} part of the frame` : `the ${big}centre of the frame`;
}

/** The prompt for the whole frame: change what was asked, in the boxed place, and nothing else. */
export const regionPrompt = (prompt: string, sel: Sel) =>
  `${prompt.trim().replace(/[.\s]+$/, "")}. Make this change only in ${whereIs(sel)}. Keep everything else in the picture exactly the same: framing, perspective, light, colours, every other person and object.`;

/**
 * Editing models often return a cut-out slightly reframed: a little bigger,
 * nudged to one side. Pasted as it is, that doubles edges at the seam. These
 * find the scale and shift that line the returned piece back up with the
 * original, judged only on the surroundings (the part that was not asked to
 * change), so the edit itself doesn't pull the match off.
 */
export type Gray = { w: number; h: number; data: ArrayLike<number> };
export type Align = { scale: number; dx: number; dy: number };

/** Bilinear read at normalised coordinates, clamped at the edges. */
export function sampleAt(g: Gray, u: number, v: number): number {
  const x = Math.min(g.w - 1, Math.max(0, u * g.w - 0.5));
  const y = Math.min(g.h - 1, Math.max(0, v * g.h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(g.w - 1, x0 + 1), y1 = Math.min(g.h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const at = (i: number, j: number) => g.data[j * g.w + i]!;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x1, y0) * fx * (1 - fy) + at(x0, y1) * (1 - fx) * fy + at(x1, y1) * fx * fy;
}

/**
 * Where the piece sits relative to the original: a point at (u, v) of the
 * original is at ((u − ½)·scale + ½ + dx, (v − ½)·scale + ½ + dy) of the piece.
 * `keepOut` is the edited part in the original's normalised coordinates.
 */
export function findAlignment(orig: Gray, piece: Gray, keepOut: Sel): Align {
  const points: [number, number][] = [];
  const N = 28;
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N;
      const inside = u >= keepOut.x && u <= keepOut.x + keepOut.w && v >= keepOut.y && v <= keepOut.y + keepOut.h;
      if (!inside) points.push([u, v]);
    }
  }
  if (points.length < 40) return { scale: 1, dx: 0, dy: 0 };
  const want = points.map(([u, v]) => sampleAt(orig, u, v));
  const cost = (a: Align) => {
    let sum = 0;
    for (let k = 0; k < points.length; k += 1) {
      const [u, v] = points[k]!;
      const d = sampleAt(piece, (u - 0.5) * a.scale + 0.5 + a.dx, (v - 0.5) * a.scale + 0.5 + a.dy) - want[k]!;
      sum += d * d;
    }
    return sum / points.length;
  };
  let best: Align = { scale: 1, dx: 0, dy: 0 };
  let low = cost(best);
  const search = (scales: number[], range: number, step: number, around: Align) => {
    for (const scale of scales) {
      for (let dy = -range; dy <= range + 1e-9; dy += step) {
        for (let dx = -range; dx <= range + 1e-9; dx += step) {
          const a = { scale, dx: around.dx + dx, dy: around.dy + dy };
          const c = cost(a);
          if (c < low - 1e-9) { low = c; best = a; }
        }
      }
    }
  };
  const scales = Array.from({ length: 21 }, (_, i) => 0.85 + i * 0.0225);
  search(scales, 0.16, 0.02, { scale: 1, dx: 0, dy: 0 });
  const coarse = best;
  search(Array.from({ length: 9 }, (_, i) => coarse.scale - 0.01 + i * 0.0025), 0.02, 0.005, coarse);
  return best;
}
