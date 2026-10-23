import { bridgeRoot, listSnapshots, readSnapshot, removeSnapshot, writeSnapshot, type Snapshot } from "../../../../server/bridge";
import { bridgeAllowed } from "../../../../server/bridge-guard";

/** The app posts each project here when it saves, so Claude can read it over MCP. */
export async function POST(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const body = (await request.json().catch(() => null)) as Snapshot | null;
  if (!body?.project?.id) return Response.json({ ok: false, reason: "No project in the snapshot." }, { status: 400 });
  try {
    await writeSnapshot(bridgeRoot(process.cwd()), { project: body.project, sheets: body.sheets ?? null });
    return Response.json({ ok: true });
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "Not saved." }, { status: 400 });
  }
}

/** A deleted project leaves the bridge too, so Claude no longer sees it. */
export async function DELETE(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  try {
    await removeSnapshot(bridgeRoot(process.cwd()), new URL(request.url).searchParams.get("project") ?? "");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}

/** What the app has kept on disk: the list, or one project with its sheets (?id=). Development only. */
export async function GET(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!id) return Response.json({ ok: true, items: await listSnapshots(bridgeRoot(process.cwd())) });
    const snap = await readSnapshot(bridgeRoot(process.cwd()), id);
    return snap ? Response.json({ ok: true, snapshot: snap }) : Response.json({ ok: false, reason: "No copy of that project on disk." }, { status: 404 });
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "Couldn't read the backup." }, { status: 400 });
  }
}
