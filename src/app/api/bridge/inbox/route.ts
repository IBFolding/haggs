import { bridgeRoot, dismiss, inbox } from "../../../../server/bridge";
import { bridgeAllowed } from "../../../../server/bridge-guard";

/** What Claude has sent a project, waiting to be applied or dismissed. */
export async function GET(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const project = new URL(request.url).searchParams.get("project") ?? "";
  try {
    return Response.json({ ok: true, items: await inbox(bridgeRoot(process.cwd()), project) });
  } catch {
    return Response.json({ ok: false, items: [] }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const params = new URL(request.url).searchParams;
  try {
    await dismiss(bridgeRoot(process.cwd()), params.get("project") ?? "", params.get("id") ?? "");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
}
