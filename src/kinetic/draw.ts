import { blockAt, type Block, type Style, type Timeline, type WordsBlock, type Zoom } from "./beats";

export type MediaItem = { el: CanvasImageSource; width: number; height: number };
export type Media = Record<string, MediaItem>;
export type Motion = { intensity: number; landing: Landing; whipBeats: number };
export const DEFAULT_MOTION: Motion = { intensity: 1, landing: "smooth", whipBeats: 0.4 };

const GREEN = "#6ee7a0", INK = "#0a0b0c", WHITE = "#f4f4f2", RED = "#ff4d4d";
const FONT = "'Arial Black','Helvetica Neue',Impact,sans-serif";
const PALETTE: Record<Style, { bg: string; fg: string }> = {
  white: { bg: INK, fg: WHITE },
  green: { bg: INK, fg: GREEN },
  flip: { bg: GREEN, fg: INK },
  invert: { bg: WHITE, fg: INK },
  red: { bg: INK, fg: RED },
};
export const palette = (s: Style) => PALETTE[s];

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** How big a word is as it lands: a quarter too big, settling over a third of a beat. */
export type Landing = "smooth" | "spring";
export const slamScale = (beats: number, intensity = 1, landing: Landing = "smooth") => {
  const p = clamp(beats / 0.34);
  const spring = p >= 1 ? 1 : 1 - (1 + 12 * p) * Math.exp(-12 * p);
  const settled = landing === "spring" ? spring : easeOut(p);
  return 1 + 0.32 * clamp(intensity, 0, 1.5) * (1 - settled);
};

function word(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, style: Style, beats: number, motion: Motion) {
  const { fg } = PALETTE[style];
  let size = Math.round(h * 0.4);
  ctx.font = `900 ${size}px ${FONT}`;
  const width = ctx.measureText(text).width;
  const max = w * 0.9;
  if (width > max) { size = Math.floor((size * max) / width); ctx.font = `900 ${size}px ${FONT}`; }
  const s = slamScale(beats, motion.intensity, motion.landing);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(beats / 0.08);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function block(ctx: CanvasRenderingContext2D, w: number, h: number, b: Block, beats: number, media: Media, countIndex: number, motion: Motion) {
  if (b.kind === "image" || b.kind === "clip") return mediaBlock(ctx, w, h, b, media, beats, motion);
  if (b.kind === "count") return countBlock(ctx, w, h, b, beats, countIndex % 2 === 1, motion);
  const wb = b as WordsBlock;
  ctx.fillStyle = PALETTE[wb.style].bg;
  ctx.fillRect(0, 0, w, h);
  word(ctx, w, h, wb.text, wb.style, beats, motion);
}

/** Where the camera is in a block: the focus point and scale, easing in on a zoom (or a slow push when there is none). */
export function zoomAt(zoom: Zoom | undefined, progress: number, intensity = 1): { x: number; y: number; scale: number } {
  const p = easeInOut(clamp(progress));
  const amount = clamp(intensity, 0, 1.5);
  if (!zoom) return { x: 0.5, y: 0.5, scale: 1 + 0.08 * clamp(progress) * amount };
  return {
    x: clamp(0.5 + (zoom.x - 0.5) * p * amount),
    y: clamp(0.5 + (zoom.y - 0.5) * p * amount),
    scale: clamp(1 + (zoom.scale - 1) * p * amount, 1, 4),
  };
}

function cover(ctx: CanvasRenderingContext2D, m: MediaItem, w: number, h: number, cam: { x: number; y: number; scale: number }) {
  const r = Math.max(w / m.width, h / m.height) * cam.scale;
  const iw = m.width * r, ih = m.height * r;
  const x = w / 2 - cam.x * iw, y = h / 2 - cam.y * ih;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.drawImage(m.el, Math.min(0, Math.max(w - iw, x)), Math.min(0, Math.max(h - ih, y)), iw, ih);
  ctx.restore();
}

function mediaBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "image" | "clip" }>, media: Media, beats: number, motion: Motion) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  const m = media[b.name];
  if (!m) {
    ctx.fillStyle = RED; ctx.font = `900 ${Math.round(h * 0.08)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`MISSING: ${b.name.toUpperCase()}`, w / 2, h / 2); return;
  }
  cover(ctx, m, w, h, zoomAt(b.zoom, beats / b.beats, motion.intensity));
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.7)");
  ctx.fillStyle = g as unknown as string; ctx.fillRect(0, h * 0.6, w, h * 0.4);
  if (b.label) {
    const size = Math.round(h * 0.07); ctx.font = `900 ${size}px ${FONT}`;
    const tw = ctx.measureText(b.label).width + size, bh = size * 1.7, x = w * 0.04, y = h - h * 0.07 - bh;
    const rise = (1 - easeOut(clamp(beats / 0.4))) * h * 0.1;
    ctx.save(); ctx.globalAlpha = clamp(beats / 0.2); ctx.translate(0, rise);
    ctx.fillStyle = GREEN; ctx.beginPath(); ctx.roundRect(x, y, tw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.label, x + size / 2, y + bh / 2 + 2); ctx.restore();
  }
  const flash = clamp(1 - beats / 0.18);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * flash})`; ctx.fillRect(0, 0, w, h); }
}

function countBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "count" }>, beats: number, flip: boolean, motion: Motion) {
  ctx.fillStyle = flip ? GREEN : INK; ctx.fillRect(0, 0, w, h);
  const v = b.value * easeOut(clamp(beats / Math.min(1.4, b.beats * 0.7)));
  const text = `${b.prefix}${v.toFixed(b.decimals)}${b.suffix}`;
  let size = Math.round(h * 0.5); ctx.font = `900 ${size}px ${FONT}`;
  const width = ctx.measureText(text).width, max = w * 0.9; if (width > max) { size = Math.floor((size * max) / width); ctx.font = `900 ${size}px ${FONT}`; }
  const s = slamScale(beats, motion.intensity, motion.landing);
  ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.scale(s, s); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = flip ? INK : GREEN; ctx.fillText(text, 0, 0); ctx.restore();
  if (b.label) { ctx.save(); ctx.globalAlpha = clamp((beats - 0.3) / 0.4); ctx.font = `900 ${Math.round(h * 0.09)}px ${FONT}`; ctx.fillStyle = flip ? INK : WHITE; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.label, w / 2, h * 0.82); ctx.restore(); }
}

/** Draws the film at a time. False when the time is outside it (nothing is drawn). */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: Timeline, seconds: number, media: Media = {}, motion: Motion = DEFAULT_MOTION): boolean {
  const at = blockAt(t, seconds);
  if (!at) return false;
  const { item, index, beats } = at;
  const total = item.block.beats;
  const next = t.items[index + 1];
  const whipBeats = clamp(motion.whipBeats, 0, 1);
  const countsBefore = (i: number) => t.items.slice(0, i).filter((x) => x.block.kind === "count").length;
  if (next && whipBeats > 0 && beats > total - whipBeats) {
    const p = easeInOut((beats - (total - whipBeats)) / whipBeats);
    const dir = index % 2 === 0 ? 1 : -1;
    const vertical = index % 3 === 2;
    const ox = vertical ? 0 : -dir * w * p, oy = vertical ? -h * p : 0;
    ctx.save(); ctx.translate(ox, oy); block(ctx, w, h, item.block, beats, media, countsBefore(index), motion); ctx.restore();
    ctx.save(); ctx.translate(ox + (vertical ? 0 : dir * w), oy + (vertical ? h : 0)); block(ctx, w, h, next.block, 0, media, countsBefore(index + 1), motion); ctx.restore();
  } else {
    block(ctx, w, h, item.block, beats, media, countsBefore(index), motion);
  }
  return true;
}
