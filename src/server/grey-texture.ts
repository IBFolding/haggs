import sharp from "sharp";
import type { PlanInput } from "../story/grey-render";
/** The same full-frame texture preparation is used for hosted and local drafts. */
export async function prepareGreyTexture(input: PlanInput, source: string, size: { w: number; h: number }, out: string): Promise<void> {
  const frame = () => sharp({ create: { width: size.w, height: size.h, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } });
  if (input.fit) {
    const r = input.fit;
    const replacement = await sharp(source).resize(r.w, r.h, { fit: "cover" }).flatten({ background: "#808080" }).png().toBuffer();
    await frame().composite([{ input: replacement, left: r.x, top: r.y }]).png().toFile(out);
    return;
  }
  const meta = await sharp(source).metadata();
  const tw = Math.max(16, input.tile ?? 256);
  const th = Math.max(16, Math.round(tw * (meta.height ?? 1) / (meta.width ?? 1)));
  const tile = await sharp(source).resize(tw, th).png().toBuffer();
  const layers = [];
  for (let y = 0; y < size.h; y += th) for (let x = 0; x < size.w; x += tw) layers.push({ input: tile, left: x, top: y });
  await frame().composite(layers).png().toFile(out);
}
