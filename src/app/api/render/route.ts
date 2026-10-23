import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import sharp from "sharp";

import { hosted, putBlob } from "../../../server/blob";
import { bridgeAllowed } from "../../../server/bridge-guard";
import { ffmpegBin, ffprobeBin } from "../../../server/ffmpeg";
import { readRendered, stageHosted } from "../../../server/render-hosted";
import { localFile } from "../../../server/local-media";
import { checkCut, renderCut } from "../../../server/render";

const run = promisify(execFile);

/** Renders a cut to an MP4 in the local media folder. Development only; needs ffmpeg. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const online = hosted();
  if (!online && !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  if (online) {
    // Only this site's own pages may start a render.
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ ok: false, reason: "Not allowed." }, { status: 403 });
  }
  const scratch = online ? await mkdtemp(join(tmpdir(), "haggs-hosted-")) : null;
  const root = scratch ?? process.env.HAGGS_LOCAL_MEDIA;
  if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the film has somewhere to be kept." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { cut?: unknown; name?: unknown } | null;
  let work: string | null = null;
  try {
    let cut = checkCut(body?.cut);
    if (online) cut = await stageHosted(cut, root);
    else {
      // Every file must really be in the media folder: no symlink out, nothing missing.
      for (const url of [...cut.clips.map((c) => c.url), ...cut.voices.map((v) => v.url), ...(cut.effects ?? []).map((e) => e.url), ...(cut.overlays ?? []).map((o) => o.url), ...(cut.music ? [cut.music.url] : [])]) {
        const segments = url.slice("/api/local/".length).split("/").map(decodeURIComponent);
        if (!localFile(root, segments, process.env.NODE_ENV)) throw new Error(`A file in the cut isn't in the media folder: ${segments.at(-1)}`);
      }
    }
    work = await mkdtemp(join(tmpdir(), "haggs-render-"));
    await mkdir(join(root, "haggs-renders"), { recursive: true });
    const now = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}`;
    const out = await renderCut(cut, String(body?.name ?? "cut").slice(0, 80), {
      root,
      work,
      stamp,
      ffmpeg: async (args) => void (await run(ffmpegBin(), args, { maxBuffer: 8 * 1024 * 1024 })),
      hasAudio: async (path) => {
        const { stdout } = await run(ffprobeBin(), ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path]);
        return stdout.trim().length > 0;
      },
      write: (path, text) => writeFile(path, text),
      caption: async (path, text, { w, h }) => {
        const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const size = Math.round(h * 0.05);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="${w / 2}" y="${h * 0.9}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="${size / 9}" paint-order="stroke" stroke-linejoin="round">${esc}</text></svg>`;
        await sharp(Buffer.from(svg)).png().toFile(path);
      },
    });
    if (online) {
      // The film goes to the file store, so the browser can play and download it.
      const url = await putBlob(new Uint8Array(await readRendered(out.path)), "mp4", "renders");
      return Response.json({ ok: true, url, seconds: cut.total });
    }
    return Response.json({ ok: true, url: out.url, seconds: cut.total });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "The render failed.";
    return Response.json({ ok: false, reason: /ENOENT.*ffmpeg|spawn ffmpeg/.test(message) ? "ffmpeg isn't installed on this machine. Use the ffmpeg script instead." : message.split("\n")[0]!.slice(0, 300) }, { status: 400 });
  } finally {
    if (work) await rm(work, { recursive: true, force: true });
    if (scratch) await rm(scratch, { recursive: true, force: true });
  }
}
