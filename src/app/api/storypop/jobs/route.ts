import { createClient } from "@supabase/supabase-js";

import { cleanReference, isJobKind, isUuid, partnerKeyOk } from "../../../../server/storypop";

/**
 * StoryPop hands haggs a job for a linked person (a remix, a template run, a project). It waits in the person's
 * account until they make it and send the result back, so every price is still shown before they press the button.
 */
export async function POST(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { haggsUserId?: unknown; kind?: unknown; reference?: unknown; input?: unknown };
  const reference = cleanReference(body.reference);
  if (!isUuid(body.haggsUserId) || !isJobKind(body.kind) || !reference) return Response.json({ ok: false, error: "haggsUserId, kind and reference are required" }, { status: 400 });
  const input = body.input && typeof body.input === "object" && JSON.stringify(body.input).length <= 8000 ? body.input : {};

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  if (!url || !anon || !secret) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("storypop_job_create", { target: body.haggsUserId, reference, kind: body.kind, input, secret });
  if (error) return Response.json({ ok: false, error: /not linked/.test(error.message) ? "That haggs account isn't linked to StoryPop." : "Could not save the job." }, { status: /not linked/.test(error.message) ? 409 : 500 });
  return Response.json({ ok: true, haggsJobId: String(data) });
}
