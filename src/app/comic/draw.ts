import { PAGE_W, SHAPE_RATIO, bubbleSlots, layoutPanels, wrapWords, type LayoutId, type Panel, type Rect } from "../../comic/comic";

/** Draws the comic page: the pictures cropped to their frames, captions, speech bubbles. Browser only. */

const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = () => reject(new Error("A panel picture couldn't be read.")); i.src = src; });

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect) {
  const k = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
}

function bubble(ctx: CanvasRenderingContext2D, slot: Rect, text: string, frame: Rect) {
  let size = Math.max(18, Math.round(frame.w * 0.05));
  const upper = text.toUpperCase();
  let lines: string[] = [];
  let widest = 0;
  // Shrink the lettering until the longest line fits inside the bubble with room for its curve.
  for (;;) {
    ctx.font = `800 ${size}px "Comic Sans MS", "Chalkboard SE", "Trebuchet MS", sans-serif`;
    lines = wrapWords(upper, Math.max(8, Math.floor(slot.w / (size * 0.62))));
    widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest + size * 2.2 <= slot.w || size <= 13) break;
    size -= 2;
  }
  const w = Math.min(slot.w, widest + size * 2.2);
  const h = lines.length * size * 1.15 + size * 1.7;
  const x = slot.x, y = slot.y;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // The tail points down toward the middle of the frame.
  ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + h - 4); ctx.lineTo(x + w * 0.28, y + h + size * 0.9); ctx.lineTo(x + w * 0.52, y + h - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillRect(x + w * 0.33, y + h - 7, w * 0.2, 6);
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 - ((lines.length - 1) * size * 1.15) / 2 + i * size * 1.15));
}

function caption(ctx: CanvasRenderingContext2D, text: string, frame: Rect) {
  let size = Math.max(15, Math.round(frame.w * 0.04));
  const max = frame.w * 0.82;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `800 ${size}px "Trebuchet MS", sans-serif`;
    lines = wrapWords(text.toUpperCase(), Math.max(10, Math.floor(max / (size * 0.62))));
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.2 <= max || size <= 12) break;
    size -= 1;
  }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.2;
  const h = lines.length * size * 1.25 + size * 0.5;
  ctx.fillStyle = "#fff36b"; ctx.strokeStyle = "#111"; ctx.lineWidth = 3;
  ctx.fillRect(frame.x + 8, frame.y + 8, w, h); ctx.strokeRect(frame.x + 8, frame.y + 8, w, h);
  ctx.fillStyle = "#111"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, frame.x + 8 + size * 0.6, frame.y + 8 + size * 0.25 + size * 0.62 + i * size * 1.25));
}

export async function drawComic(canvas: HTMLCanvasElement, panels: Panel[], pictures: Record<string, string>, layout: LayoutId, scale = 1) {
  const { rects, width, height } = layoutPanels(panels.map((p) => p.shape), layout);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f6f1e4"; ctx.fillRect(0, 0, width, height);
  for (const [i, p] of panels.entries()) {
    const r = rects[i]!;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    const src = pictures[p.id];
    if (src) cover(ctx, await load(src), r);
    else { ctx.fillStyle = "#d9d3c2"; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = "#8a8472"; ctx.font = "700 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText(`Panel ${i + 1} · art not drawn`, r.x + r.w / 2, r.y + r.h * .65); ctx.font = "16px sans-serif"; wrapWords(p.action, Math.floor(r.w / 10)).slice(0, 3).forEach((line, j) => ctx.fillText(line, r.x + r.w / 2, r.y + r.h * .72 + j * 22, r.w - 24)); }
    ctx.restore();
    ctx.strokeStyle = "#111"; ctx.lineWidth = 6; ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (p.caption.trim()) caption(ctx, p.caption, r);
    const spoken = p.lines.filter((l) => l.text.trim());
    bubbleSlots(r, spoken.length).forEach((slot, k) => bubble(ctx, slot, spoken[k]!.text, r));
  }
}

export { PAGE_W, SHAPE_RATIO };
