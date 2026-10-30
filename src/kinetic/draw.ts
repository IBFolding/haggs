import { blockAt, type Style, type Timeline } from "./beats";

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
export const slamScale = (beats: number) => 1 + 0.32 * (1 - easeOut(clamp(beats / 0.34)));

function word(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, style: Style, beats: number) {
  const { fg } = PALETTE[style];
  let size = Math.round(h * 0.4);
  ctx.font = `900 ${size}px ${FONT}`;
  const width = ctx.measureText(text).width;
  const max = w * 0.9;
  if (width > max) { size = Math.floor((size * max) / width); ctx.font = `900 ${size}px ${FONT}`; }
  const s = slamScale(beats);
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

function block(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, style: Style, beats: number) {
  ctx.fillStyle = PALETTE[style].bg;
  ctx.fillRect(0, 0, w, h);
  word(ctx, w, h, text, style, beats);
}

const WHIP_BEATS = 0.4;

/** Draws the film at a time. False when the time is outside it (nothing is drawn). */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: Timeline, seconds: number): boolean {
  const at = blockAt(t, seconds);
  if (!at) return false;
  const { item, index, beats } = at;
  const total = item.block.beats;
  const next = t.items[index + 1];
  if (next && beats > total - WHIP_BEATS) {
    const p = easeInOut((beats - (total - WHIP_BEATS)) / WHIP_BEATS);
    const dir = index % 2 === 0 ? 1 : -1;
    const vertical = index % 3 === 2;
    const ox = vertical ? 0 : -dir * w * p, oy = vertical ? -h * p : 0;
    ctx.save(); ctx.translate(ox, oy); block(ctx, w, h, item.block.text, item.block.style, beats); ctx.restore();
    ctx.save(); ctx.translate(ox + (vertical ? 0 : dir * w), oy + (vertical ? h : 0)); block(ctx, w, h, next.block.text, next.block.style, 0); ctx.restore();
  } else {
    block(ctx, w, h, item.block.text, item.block.style, beats);
  }
  return true;
}
