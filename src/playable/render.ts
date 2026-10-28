import type { Art, GameSpec, Shape } from "./spec";
import type { GameState } from "./templates";
import type { CollectorState } from "./templates/collector";
import type { Cell, MatchState } from "./templates/match";
import { GROUND, type RunnerState } from "./templates/runner";
import { WORLD } from "./templates/types";

/**
 * Draws a game state onto a canvas in world units (800 × 450), scaled to fit.
 * Each piece of art is its picture when one is loaded, and its coloured shape
 * until then, so a game is always playable before any art is made.
 */

export type Pictures = Map<string, CanvasImageSource>;

/** The scale and offset that fit the world into a canvas, letterboxed. */
export function fit(width: number, height: number): { scale: number; x: number; y: number } {
  const scale = Math.min(width / WORLD.w, height / WORLD.h);
  return { scale, x: (width - WORLD.w * scale) / 2, y: (height - WORLD.h * scale) / 2 };
}

/** A point on the canvas in world units. */
export function toWorld(width: number, height: number, px: number, py: number): { x: number; y: number } {
  const f = fit(width, height);
  return { x: (px - f.x) / f.scale, y: (py - f.y) / f.scale };
}

/** Where the match grid sits in the world, and the cell under a world point. */
export function matchLayout(spec: Extract<GameSpec, { template: "match" }>) {
  const { cols, rows } = spec.rules;
  const size = Math.floor(Math.min((WORLD.w - 40) / cols, (WORLD.h - 40) / rows));
  const x = (WORLD.w - size * cols) / 2;
  const y = (WORLD.h - size * rows) / 2;
  const cellAt = (wx: number, wy: number): Cell | null => {
    const c = Math.floor((wx - x) / size);
    const r = Math.floor((wy - y) / size);
    return r >= 0 && r < rows && c >= 0 && c < cols ? [r, c] : null;
  };
  return { size, x, y, cellAt };
}

function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  if (shape === "circle") ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (shape === "square") ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  else if (shape === "triangle") { ctx.moveTo(cx, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); }
  else if (shape === "diamond") { ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath(); }
  else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 0.45 : 1;
      const px = cx + Math.cos(a) * (w / 2) * r;
      const py = cy + Math.sin(a) * (h / 2) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
}

/** One piece of art in a box: its picture if loaded, else its shape. */
function piece(ctx: CanvasRenderingContext2D, pictures: Pictures, key: string, art: Art, x: number, y: number, w: number, h: number) {
  const picture = pictures.get(key);
  if (picture) {
    ctx.drawImage(picture, x, y, w, h);
    return;
  }
  shapePath(ctx, art.shape, x, y, w, h);
  ctx.fillStyle = art.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.stroke();
}

/** A picture covering the box, cropped to keep its shape. */
function cover(ctx: CanvasRenderingContext2D, picture: CanvasImageSource, x: number, y: number, w: number, h: number, shift = 0) {
  const pw = Number((picture as HTMLImageElement).naturalWidth || (picture as HTMLCanvasElement).width) || w;
  const ph = Number((picture as HTMLImageElement).naturalHeight || (picture as HTMLCanvasElement).height) || h;
  const scale = Math.max(w / pw, h / ph);
  const dw = pw * scale;
  const dh = ph * scale;
  if (!shift) {
    ctx.drawImage(picture, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return;
  }
  // Scrolling: the picture repeats, mirrored every other tile so the seam doesn't jump.
  const offset = ((shift % (dw * 2)) + dw * 2) % (dw * 2);
  for (let tx = -offset; tx < w; tx += dw) {
    const odd = Math.round((tx + offset) / dw) % 2 === 1;
    ctx.save();
    if (odd) {
      ctx.translate(x + tx + dw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(picture, 0, (h - dh) / 2, dw, dh);
    } else {
      ctx.drawImage(picture, x + tx, y + (h - dh) / 2, dw, dh);
    }
    ctx.restore();
  }
}

function sky(ctx: CanvasRenderingContext2D, spec: GameSpec) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, spec.palette.sky);
  g.addColorStop(1, spec.palette.ground);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
}

const blink = (safe: number, t: number) => safe > 0 && Math.floor(t * 12) % 2 === 0;

function drawRunner(ctx: CanvasRenderingContext2D, spec: Extract<GameSpec, { template: "runner" }>, s: RunnerState, pictures: Pictures) {
  const bg = pictures.get("background");
  if (bg) cover(ctx, bg, 0, 0, WORLD.w, WORLD.h, s.run * 0.35);
  else {
    sky(ctx, spec);
    // Far shapes drifting, so the placeholder world still reads as moving.
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 7; i++) {
      const x = ((i * 157 - s.run * 0.25) % (WORLD.w + 160) + WORLD.w + 160) % (WORLD.w + 160) - 80;
      const h = 60 + ((i * 53) % 120);
      ctx.fillRect(x, GROUND - h, 70, h);
    }
  }
  ctx.fillStyle = spec.palette.ground;
  ctx.globalAlpha = bg ? 0.94 : 1;
  ctx.fillRect(0, GROUND, WORLD.w, WORLD.h - GROUND);
  ctx.globalAlpha = 1;
  ctx.fillStyle = spec.palette.accent;
  ctx.fillRect(0, GROUND, WORLD.w, 3);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let x = -((s.run * 1) % 48); x < WORLD.w; x += 48) ctx.fillRect(x, GROUND + 14, 22, 4);

  for (const k of s.pickups) piece(ctx, pictures, "pickup", spec.art.pickup, k.x, k.y + Math.sin((s.t + k.x / 90) * 4) * 4, k.w, k.h);
  for (const h of s.hazards) piece(ctx, pictures, "hazard", spec.art.hazard, h.x, h.y, h.w, h.h);
  if (!blink(s.safe, s.t)) {
    const p = s.player;
    // Sprites are square pictures; draw them a little larger than the hit box so they read.
    const pad = pictures.has("player") ? 8 : 0;
    piece(ctx, pictures, "player", spec.art.player, p.x - pad, p.y - pad * 1.5, p.w + pad * 2, p.h + pad * 1.5);
  }
}

function drawCollector(ctx: CanvasRenderingContext2D, spec: Extract<GameSpec, { template: "collector" }>, s: CollectorState, pictures: Pictures) {
  const bg = pictures.get("background");
  if (bg) cover(ctx, bg, 0, 0, WORLD.w, WORLD.h);
  else {
    ctx.fillStyle = spec.palette.ground;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
    for (let y = 0; y <= WORLD.h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }
  }
  ctx.strokeStyle = spec.palette.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, WORLD.w - 3, WORLD.h - 3);
  const at = (b: { x: number; y: number; r: number }, scale = 1) => [b.x - b.r * scale, b.y - b.r * scale, b.r * 2 * scale, b.r * 2 * scale] as const;
  for (const k of s.pickups) {
    ctx.save();
    ctx.shadowColor = spec.art.pickup.color;
    ctx.shadowBlur = 12 + Math.sin(s.t * 5) * 4;
    piece(ctx, pictures, "pickup", spec.art.pickup, ...at(k, 1.25));
    ctx.restore();
  }
  for (const h of s.hazards) piece(ctx, pictures, "hazard", spec.art.hazard, ...at(h, 1.3));
  if (!blink(s.safe, s.t)) piece(ctx, pictures, "player", spec.art.player, ...at(s.player, 1.4));
}

function drawMatch(ctx: CanvasRenderingContext2D, spec: Extract<GameSpec, { template: "match" }>, s: MatchState, pictures: Pictures) {
  const bg = pictures.get("background");
  if (bg) cover(ctx, bg, 0, 0, WORLD.w, WORLD.h);
  else sky(ctx, spec);
  const { size, x, y } = matchLayout(spec);
  const { rows, cols } = spec.rules;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 8, size * cols + 16, size * rows + 16, 14);
  ctx.fill();
  const since = s.poppedAt < 0 ? 99 : s.t - s.poppedAt;
  const drop = Math.max(0, 1 - since / 0.28);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 8, y - 8, size * cols + 16, size * rows + 16);
  ctx.clip();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const kind = s.grid[r]?.[c] ?? -1;
      const art = spec.art.tiles[kind];
      if (!art) continue;
      const fallen = (s.fell[r]?.[c] ?? 0) * size * drop * drop;
      const pad = size * 0.12;
      piece(ctx, pictures, `tiles.${kind}`, art, x + c * size + pad, y + r * size + pad - fallen, size - pad * 2, size - pad * 2);
    }
  }
  ctx.restore();
  if (since < 0.35) {
    ctx.strokeStyle = spec.palette.accent;
    ctx.globalAlpha = 1 - since / 0.35;
    ctx.lineWidth = 3;
    for (const [r, c] of s.popped) {
      ctx.beginPath();
      ctx.arc(x + c * size + size / 2, y + r * size + size / 2, (size / 2) * (0.6 + since * 2), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (s.selected) {
    const [r, c] = s.selected;
    ctx.strokeStyle = spec.palette.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + c * size + 2, y + r * size + 2, size - 4, size - 4, 10);
    ctx.stroke();
  }
}

export function draw(ctx: CanvasRenderingContext2D, spec: GameSpec, state: GameState, pictures: Pictures, width: number, height: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, width, height);
  const f = fit(width, height);
  ctx.setTransform(f.scale, 0, 0, f.scale, f.x, f.y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WORLD.w, WORLD.h);
  ctx.clip();
  if (spec.template === "runner" && state.template === "runner") drawRunner(ctx, spec, state, pictures);
  else if (spec.template === "collector" && state.template === "collector") drawCollector(ctx, spec, state, pictures);
  else if (spec.template === "match" && state.template === "match") drawMatch(ctx, spec, state, pictures);
  ctx.restore();
}

/**
 * Loads a piece of art for drawing. Sprites are keyed (the magenta behind
 * them made transparent); a picture whose pixels can't be read is drawn as it
 * is rather than not at all.
 */
export async function loadPicture(url: string, sprite: boolean, keyOut: (data: Uint8ClampedArray) => void): Promise<CanvasImageSource> {
  const load = async (cors: boolean) => {
    const image = new Image();
    if (cors) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  };
  // Keying needs the pixels, which needs CORS; a host that doesn't allow it still gets its picture shown, unkeyed.
  const image = await load(true).catch(() => load(false));
  if (!sprite) return image;
  try {
    const canvas = document.createElement("canvas");
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, 256 / longest);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    keyOut(data.data);
    ctx.putImageData(data, 0, 0);
    return canvas;
  } catch {
    return image;
  }
}
