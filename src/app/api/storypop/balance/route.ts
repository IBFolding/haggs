import { createClient } from "@supabase/supabase-js";

import { isUuid, partnerKeyOk } from "../../../../server/storypop";

/** StoryPop asks what a linked person has. Needs the partner key. */
export async function GET(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  const target = new URL(request.url).searchParams.get("user");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  if (!isUuid(target)) return Response.json({ ok: false, error: "user must be a haggs account id" }, { status: 400 });
  if (!url || !anon || !secret) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("storypop_balance_for", { target, secret });
  if (error) return Response.json({ ok: false, error: "Could not read the balance." }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  const plan = Number(row?.plan) || 0;
  const topup = Number(row?.topup) || 0;
  return Response.json({ ok: true, plan, topup, total: plan + topup });
}
