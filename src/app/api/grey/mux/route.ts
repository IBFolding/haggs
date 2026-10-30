import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { greyMuxArgs } from "../../../../server/grey-mux";
import { bridgeAllowed } from "../../../../server/bridge-guard";
import { hosted } from "../../../../server/blob";
import { ffmpegBin, ffprobeBin } from "../../../../server/ffmpeg";
import { localFile, localUrl } from "../../../../server/local-media";

const run = promisify(execFile);

/** Puts a shot's own sound back under a picture that has none, such as a render brought back from Blender. Development only. */
export async function POST(request: Request) {
  if (hosted() || !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA first." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { video?: unknown; sound?: unknown; trimIn?: unknown } | null;
  try {
    const pick = (u: unknown) => {
      const url = typeof u === "string" ? u : "";
      const found = url.startsWith("/api/local/") ? localFile(root, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV) : null;
      if (!found) throw new Error("That file isn't in your media folder.");
      return found.path;
    };
    const video = pick(body?.video), sound = pick(body?.sound);
    const trimIn = Number(body?.trimIn ?? 0);
    if (!Number.isFinite(trimIn) || trimIn < 0) throw new Error("The source start must be a non-negative number.");
    const { stdout } = await run(ffprobeBin(), ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", sound]);
    await mkdir(join(root, "haggs-renders"), { recursive: true });
    const name = `Blender-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${Math.random().toString(16).slice(2, 6)}.mp4`;
    const out = join(root, "haggs-renders", name);
    // No sound to put back: the picture is kept as it is.
    const args = greyMuxArgs(video, sound, out, Boolean(stdout.trim()), trimIn);
    await run(ffmpegBin(), args);
    return Response.json({ ok: true, url: localUrl("haggs-renders", name) });
  } catch (caught) {
    return Response.json({ ok: false, reason: (caught instanceof Error ? caught.message : "The sound couldn't be added.").split("\n")[0]!.slice(0, 300) }, { status: 400 });
  }
}
