import { RUNNABLE_TEMPLATES } from "../../../../server/adTemplates";
import { partnerKeyOk } from "../../../../server/storypop";

export async function GET(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, templates: RUNNABLE_TEMPLATES });
}
