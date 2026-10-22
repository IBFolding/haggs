import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { bridgeAllowed } from "../../../server/bridge-guard";
import { localUrl } from "../../../server/local-media";

const KINDS: Record<string, string> = { ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".aac": "audio", ".flac": "audio", ".mp4": "video", ".mov": "video", ".webm": "video", ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image" };

/** Puts a file you add — a soundtrack, a picture — into the local media folder. Development only. */
export async function POST(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA so added files have somewhere to go." }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, reason: "No file came with the upload." }, { status: 400 });
  const ext = extname(file.name).toLowerCase();
  if (!KINDS[ext]) return Response.json({ ok: false, reason: "Add an audio file (mp3, wav, m4a, aac, flac), a video or a picture." }, { status: 400 });
  if (file.size > 300 * 1024 * 1024) return Response.json({ ok: false, reason: "Keep added files under 300 MB." }, { status: 400 });
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  await mkdir(join(root, "haggs-uploads"), { recursive: true });
  await writeFile(join(root, "haggs-uploads", name), new Uint8Array(await file.arrayBuffer()));
  return Response.json({ ok: true, url: localUrl("haggs-uploads", name), kind: KINDS[ext], name: file.name });
}
