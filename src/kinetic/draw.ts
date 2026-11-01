import { blockAt, type Block, type Style, type Timeline, type WordsBlock, type Zoom } from "./beats";

export type MediaItem = { el: CanvasImageSource; width: number; height: number };
export type Media = Record<string, MediaItem>;

/** The look: dark ground, light text, one accent, a warning colour, and the display face. */
export type Theme = { ink: string; paper: string; accent: string; red: string; font: string };
export type Transition = "whip" | "cut" | "zoom";
export type Options = { theme?: Partial<Theme>; transition?: Transition; slam?: number };

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

/** How big a word is as it lands: a quarter too big, settling over a third of a beat. `slam` scales the overshoot. */
export const slamScale = (beats: number, slam = 1) => 1 + 0.32 * slam * (1 - easeOut(clamp(beats / 0.34)));

type Env = { w: number; h: number; theme: Theme; slam: number; media: Media };

function fitFont(ctx: CanvasRenderingContext2D, env: Env, text: string, base: number, maxW: number): number {
  let size = Math.round(base);
  ctx.font = `900 ${size}px ${env.theme.font}`;
  const width = ctx.measureText(text).width;
  if (width > maxW) { size = Math.floor((size * maxW) / width); ctx.font = `900 ${size}px ${env.theme.font}`; }
  return size;
}

function slamText(ctx: CanvasRenderingContext2D, env: Env, text: string, color: string, beats: number, opts: { y?: number; base?: number } = {}) {
  const { w, h } = env;
  fitFont(ctx, env, text, opts.base ?? h * 0.4, w * 0.9);
  const s = slamScale(beats, env.slam);
  ctx.save();
  ctx.translate(w / 2, opts.y ?? h / 2);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(beats / 0.08);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Where the camera is in a block: the focus point and scale, easing in on a zoom (or a slow push when there is none). */
export function zoomAt(zoom: Zoom | undefined, progress: number): { x: number; y: number; scale: number } {
  const p = easeInOut(clamp(progress));
  if (!zoom) return { x: 0.5, y: 0.5, scale: 1 + 0.08 * clamp(progress) };
  return { x: 0.5 + (zoom.x - 0.5) * p, y: 0.5 + (zoom.y - 0.5) * p, scale: 1 + (zoom.scale - 1) * p };
}

function cover(ctx: CanvasRenderingContext2D, m: MediaItem, w: number, h: number, cam: { x: number; y: number; scale: number }) {
  const r = Math.max(w / m.width, h / m.height) * cam.scale;
  const iw = m.width * r, ih = m.height * r;
  const x = w / 2 - cam.x * iw, y = h / 2 - cam.y * ih;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  ctx.drawImage(m.el, Math.min(0, Math.max(w - iw, x)), Math.min(0, Math.max(h - ih, y)), iw, ih);
  ctx.restore();
}

function mediaBlock(ctx: CanvasRenderingContext2D, env: Env, b: Extract<Block, { kind: "image" | "clip" }>, beats: number) {
  const { w, h, theme } = env;
  ctx.fillStyle = theme.ink; ctx.fillRect(0, 0, w, h);
  const m = env.media[b.name];
  if (!m) {
    ctx.fillStyle = theme.red; ctx.font = `900 ${Math.round(Math.min(w, h) * 0.07)}px ${theme.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`MISSING: ${b.name.toUpperCase()}`, w / 2, h / 2); return;
  }
  cover(ctx, m, w, h, zoomAt(b.zoom, beats / b.beats));
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.7)");
  ctx.fillStyle = g as unknown as string; ctx.fillRect(0, h * 0.6, w, h * 0.4);
  if (b.label) {
    const size = Math.round(Math.min(h * 0.07, w * 0.06)); ctx.font = `900 ${size}px ${theme.font}`;
    const tw = ctx.measureText(b.label).width + size, bh = size * 1.7, x = w * 0.04, y = h - h * 0.07 - bh;
    const rise = (1 - easeOut(clamp(beats / 0.4))) * h * 0.1;
    ctx.save(); ctx.globalAlpha = clamp(beats / 0.2); ctx.translate(0, rise);
    ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.roundRect(x, y, tw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = theme.ink; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(b.label, x + size / 2, y + bh / 2 + 2); ctx.restore();
  }
  const flash = clamp(1 - beats / 0.18);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * flash})`; ctx.fillRect(0, 0, w, h); }
}

function countBlock(ctx: CanvasRenderingContext2D, env: Env, b: Extract<Block, { kind: "count" }>, beats: number, flip: boolean) {
  const { w, h, theme } = env;
  ctx.fillStyle = flip ? theme.accent : theme.ink; ctx.fillRect(0, 0, w, h);
  const v = b.value * easeOut(clamp(beats / Math.min(1.4, b.beats * 0.7)));
  const text = `${b.prefix}${v.toFixed(b.decimals)}${b.suffix}`;
  fitFont(ctx, env, text, h * 0.5, w * 0.9);
  const s = slamScale(beats, env.slam);
  ctx.save(); ctx.translate(w / 2, h * 0.45); ctx.scale(s, s); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = flip ? theme.ink : theme.accent; ctx.fillText(text, 0, 0); ctx.restore();
  if (b.label) { ctx.save(); ctx.globalAlpha = clamp((beats - 0.3) / 0.4); fitFont(ctx, env, b.label, h * 0.09, w * 0.9); ctx.fillStyle = flip ? theme.ink : theme.paper; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.label, w / 2, h * 0.82); ctx.restore(); }
}

/** Words that land one after another, stacked down the frame. */
function stackBlock(ctx: CanvasRenderingContext2D, env: Env, b: Extract<Block, { kind: "stack" }>, beats: number) {
  const { w, h } = env, { bg, fg } = palette(b.style, env.theme);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const n = b.words.length, slot = b.beats / n, rowH = h / (n + 0.6);
  for (let i = 0; i < n; i++) {
    const local = beats - i * slot * 0.85; if (local < 0) continue;
    slamText(ctx, env, b.words[i]!, i === n - 1 ? env.theme.accent === fg ? env.theme.paper : env.theme.accent : fg, local, { y: rowH * (i + 0.8), base: Math.min(rowH * 0.9, h * 0.3) });
  }
}

/** A claim that renders itself: a bar filling up to a percentage. */
function barBlock(ctx: CanvasRenderingContext2D, env: Env, b: Extract<Block, { kind: "bar" }>, beats: number) {
  const { w, h, theme } = env;
  ctx.fillStyle = theme.ink; ctx.fillRect(0, 0, w, h);
  const p = easeOut(clamp(beats / Math.min(1.6, b.beats * 0.75)));
  const bw = w * 0.8, bh = h * 0.1, x = (w - bw) / 2, y = h * 0.62;
  ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.roundRect(x, y, Math.max(bh, bw * (b.value / 100) * p), bh, bh / 2); ctx.fill();
  const text = `${Math.round(b.value * p)}%`;
  const s = slamScale(beats, env.slam);
  fitFont(ctx, env, text, h * 0.34, w * 0.8);
  ctx.save(); ctx.translate(w / 2, h * 0.38); ctx.scale(s, s); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = theme.paper; ctx.fillText(text, 0, 0); ctx.restore();
  if (b.label) { ctx.save(); ctx.globalAlpha = clamp((beats - 0.3) / 0.4); fitFont(ctx, env, b.label, h * 0.07, w * 0.9); ctx.fillStyle = theme.accent; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.label, w / 2, h * 0.82); ctx.restore(); }
}

function block(ctx: CanvasRenderingContext2D, env: Env, b: Block, beats: number, countIndex: number) {
  if (b.kind === "image" || b.kind === "clip") return mediaBlock(ctx, env, b, beats);
  if (b.kind === "count") return countBlock(ctx, env, b, beats, countIndex % 2 === 1);
  if (b.kind === "stack") return stackBlock(ctx, env, b, beats);
  if (b.kind === "bar") return barBlock(ctx, env, b, beats);
  const wb = b as WordsBlock, { bg, fg } = palette(wb.style, env.theme);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, env.w, env.h);
  slamText(ctx, env, wb.text, fg, beats);
}

const WHIP_BEATS = 0.4;

/** Draws the film at a time. False when the time is outside it (nothing is drawn). */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: Timeline, seconds: number, media: Media = {}, options: Options = {}): boolean {
  const at = blockAt(t, seconds);
  if (!at) return false;
  const env: Env = { w, h, theme: themed(options.theme), slam: options.slam ?? 1, media };
  const mode = options.transition ?? "whip";
  const { item, index, beats } = at;
  const total = item.block.beats;
  const next = t.items[index + 1];
  const countsBefore = (i: number) => t.items.slice(0, i).filter((x) => x.block.kind === "count").length;
  if (next && mode !== "cut" && beats > total - WHIP_BEATS) {
    const p = (beats - (total - WHIP_BEATS)) / WHIP_BEATS;
    if (mode === "zoom") {
      const e = easeInOut(p);
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1 + 0.5 * e, 1 + 0.5 * e); ctx.translate(-w / 2, -h / 2); ctx.globalAlpha = 1; block(ctx, env, item.block, beats, countsBefore(index)); ctx.restore();
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(1.25 - 0.25 * e, 1.25 - 0.25 * e); ctx.translate(-w / 2, -h / 2); ctx.globalAlpha = clamp(e * 1.4); block(ctx, env, next.block, 0, countsBefore(index + 1)); ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      const e = easeInOut(p), dir = index % 2 === 0 ? 1 : -1, vertical = index % 3 === 2;
      const ox = vertical ? 0 : -dir * w * e, oy = vertical ? -h * e : 0;
      ctx.save(); ctx.translate(ox, oy); block(ctx, env, item.block, beats, countsBefore(index)); ctx.restore();
      ctx.save(); ctx.translate(ox + (vertical ? 0 : dir * w), oy + (vertical ? h : 0)); block(ctx, env, next.block, 0, countsBefore(index + 1)); ctx.restore();
    }
  } else {
    block(ctx, env, item.block, beats, countsBefore(index));
  }
  return true;
}
