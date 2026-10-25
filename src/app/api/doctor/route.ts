import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { signInRequired, verifyUser } from "../../../server/auth";
import { analyze } from "../../../server/analyze";
import { hosted, isBlobUrl } from "../../../server/blob";
import { allow, caller } from "../../../server/limit";
import { bridgeAllowed } from "../../../server/bridge-guard";
import { localFile } from "../../../server/local-media";
import { diagnose, summarize } from "../../../story/doctor";

/** Reads a film that is already in the file store (or, in development, the media folder) and says what would hold a viewer. Free. */
export const maxDuration = 300;

const LIMIT = 300 * 1024 * 1024;

export async function POST(request: Request) {
  const online = hosted();
  if (!online && !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  let who = null;
  if (online) {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== request.headers.get("host")) return Response.json({ ok: false, reason: "Not allowed." }, { status: 403 });
    who = await verifyUser(request);
    if (signInRequired() && !who) return Response.json({ ok: false, reason: "Sign in to check a film here." }, { status: 401 });
    if (!allow(`doctor:${caller(request, who?.id)}`, 20, 3_600_000)) return Response.json({ ok: false, reason: "That's a lot of checks for now. Try again in a little while." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";
  const scratch = await mkdtemp(join(tmpdir(), "haggs-doctor-"));
  try {
    let path: string;
    if (url.startsWith("/api/local/")) {
      const segments = url.slice("/api/local/".length).split("/").map((s) => decodeURIComponent(s));
      const file = localFile(process.env.HAGGS_LOCAL_MEDIA, segments, process.env.NODE_ENV);
      if (!file) return Response.json({ ok: false, reason: "That film isn't in the media folder." }, { status: 400 });
      path = file.path;
    } else if (online && isBlobUrl(url)) {
      const res = await fetch(url);
      if (!res.ok) return Response.json({ ok: false, reason: "That film couldn't be opened." }, { status: 400 });
      if (Number(res.headers.get("content-length") ?? 0) > LIMIT) return Response.json({ ok: false, reason: "Keep films under 300 MB." }, { status: 400 });
      path = join(scratch, "film");
      await writeFile(path, new Uint8Array(await res.arrayBuffer()));
    } else {
      return Response.json({ ok: false, reason: "Add the film first." }, { status: 400 });
    }
    const metrics = await analyze(path);
    if (!metrics.seconds || !metrics.width) return Response.json({ ok: false, reason: "That doesn't look like a film." }, { status: 400 });
    const findings = diagnose(metrics);
    return Response.json({ ok: true, metrics: { seconds: metrics.seconds, width: metrics.width, height: metrics.height, cuts: metrics.hardCuts.length + metrics.dissolves.length }, findings, summary: summarize(findings) });
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? "That film couldn't be read." : "The check failed." }, { status: 500 });
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
