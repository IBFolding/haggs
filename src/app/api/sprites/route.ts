import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { signInRequired, verifyUser } from "../../../server/auth";
import { bridgeAllowed } from "../../../server/bridge-guard";
import { hosted, isBlobUrl, putBlob } from "../../../server/blob";
import { allow, caller } from "../../../server/limit";
import { localFile, localUrl } from "../../../server/local-media";
import { makeSheet } from "../../../server/sprites";

/** Cuts a clip already in the file store into a sprite sheet. Free: ffmpeg only. */
export const maxDuration = 120;

const LIMIT = 300 * 1024 * 1024;

export async function POST(request: Request) {
  const online = hosted();
  if (!online && !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  if (online) {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ ok: false, reason: "Not allowed." }, { status: 403 });
    const who = await verifyUser(request);
    if (signInRequired() && !who) return Response.json({ ok: false, reason: "Sign in to make a sheet here." }, { status: 401 });
    if (!allow(`sprites:${caller(request, who?.id)}`, 30, 3_600_000)) return Response.json({ ok: false, reason: "That's a lot of sheets for now. Try again in a little while." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { url?: unknown; frames?: unknown; columns?: unknown; size?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const scratch = await mkdtemp(join(tmpdir(), "haggs-sprites-"));
  try {
    let input: string;
    if (url.startsWith("/api/local/")) {
      const file = localFile(process.env.HAGGS_LOCAL_MEDIA, url.slice("/api/local/".length).split("/").map((s) => decodeURIComponent(s)), process.env.NODE_ENV);
      if (!file) return Response.json({ ok: false, reason: "That clip isn't in the media folder." }, { status: 400 });
      input = file.path;
    } else if (online && isBlobUrl(url)) {
      const res = await fetch(url);
      if (!res.ok) return Response.json({ ok: false, reason: "That clip couldn't be opened." }, { status: 400 });
      if (Number(res.headers.get("content-length") ?? 0) > LIMIT) return Response.json({ ok: false, reason: "Keep clips under 300 MB." }, { status: 400 });
      input = join(scratch, "clip");
      await writeFile(input, new Uint8Array(await res.arrayBuffer()));
    } else {
      return Response.json({ ok: false, reason: "Add the clip first." }, { status: 400 });
    }
    const out = join(scratch, "sheet.png");
    const plan = await makeSheet(input, out, { frames: Number(body?.frames), columns: Number(body?.columns), size: Number(body?.size) });
    const bytes = new Uint8Array(await readFile(out));
    let sheet: string;
    if (online) sheet = await putBlob(bytes, "png", "sprites");
    else {
      const root = process.env.HAGGS_LOCAL_MEDIA;
      if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the sheet has somewhere to be kept." }, { status: 400 });
      const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.png`;
      await mkdir(join(root, "haggs-sprites"), { recursive: true });
      await writeFile(join(root, "haggs-sprites", name), bytes);
      sheet = localUrl("haggs-sprites", name);
    }
    return Response.json({ ok: true, url: sheet, layout: { columns: plan.columns, rows: plan.rows, frames: plan.frames, cell: plan.size, fps: plan.fps, seconds: plan.seconds } });
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "The sheet couldn't be made." }, { status: 400 });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
