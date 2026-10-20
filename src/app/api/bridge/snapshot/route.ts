import { bridgeRoot, removeSnapshot, writeSnapshot, type Snapshot } from "../../../../server/bridge";
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
