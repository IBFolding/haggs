import type { AtmosKind } from "./grey-scene";

/**
 * Rain, snow, fog and the rest as pictures the renderer can scroll. Each is a
 * tile that joins itself (anything crossing an edge is drawn again on the
 * other side), so sliding it past the frame shows a steady, unending sky with
 * no seam. Drawn from a seed, so the same scene always rains the same way.
 */

export type Axis = "down" | "up" | "across";
export type Layout = { axis: Axis; /** Pixels per second the tile slides. */ speed: number };

export function airLayout(kind: AtmosKind, size: { w: number; h: number }): Layout {
  switch (kind) {
    case "rain": return { axis: "down", speed: size.h * 1.6 };
    case "snow": return { axis: "down", speed: size.h * 0.12 };
    case "dust": return { axis: "down", speed: size.h * 0.02 };
    case "embers": return { axis: "up", speed: size.h * 0.14 };
    case "fog": return { axis: "across", speed: size.w * 0.03 };
    case "beams": return { axis: "across", speed: size.w * 0.02 };
  }
}

function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => +n.toFixed(2);

/** One tile, as SVG, for a frame of this size. `amount` is 0–1. */
export function airTile(kind: AtmosKind, size: { w: number; h: number }, amount: number, seed: number): string {
  const { w, h } = size;
  const r = seeded(seed);
  const area = (w * h) / (1080 * 1920);
  const parts: string[] = [];
  const defs: string[] = [];
  const dotsAt = (n: number, minR: number, maxR: number, fill: (alpha: number) => string) => {
    for (let i = 0; i < n; i++) {
      const cx = r() * w, cy = r() * h, rad = minR + r() * (maxR - minR), a = 0.35 + r() * 0.55;
      for (const dy of [0, -h, h]) if (cy + dy > -rad * 2 && cy + dy < h + rad * 2) parts.push(`<circle cx="${f(cx)}" cy="${f(cy + dy)}" r="${f(rad)}" fill="${fill(a)}"/>`);
    }
  };
  if (kind === "rain") {
    const n = Math.round(amount * 520 * area);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, len = h * (0.025 + r() * 0.04), a = 0.2 + r() * 0.4, dx = len * 0.18;
      for (const dy of [0, -h]) if (y + dy + len > 0 && y + dy < h) parts.push(`<line x1="${f(x)}" y1="${f(y + dy)}" x2="${f(x + dx)}" y2="${f(y + dy + len)}" stroke="rgba(210,222,240,${f(a)})" stroke-width="${f(Math.max(1, w * 0.0012))}" stroke-linecap="round"/>`);
    }
  } else if (kind === "snow") dotsAt(Math.round(amount * 260 * area), w * 0.002, w * 0.006, (a) => `rgba(255,255,255,${f(a)})`);
  else if (kind === "dust") dotsAt(Math.round(amount * 240 * area), w * 0.0014, w * 0.003, (a) => `rgba(255,240,210,${f(a * 0.7)})`);
  else if (kind === "embers") dotsAt(Math.round(amount * 110 * area), w * 0.002, w * 0.005, (a) => `rgba(255,${Math.round(150 + r() * 70)},60,${f(a)})`);
  else if (kind === "fog") {
    defs.push(`<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(w * 0.06)}"/></filter>`);
    for (let i = 0; i < 8; i++) {
      const cx = r() * w, cy = h * (0.35 + r() * 0.6), rx = w * (0.3 + r() * 0.3), ry = h * (0.05 + r() * 0.1);
      for (const dx of [0, -w, w]) parts.push(`<ellipse cx="${f(cx + dx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="rgba(222,228,238,${f(amount * 0.4)})" filter="url(#b)"/>`);
    }
  } else {
    defs.push(`<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(255,245,220)" stop-opacity="${f(amount * 0.28)}"/><stop offset="1" stop-color="rgb(255,245,220)" stop-opacity="0"/></linearGradient>`);
    for (let i = 0; i < 6; i++) {
      const x = r() * w, bw = w * (0.04 + r() * 0.1), lean = h * 0.18;
      for (const dx of [0, -w, w]) parts.push(`<polygon points="${f(x + dx)},0 ${f(x + dx + bw)},0 ${f(x + dx + bw - lean)},${h} ${f(x + dx - lean)},${h}" fill="url(#g)"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${parts.join("")}</svg>`;
}
