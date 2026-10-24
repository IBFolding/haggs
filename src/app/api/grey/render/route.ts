import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import { bridgeAllowed } from "../../../../server/bridge-guard";
import { hosted } from "../../../../server/blob";
import { ffmpegBin } from "../../../../server/ffmpeg";
import { localFile } from "../../../../server/local-media";
import { frameOf } from "../../../../story/cut";
import { airLayout, airTile } from "../../../../story/grey-air";
import { greyPlan, shadowSize } from "../../../../story/grey-render";
import { atmosphere, normalizeScene, propShadow, type Light, type Prop } from "../../../../story/grey-scene";

const run = promisify(execFile);
export const maxDuration = 300;

/** A light as a frame-sized picture: a soft glow with its own transparency. */
async function glow(path: string, l: Light, w: number, h: number) {
  const r = l.size * Math.hypot(Math.max(l.x, 1 - l.x) * w, Math.max(l.y, 1 - l.y) * h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g" gradientUnits="userSpaceOnUse" cx="${l.x * w}" cy="${l.y * h}" r="${r}"><stop offset="0" stop-color="${/^#[0-9a-f]{6}$/i.test(l.color) ? l.color : "#ffffff"}" stop-opacity="${(l.intensity * 0.7).toFixed(3)}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}

/** A contact shadow: a flat soft ellipse the size the plan expects. */
async function contact(path: string, p: Prop, size: { w: number; h: number }, aspect: number, amount: number) {
  const { w, h } = shadowSize(p, size, aspect);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="g"><stop offset="0" stop-color="#000" stop-opacity="${(amount * 0.75).toFixed(3)}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}

/**
 * Draft render of a Grey Room scene: the same composite the preview shows,
 * made with ffmpeg on this machine. Free; development only, like Render MP4.
 */
export async function POST(request: Request) {
  if (hosted() || !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the render has somewhere to be kept." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { scene?: unknown; footage?: unknown; seconds?: unknown; aspect?: unknown; name?: unknown } | null;
  const footage = typeof body?.footage === "string" ? body.footage : "";
  const seconds = Math.min(60, Math.max(0.5, Number(body?.seconds) || 4));
  const size = frameOf(body?.aspect === "9:16" ? "9:16" : "16:9");
  const scene = normalizeScene(body?.scene as never);
  let work: string | null = null;
  try {
    // Every file must really be in the media folder.
    const file = (url: string) => {
      if (!url.startsWith("/api/local/")) throw new Error("The draft render only reads files in your media folder.");
      const found = localFile(root, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
      if (!found) throw new Error(`A file in this scene isn't in the media folder: ${url.split("/").at(-1)}`);
      return found.path;
    };
    // Each prop picture's shape, so its shadow can be sized and placed.
    const aspects: Record<string, number> = {};
    for (const p of scene.props ?? []) {
      const meta = await sharp(file(p.url)).metadata().catch(() => null);
      if (meta?.width && meta.height) aspects[p.id] = meta.height / meta.width;
    }
    const plan = greyPlan(scene, size, seconds, footage, aspects);
    work = await mkdtemp(join(tmpdir(), "haggs-grey-"));
    const paths: string[] = [];
    for (const [i, input] of plan.inputs.entries()) {
      if (input.role === "texture") {
        // The texture repeated edge to edge until it fills the frame.
        const meta = await sharp(file(input.ref)).metadata();
        const tw = Math.max(16, input.tile ?? 256);
        const th = Math.max(16, Math.round((tw * (meta.height ?? 1)) / (meta.width ?? 1)));
        const tile = await sharp(file(input.ref)).resize(tw, th).png().toBuffer();
        const layers = [];
        for (let y = 0; y < size.h; y += th) for (let x = 0; x < size.w; x += tw) layers.push({ input: tile, left: x, top: y });
        const out = join(work, `texture-${i}.png`);
        await sharp({ create: { width: size.w, height: size.h, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } }).composite(layers).png().toFile(out);
        paths.push(out);
      } else if (input.role === "air") {
        // Two tiles end to end, so sliding one tile's length never runs out.
        const amount = atmosphere(scene).find((a) => a.kind === input.ref)?.amount ?? 0;
        const kind = input.ref as Parameters<typeof airLayout>[0];
        const tile = await sharp(Buffer.from(airTile(kind, size, amount, 11))).png().toBuffer();
        const vertical = airLayout(kind, size).axis !== "across";
        const out = join(work, `air-${i}.png`);
        await sharp({ create: { width: vertical ? size.w : size.w * 2, height: vertical ? size.h * 2 : size.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
          .composite([{ input: tile, top: 0, left: 0 }, { input: tile, top: vertical ? size.h : 0, left: vertical ? 0 : size.w }])
          .png().toFile(out);
        paths.push(out);
      } else if (input.role === "shadow") {
        const p = scene.props?.find((x) => x.id === input.ref);
        if (!p || !aspects[p.id]) throw new Error("A prop in this scene is missing.");
        const out = join(work, `shadow-${i}.png`);
        await contact(out, p, size, aspects[p.id]!, propShadow(p));
        paths.push(out);
      } else if (input.role === "light") {
        const l = scene.lights?.find((x) => x.id === input.ref);
        if (!l) throw new Error("A light in this scene is missing.");
        const p = join(work, `light-${i}.png`);
        await glow(p, l, size.w, size.h);
        paths.push(p);
      } else paths.push(file(input.ref));
    }
    await mkdir(join(root, "haggs-renders"), { recursive: true });
    const name = `Grey-Room-${String(body?.name ?? "shot").replace(/[^\w-]+/g, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.mp4`;
    const out = join(root, "haggs-renders", name);
    const args = ["-y", "-v", "error", ...plan.inputs.flatMap((input, i) => [...input.args, "-i", paths[i]!]), "-filter_complex", plan.filter, "-map", "[out]", "-map", `${plan.audioFrom}:a?`, "-t", String(seconds), "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", out];
    await run(ffmpegBin(), args, { maxBuffer: 8 * 1024 * 1024 });
    return Response.json({ ok: true, url: `/api/local/haggs-renders/${encodeURIComponent(name)}`, notes: plan.notes });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The draft render failed.";
    return Response.json({ ok: false, reason: message.split("\n")[0]!.slice(0, 300) }, { status: 400 });
  } finally {
    if (work) await rm(work, { recursive: true, force: true });
  }
}
