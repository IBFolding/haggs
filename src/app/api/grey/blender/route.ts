import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { bridgeAllowed } from "../../../../server/bridge-guard";
import { hosted } from "../../../../server/blob";
import { localFile } from "../../../../server/local-media";
import { frameOf } from "../../../../story/cut";
import { BLENDER_README, BLENDER_SCRIPT, blenderManifest } from "../../../../story/grey-blender";
import { normalizeScene } from "../../../../story/grey-scene";

const run = promisify(execFile);

/** The Grey Room set as a folder Blender can build: manifest, script, every picture and video, and a README, zipped. Development only, like the draft render. */
export async function POST(request: Request) {
  if (hosted() || !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const root = process.env.HAGGS_LOCAL_MEDIA;
  if (!root) return Response.json({ ok: false, reason: "Set HAGGS_LOCAL_MEDIA so the set can be gathered." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { scene?: unknown; footage?: unknown; footageKind?: unknown; seconds?: unknown; aspect?: unknown; name?: unknown } | null;
  const footage = typeof body?.footage === "string" ? body.footage : "";
  const seconds = Math.min(120, Math.max(0.5, Number(body?.seconds) || 4));
  const name = String(body?.name ?? "shot").replace(/[^\w -]+/g, "").trim().slice(0, 50) || "shot";
  let work: string | null = null;
  try {
    const scene = normalizeScene(body?.scene as never);
    const manifest = blenderManifest(scene, { name, size: frameOf(body?.aspect === "9:16" ? "9:16" : "16:9"), seconds, fps: 24, footage: { url: footage, kind: body?.footageKind === "image" ? "image" : "video" } });
    work = await mkdtemp(join(tmpdir(), "haggs-blender-"));
    const folder = `Haggs-Grey-Room-${name.replace(/\s+/g, "-")}`;
    const dir = join(work, folder);
    await mkdir(join(dir, "assets"), { recursive: true });
    for (const [rel, url] of Object.entries(manifest.assets)) {
      if (!url.startsWith("/api/local/")) throw new Error("The Blender set can only gather files from your media folder.");
      const found = localFile(root, url.slice("/api/local/".length).split("/").map(decodeURIComponent), process.env.NODE_ENV);
      if (!found) throw new Error(`A file in this set isn't in the media folder: ${url.split("/").at(-1)}`);
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await copyFile(found.path, join(dir, rel));
    }
    await writeFile(join(dir, "scene.json"), JSON.stringify(manifest, null, 1));
    await writeFile(join(dir, "build_scene.py"), BLENDER_SCRIPT);
    await writeFile(join(dir, "README.txt"), BLENDER_README(manifest));
    await run("zip", ["-qr", `${folder}.zip`, folder], { cwd: work });
    const zip = await readFile(join(work, `${folder}.zip`));
    return new Response(new Uint8Array(zip), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${folder}.zip"`, "x-haggs-notes": encodeURIComponent(JSON.stringify(manifest.notes)) } });
  } catch (caught) {
    return Response.json({ ok: false, reason: (caught instanceof Error ? caught.message : "The set couldn't be gathered.").split("\n")[0]!.slice(0, 300) }, { status: 400 });
  } finally {
    if (work) await rm(work, { recursive: true, force: true });
  }
}
