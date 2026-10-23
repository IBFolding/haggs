import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { changeFor } from "../../../../server/billing";

/**
 * Stripe tells us when money arrives: a paid invoice resets that person's
 * monthly credits, a paid top-up adds a pack. The signature is checked first,
 * and the database only accepts the change with the shared webhook secret.
 */
export async function POST(request: Request) {
  const key = process.env.STRIPE_API_KEY?.trim();
  const signing = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key || !signing || !secret || !url || !anon) return new Response("Not switched on", { status: 503 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", signing);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  const change = changeFor(event as never, process.env);
  if (!change) return Response.json({ ok: true, ignored: true });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = change.kind === "renewal"
    ? await db.rpc("credits_renew", { target: change.user, cents: change.cents, ref: change.ref, secret })
    : await db.rpc("credits_grant", { target: change.user, cents: change.cents, ref: change.ref, secret });
  // A failure is answered with an error so Stripe tries again later; the database ignores a repeat.
  if (error) return new Response("Could not record credits", { status: 500 });
  return Response.json({ ok: true });
}
