import { blockAt, type Block, type Style, type Timeline, type WordsBlock, type Zoom } from "./beats";
import { occurrenceKey } from "./media";

export type MediaItem = { el: CanvasImageSource; width: number; height: number };
export type Media = Record<string, MediaItem>;
export type Motion = { intensity: number; landing: Landing; whipBeats: number };
export const DEFAULT_MOTION: Motion = { intensity: 1, landing: "smooth", whipBeats: 0.4 };

/** The look: dark ground, light text, one accent, a warning colour, and the display face. */
export type Theme = { ink: string; paper: string; accent: string; red: string; font: string };
export type Transition = "whip" | "zoom";
/** Look and cut style. Motion (strength, landing, whip length) stays separate; a whip length of 0 is a hard cut. */
export type Look = { theme?: Partial<Theme>; transition?: Transition };

export const FONTS: { id: string; label: string; css: string }[] = [
  { id: "black", label: "Arial Black", css: "'Arial Black','Helvetica Neue',Impact,sans-serif" },
  { id: "impact", label: "Impact", css: "Impact,'Arial Narrow Bold','Arial Black',sans-serif" },
  { id: "serif", label: "Georgia", css: "Georgia,'Times New Roman',serif" },
  { id: "mono", label: "Courier", css: "'Courier New',Courier,monospace" },
  { id: "round", label: "Trebuchet", css: "'Trebuchet MS','Helvetica Neue',sans-serif" },
];
export const DEFAULT_THEME: Theme = { ink: "#0a0b0c", paper: "#f4f4f2", accent: "#6ee7a0", red: "#ff4d4d", font: FONTS[0]!.css };
const themed = (t?: Partial<Theme>): Theme => ({ ...DEFAULT_THEME, ...t });

export function palette(s: Style, theme?: Partial<Theme>): { bg: string; fg: string } {
  const t = themed(theme);
  return { white: { bg: t.ink, fg: t.paper }, green: { bg: t.ink, fg: t.accent }, flip: { bg: t.accent, fg: t.ink }, invert: { bg: t.paper, fg: t.ink }, red: { bg: t.ink, fg: t.red } }[s];
}

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

function word(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, style: Style, beats: number, motion: Motion, th: Theme) {
  const { fg } = palette(style, th);
  let size = Math.round(h * 0.4);
  ctx.font = `900 ${size}px ${th.font}`;
  const width = ctx.measureText(text).width;
  const max = w * 0.9;
  if (width > max) { size = Math.floor((size * max) / width); ctx.font = `900 ${size}px ${th.font}`; }
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

function block(ctx: CanvasRenderingContext2D, w: number, h: number, b: Block, beats: number, media: Media, countIndex: number, motion: Motion, th: Theme) {
  if (b.kind === "image" || b.kind === "clip") return mediaBlock(ctx, w, h, b, media, beats, motion, th);
  if (b.kind === "count") return countBlock(ctx, w, h, b, beats, countIndex % 2 === 1, motion, th);
  if (b.kind === "stack") return stackBlock(ctx, w, h, b, beats, motion, th);
  if (b.kind === "bar") return barBlock(ctx, w, h, b, beats, motion, th);
  const wb = b as WordsBlock;
  ctx.fillStyle = palette(wb.style, th).bg;
  ctx.fillRect(0, 0, w, h);
  word(ctx, w, h, wb.text, wb.style, beats, motion, th);
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

function mediaBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "image" | "clip" }>, media: Media, beats: number, motion: Motion, th: Theme) {
  ctx.fillStyle = th.ink; ctx.fillRect(0, 0, w, h);
  const m = media[b.name];
  if (!m) {
    ctx.fillStyle = th.red; ctx.font = `900 ${Math.round(Math.min(w, h) * 0.07)}px ${th.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`MISSING: ${b.name.toUpperCase()}`, w / 2, h / 2); return;
  }
  cover(ctx, m, w, h, zoomAt(b.zoom, beats / b.beats, motion.intensity));
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.7)");
  ctx.fillStyle = g as unknown as string; ctx.fillRect(0, h * 0.6, w, h * 0.4);
  if (b.label) {
    const size = Math.round(Math.min(h * 0.07, w * 0.06)); ctx.font = `900 ${size}px ${th.font}`;
    const tw = ctx.measureText(b.label).width + size, bh = size * 1.7, x = w * 0.04, y = h - h * 0.07 - bh;
    const rise = (1 - easeOut(clamp(beats / 0.4))) * h * 0.1;
    ctx.save(); ctx.globalAlpha = clamp(beats / 0.2); ctx.translate(0, rise);
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.roundRect(x, y, tw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = th.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.label, x + size / 2, y + bh / 2 + 2); ctx.restore();
  }
  const flash = clamp(1 - beats / 0.18);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * flash})`; ctx.fillRect(0, 0, w, h); }
}

function countBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "count" }>, beats: number, flip: boolean, motion: Motion, th: Theme) {
  ctx.fillStyle = flip ? th.accent : th.ink; ctx.fillRect(0, 0, w, h);
  const v = b.value * easeOut(clamp(beats / Math.min(1.4, b.beats * 0.7)));
  const text = `${b.prefix}${v.toFixed(b.decimals)}${b.suffix}`;
  let size = Math.round(h * 0.5); ctx.font = `900 ${size}px ${th.font}`;
  const width = ctx.measureText(text).width, max = w * 0.9; if (width > max) { size = Math.floor((size * max) / width); ctx.font = `900 ${size}px ${th.font}`; }
  const s = slamScale(beats, motion.intensity, motion.landing);
  ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.scale(s, s); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = flip ? th.ink : th.accent; ctx.fillText(text, 0, 0); ctx.restore();
  if (b.label) { ctx.save(); ctx.globalAlpha = clamp((beats - 0.3) / 0.4); ctx.font = `900 ${Math.round(h * 0.09)}px ${th.font}`; ctx.fillStyle = flip ? th.ink : th.paper; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.label, w / 2, h * 0.82); ctx.restore(); }
}

/** Words that land one after another, stacked down the frame. */
function stackBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "stack" }>, beats: number, motion: Motion, th: Theme) {
  const { bg, fg } = palette(b.style, th);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const n = b.words.length, slot = b.beats / n, rowH = h / (n + 0.6);
  for (let i = 0; i < n; i++) {
    const local = beats - i * slot * 0.85; if (local < 0) continue;
    const text = b.words[i]!;
    let size = Math.round(Math.min(rowH * 0.9, h * 0.3)); ctx.font = `900 ${size}px ${th.font}`;
    const width = ctx.measureText(text).width; if (width > w * 0.9) { size = Math.floor((size * w * 0.9) / width); ctx.font = `900 ${size}px ${th.font}`; }
    const s = slamScale(local, motion.intensity, motion.landing);
    ctx.save(); ctx.translate(w / 2, rowH * (i + 0.8)); ctx.scale(s, s); ctx.globalAlpha = clamp(local / 0.08); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = i === n - 1 && n > 1 ? (fg === th.accent ? th.paper : th.accent) : fg; ctx.fillText(text, 0, 0); ctx.restore();
  }
}

/** A claim that renders itself: a bar filling up to a percentage. */
function barBlock(ctx: CanvasRenderingContext2D, w: number, h: number, b: Extract<Block, { kind: "bar" }>, beats: number, motion: Motion, th: Theme) {
  ctx.fillStyle = th.ink; ctx.fillRect(0, 0, w, h);
  const p = easeOut(clamp(beats / Math.min(1.6, b.beats * 0.75)));
  const bw = w * 0.8, bh = h * 0.1, x = (w - bw) / 2, y = h * 0.62;
  ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = th.accent; ctx.beginPath(); ctx.roundRect(x, y, Math.max(bh, bw * (b.value / 100) * p), bh, bh / 2); ctx.fill();
  const text = `${Math.round(b.value * p)}%`;
  let size = Math.round(h * 0.34); ctx.font = `900 ${size}px ${th.font}`;
  const width = ctx.measureText(text).width; if (width > w * 0.8) { size = Math.floor((size * w * 0.8) / width); ctx.font = `900 ${size}px ${th.font}`; }
  const s = slamScale(beats, motion.intensity, motion.landing);
  ctx.save(); ctx.translate(w / 2, h * 0.38); ctx.scale(s, s); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = th.paper; ctx.fillText(text, 0, 0); ctx.restore();
  if (b.label) { ctx.save(); ctx.globalAlpha = clamp((beats - 0.3) / 0.4); ctx.font = `900 ${Math.round(Math.min(h * 0.07, w * 0.06))}px ${th.font}`; ctx.fillStyle = th.accent; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.label, w / 2, h * 0.82); ctx.restore(); }
}

function mediaAt(media: Media, index: number, b: Block): Media {
  if (b.kind !== "image" && b.kind !== "clip") return media;
  const occurrence = media[occurrenceKey(index, b.name)];
  return occurrence ? { ...media, [b.name]: occurrence } : media;
}

/** Draws the film at a time. False when the time is outside it (nothing is drawn). */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: Timeline, seconds: number, media: Media = {}, motion: Motion = DEFAULT_MOTION, look: Look = {}): boolean {
  const at = blockAt(t, seconds);
  if (!at) return false;
  const th = themed(look.theme);
  const { item, index, beats } = at;
  const total = item.block.beats;
  const next = t.items[index + 1];
  const whipBeats = Math.min(total, clamp(motion.whipBeats, 0, 1));
  const countsBefore = (i: number) => t.items.slice(0, i).filter((x) => x.block.kind === "count").length;
  if (next && whipBeats > 0 && beats > total - whipBeats) {
    const raw = (beats - (total - whipBeats)) / whipBeats, p = easeInOut(raw);
    if (look.transition === "zoom") {
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1 + 0.5 * p, 1 + 0.5 * p); ctx.translate(-w / 2, -h / 2); block(ctx, w, h, item.block, beats, mediaAt(media, index, item.block), countsBefore(index), motion, th); ctx.restore();
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1.25 - 0.25 * p, 1.25 - 0.25 * p); ctx.translate(-w / 2, -h / 2); ctx.globalAlpha = clamp(p * 1.4); block(ctx, w, h, next.block, 0, mediaAt(media, index + 1, next.block), countsBefore(index + 1), motion, th); ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      const dir = index % 2 === 0 ? 1 : -1;
      const vertical = index % 3 === 2;
      const ox = vertical ? 0 : -dir * w * p, oy = vertical ? -h * p : 0;
      ctx.save(); ctx.translate(ox, oy); block(ctx, w, h, item.block, beats, mediaAt(media, index, item.block), countsBefore(index), motion, th); ctx.restore();
      ctx.save(); ctx.translate(ox + (vertical ? 0 : dir * w), oy + (vertical ? h : 0)); block(ctx, w, h, next.block, 0, mediaAt(media, index + 1, next.block), countsBefore(index + 1), motion, th); ctx.restore();
    }
  } else {
    block(ctx, w, h, item.block, beats, mediaAt(media, index, item.block), countsBefore(index), motion, th);
  }
  return true;
}
