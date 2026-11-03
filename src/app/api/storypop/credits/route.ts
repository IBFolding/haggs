import { createClient } from "@supabase/supabase-js";

import { cleanCredits, cleanReference, isUuid, partnerKeyOk } from "../../../../server/storypop";

/**
 * StoryPop sold a credit pack to a linked person and asks haggs to add the credits. The reference makes it safe
 * to repeat: the database ignores a second grant with the same reference.
 */
export async function POST(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { haggsUserId?: unknown; credits?: unknown; reference?: unknown };
  const credits = cleanCredits(body.credits);
  const reference = cleanReference(body.reference);
  if (!isUuid(body.haggsUserId) || !credits || !reference) return Response.json({ ok: false, error: "haggsUserId, credits and reference are required" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  if (!url || !anon || !secret) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.rpc("credits_grant", { target: body.haggsUserId, cents: credits, ref: `storypop:${reference}`, secret });
  if (error) return Response.json({ ok: false, error: "Could not add the credits." }, { status: 500 });
  return Response.json({ ok: true });
}
