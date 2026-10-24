/**
 * Subscriptions, carried over from Open Haggsfield v1: the same four plans,
 * the same Stripe prices. Stripe is the record — a person's plan is read
 * live from their Stripe subscriptions, so there is no second copy of who
 * paid for what to drift out of step.
 */

/**
 * A credit is one cent of generation at Comfy's list price. Of every paid plan
 * and pack, we keep a share (HAGGS_PLATFORM_CUT, a percentage set in the
 * deployment's environment, not in the code) and the rest is the customer's,
 * as generation credits that also cover their storage. The Platform plan
 * includes none: it pays for the studio itself. Credits don't roll over; pack
 * credits don't expire. The split is never shown to customers: they see what
 * they can make. With no cut configured, paid plans include no credits.
 */
function customerShare(): number {
  const cut = Number(process.env.HAGGS_PLATFORM_CUT);
  return Number.isFinite(cut) && cut > 0 && cut < 100 ? 1 - cut / 100 : 0;
}
/** What a price turns into in credits: the customer's share, in cents, rounded down. */
export const creditsForPrice = (usd: number) => Math.floor(usd * 100 * customerShare() + 1e-9);
export type Plan = { id: "byok" | "starter" | "mid" | "pro"; name: string; monthly: number; credits: number; priceEnv: string; blurb: string };

export const PLANS: Plan[] = [
  { id: "byok", name: "Platform", monthly: 15, credits: 0, priceEnv: "STRIPE_PRICE_BYOK", blurb: "The whole studio, unlocked. Generation runs on your own Comfy key or your own GPU, at Comfy's price." },
  { id: "starter", name: "Creator", monthly: 39, get credits() { return creditsForPrice(39); }, priceEnv: "STRIPE_PRICE_STARTER", blurb: "The whole studio, with generation included. For a first short, a comic or a series." },
  { id: "mid", name: "Studio", monthly: 69, get credits() { return creditsForPrice(69); }, priceEnv: "STRIPE_PRICE_MID", blurb: "More generation every month: a whole series' worth of boards." },
  { id: "pro", name: "Production", monthly: 99, get credits() { return creditsForPrice(99); }, priceEnv: "STRIPE_PRICE_PRO", blurb: "The most generation, for work every week." },
];

export type Topup = { id: "t10" | "t25" | "t50"; usd: number; credits: number; priceEnv: string };
/** Packs of generation. */
export const TOPUPS: Topup[] = [
  { id: "t10", usd: 10, get credits() { return creditsForPrice(10); }, priceEnv: "STRIPE_PRICE_TOPUP_10" },
  { id: "t25", usd: 25, get credits() { return creditsForPrice(25); }, priceEnv: "STRIPE_PRICE_TOPUP_25" },
  { id: "t50", usd: 50, get credits() { return creditsForPrice(50); }, priceEnv: "STRIPE_PRICE_TOPUP_50" },
];

/** What a run is worth in credits: its Comfy price in cents, rounded up so a run is never undercharged. */
export const creditsFor = (usd: number) => Math.max(1, Math.ceil(usd * 100 - 1e-9));

type Env = Record<string, string | undefined>;
export type User = { id: string; email: string };

/** The plans that can actually be bought right now: a Stripe key and that plan's price are both set. */
export function configured(env: Env): (Plan & { price: string })[] {
  if (!env.STRIPE_API_KEY?.trim()) return [];
  return PLANS.filter((p) => env[p.priceEnv]?.trim()).map((p) => ({ ...p, price: env[p.priceEnv]!.trim() }));
}

/** The slice of the Stripe SDK this file uses, so it can be tested without Stripe. */
export type StripeLike = {
  customers: {
    search(query: { query: string; limit?: number }): Promise<{ data: { id: string }[] }>;
    create(args: { email: string; metadata: Record<string, string> }): Promise<{ id: string }>;
  };
  checkout: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string }> } };
  subscriptions: {
    list(args: Record<string, unknown>): Promise<{ data: { status: string; items: { data: { price: { id: string }; current_period_end?: number }[] } }[] }>;
  };
};

async function customerOf(stripe: StripeLike, user: User): Promise<string | null> {
  const found = await stripe.customers.search({ query: `metadata['haggs_user']:'${user.id.replace(/'/g, "")}'`, limit: 1 });
  return found.data[0]?.id ?? null;
}

export async function checkout(stripe: StripeLike, env: Env, planId: string, user: User, origin: string): Promise<string> {
  const plan = configured(env).find((p) => p.id === planId);
  if (!plan) throw new Error("That plan can't be bought right now.");
  const customer = (await customerOf(stripe, user)) ?? (await stripe.customers.create({ email: user.email, metadata: { haggs_user: user.id } })).id;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: plan.price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/account?checkout=done`,
    cancel_url: `${origin}/pricing`,
    subscription_data: { metadata: { haggs_user: user.id, haggs_plan: plan.id } },
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout page.");
  return session.url;
}

export type Status = { plan: Plan["id"] | null; status: string; renews: number | null };

export async function status(stripe: StripeLike, env: Env, user: User): Promise<Status> {
  const customer = await customerOf(stripe, user);
  if (!customer) return { plan: null, status: "none", renews: null };
  const prices = new Map(configured(env).map((p) => [p.price, p.id]));
  const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
  const ours = subs.data
    .map((s) => ({ s, item: s.items.data.find((i) => prices.has(i.price.id)) }))
    .filter((x) => x.item && !["canceled", "incomplete_expired"].includes(x.s.status));
  const best = ours.find((x) => x.s.status === "active" || x.s.status === "trialing") ?? ours[0];
  if (!best?.item) return { plan: null, status: "none", renews: null };
  return { plan: prices.get(best.item.price.id)!, status: best.s.status, renews: best.item.current_period_end ? best.item.current_period_end * 1000 : null };
}

export async function portal(stripe: StripeLike, env: Env, user: User, origin: string): Promise<string> {
  const customer = await customerOf(stripe, user);
  if (!customer) throw new Error("There's no subscription to manage yet.");
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${origin}/account`,
    ...(env.STRIPE_PORTAL_CONFIG_ID ? { configuration: env.STRIPE_PORTAL_CONFIG_ID } : {}),
  });
  return session.url;
}

/** The top-up packs that can be bought right now. */
export function topupsConfigured(env: Env): (Topup & { price: string })[] {
  if (!env.STRIPE_API_KEY?.trim()) return [];
  return TOPUPS.filter((t) => env[t.priceEnv]?.trim()).map((t) => ({ ...t, price: env[t.priceEnv]!.trim() }));
}

export async function topupCheckout(stripe: StripeLike, env: Env, packId: string, user: User, origin: string): Promise<string> {
  const pack = topupsConfigured(env).find((t) => t.id === packId);
  if (!pack) throw new Error("That pack can't be bought right now.");
  const customer = (await customerOf(stripe, user)) ?? (await stripe.customers.create({ email: user.email, metadata: { haggs_user: user.id } })).id;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: pack.price, quantity: 1 }],
    success_url: `${origin}/account?topup=done`,
    cancel_url: `${origin}/account`,
    metadata: { haggs_user: user.id, haggs_topup: pack.id },
  } as never);
  if (!session.url) throw new Error("Stripe didn't return a checkout page.");
  return session.url;
}

/** What a paid Stripe event means for credits: reset a person's monthly credits on renewal, or add a top-up pack. Anything else is ignored. */
export type CreditChange = { user: string; bucket: "plan" | "topup"; cents: number; ref: string; kind: "renewal" | "topup" } | null;

export function changeFor(event: { id: string; type: string; data: { object: Record<string, unknown> } }, env: Env): CreditChange {
  const o = event.data.object as { metadata?: Record<string, string>; subscription_details?: { metadata?: Record<string, string> }; lines?: { data?: { price?: { id?: string } }[] }; billing_reason?: string; payment_status?: string; id?: string };
  if (event.type === "invoice.paid") {
    const meta = o.subscription_details?.metadata ?? {};
    const priceId = o.lines?.data?.[0]?.price?.id;
    const plan = configured(env).find((p) => p.price === priceId) ?? PLANS.find((p) => p.id === meta.haggs_plan);
    if (!meta.haggs_user || !plan) return null;
    return { user: meta.haggs_user, bucket: "plan", cents: plan.credits, ref: o.id ?? event.id, kind: "renewal" };
  }
  if (event.type === "checkout.session.completed" && o.metadata?.haggs_topup && o.payment_status === "paid") {
    const pack = TOPUPS.find((t) => t.id === o.metadata!.haggs_topup);
    if (!pack || !o.metadata.haggs_user) return null;
    return { user: o.metadata.haggs_user, bucket: "topup", cents: pack.credits, ref: o.id ?? event.id, kind: "topup" };
  }
  return null;
}

/** What credits buy, in things people make: the outputs, not the dollars. Priced at Comfy's list: a 4-second clip about 52 cents, a picture about 7. */
export function capacity(credits: number): { clips: number; pictures: number } {
  return { clips: Math.floor(credits / 52 / 5) * 5, pictures: Math.floor(credits / 7 / 10) * 10 };
}
