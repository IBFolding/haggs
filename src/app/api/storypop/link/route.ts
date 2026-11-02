import { createClient } from "@supabase/supabase-js";

import { requestToken, verifyUser } from "../../../../server/auth";
import { cleanReference, sendToStoryPop } from "../../../../server/storypop";

/**
 * A signed-in haggs person connects their StoryPop account. They open the link StoryPop gave them, confirm here,
 * and haggs tells StoryPop (signed) which haggs account that token belongs to, plus the credits they have.
 */
export async function POST(request: Request) {
  const user = await verifyUser(request);
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const token = requestToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon || !token) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const linkToken = cleanReference(body.token);
  if (!linkToken) return Response.json({ ok: false, error: "That StoryPop link isn't valid." }, { status: 400 });

  // Everything below runs as the person themselves, so the database only ever shows and changes their own rows.
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { error: linkError } = await db.from("storypop_links").upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (linkError) return Response.json({ ok: false, error: "Could not save the link." }, { status: 500 });

  const { data } = await db.rpc("credits_balance");
  const row = Array.isArray(data) ? data[0] : data;
  const plan = Number(row?.plan) || 0;
  const topup = Number(row?.topup) || 0;
  const delivered = await sendToStoryPop({ type: "account.linked", linkToken, haggsUserId: user.id, creditsBalance: plan + topup, monthlyCredits: plan });
  if (!delivered) return Response.json({ ok: false, error: "StoryPop couldn't be reached. Try again in a moment." }, { status: 502 });
  return Response.json({ ok: true });
}

/** Disconnect: removes the link on this side. */
export async function DELETE(request: Request) {
  const user = await verifyUser(request);
  const token = requestToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!user || !url || !anon || !token) return Response.json({ ok: false }, { status: 401 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  await db.from("storypop_links").delete().eq("user_id", user.id);
  return Response.json({ ok: true });
}
