import { createClient } from "@supabase/supabase-js";

import { templateById } from "../../../../server/adTemplates";
import { cleanReference, isUuid, partnerKeyOk } from "../../../../server/storypop";

/**
 * StoryPop asks for a few versions of one ad. Each version becomes a job in the account StoryPop pays from;
 * the finished video comes back through the normal job.completed event.
 */
export async function POST(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { haggsUserId?: unknown; templateId?: unknown; references?: unknown; brandKit?: unknown; offer?: unknown; cta?: unknown };
  const template = templateById(body.templateId);
  const refs = Array.isArray(body.references) ? body.references.map(cleanReference).filter((r): r is string => Boolean(r)) : [];
  if (!isUuid(body.haggsUserId) || !template || refs.length < 1 || refs.length > 6) return Response.json({ ok: false, error: "haggsUserId, a known templateId and 1 to 6 references are required" }, { status: 400 });
  const input = { templateId: template.id, brandKit: body.brandKit ?? null, offer: String(body.offer ?? "").slice(0, 200), cta: String(body.cta ?? "").slice(0, 40) };
  if (JSON.stringify(input).length > 8000) return Response.json({ ok: false, error: "Too much text" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  if (!url || !anon || !secret) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const jobs: string[] = [];
  for (const [i, reference] of refs.entries()) {
    const { data, error } = await db.rpc("storypop_job_create", { target: body.haggsUserId, reference, kind: "ad", input: { ...input, version: i + 1 }, secret });
    if (error) return Response.json({ ok: false, error: "Could not save the ad jobs.", started: jobs }, { status: 500 });
    jobs.push(String(data));
  }
  return Response.json({ ok: true, haggsJobIds: jobs, estCredits: template.est_credits * refs.length });
}
