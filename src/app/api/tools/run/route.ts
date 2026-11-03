import { bridgeAllowed } from "../../../../server/bridge-guard";
import { hosted } from "../../../../server/blob";
import { availability, runVideoTool } from "../../../../server/video-tools";

/** Runs a free open-source video tool on a clip in the local media folder. Local development only: nothing runs on the hosted site. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (hosted() || !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  return Response.json({ ok: true, installed: await availability(), folder: !!process.env.HAGGS_LOCAL_MEDIA });
}

export async function POST(request: Request) {
  if (hosted() || !bridgeAllowed(request)) return new Response("Not found", { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, reason: "Nothing to run." }, { status: 400 });
  const result = await runVideoTool(body, process.env.HAGGS_LOCAL_MEDIA, process.env.NODE_ENV);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
