import { featherOf, findAlignment, type Box, type Gray } from "../../../../story/region";

/** Browser-side pixel work for fixing part of a frame. The geometry lives in story/region.ts. */

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The picture couldn't be read."));
    img.src = src;
  });
}

export async function sizeOf(src: string): Promise<{ w: number; h: number }> {
  const img = await load(src);
  return { w: img.naturalWidth, h: img.naturalHeight };
}

/** A small grey copy of part of a picture, for lining two pictures up. */
function grayOf(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, n = 64): Gray {
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, n, n);
  const px = x.getImageData(0, 0, n, n).data;
  const data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i += 1) data[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
  return { w: n, h: n, data };
}

/**
 * Lay the model's version of the cut-out back over the frame, keeping only the
 * boxed part of it (`keep`, in frame pixels) with soft edges. Everything else
 * in the frame stays the original, pixel for pixel.
 */
export async function pasteBack(frame: string, patch: string, box: Box, keep: Box): Promise<string> {
  const [base, fixed] = await Promise.all([load(frame), load(patch)]);
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0);

  const layer = document.createElement("canvas");
  layer.width = canvas.width;
  layer.height = canvas.height;
  const lc = layer.getContext("2d")!;
  // The model may return the cut-out a little reframed; line it up with the original before it goes back.
  const orig = grayOf(base, box.x, box.y, box.w, box.h);
  const piece = grayOf(fixed, 0, 0, fixed.naturalWidth, fixed.naturalHeight);
  const edited = { x: (keep.x - box.x) / box.w, y: (keep.y - box.y) / box.h, w: keep.w / box.w, h: keep.h / box.h };
  const a = findAlignment(orig, piece, edited);
  const u0 = (-0.5 - a.dx) / a.scale + 0.5;
  const u1 = (0.5 - a.dx) / a.scale + 0.5;
  const v0 = (-0.5 - a.dy) / a.scale + 0.5;
  const v1 = (0.5 - a.dy) / a.scale + 0.5;
  lc.drawImage(fixed, box.x + u0 * box.w, box.y + v0 * box.h, (u1 - u0) * box.w, (v1 - v0) * box.h);

  const feather = featherOf(keep);
  const mask = document.createElement("canvas");
  mask.width = canvas.width;
  mask.height = canvas.height;
  const mc = mask.getContext("2d")!;
  mc.filter = `blur(${feather / 2}px)`;
  mc.fillStyle = "#fff";
  // Inset by the feather so the fade lands inside the box, not outside it.
  mc.fillRect(keep.x + feather / 2, keep.y + feather / 2, Math.max(2, keep.w - feather), Math.max(2, keep.h - feather));
  lc.globalCompositeOperation = "destination-in";
  lc.drawImage(mask, 0, 0);
  ctx.drawImage(layer, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.95);
}
