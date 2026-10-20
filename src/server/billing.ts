/**
 * Subscriptions, carried over from Open Haggsfield v1: the same four plans,
 * the same Stripe prices. Stripe is the record — a person's plan is read
 * live from their Stripe subscriptions, so there is no second copy of who
 * paid for what to drift out of step.
 */

export type Plan = { id: "byok" | "starter" | "mid" | "pro"; name: string; monthly: number; credits: number; priceEnv: string; blurb: string };

export const PLANS: Plan[] = [
  { id: "byok", name: "Bring your own key", monthly: 15, credits: 0, priceEnv: "STRIPE_PRICE_BYOK", blurb: "The whole studio. Generation runs on your own Comfy key, at Comfy's price." },
  { id: "starter", name: "Starter", monthly: 25, credits: 500, priceEnv: "STRIPE_PRICE_STARTER", blurb: "For a first short or a sizzle." },
  { id: "mid", name: "Mid", monthly: 49, credits: 1000, priceEnv: "STRIPE_PRICE_MID", blurb: "For a series' worth of boards." },
  { id: "pro", name: "Pro", monthly: 99, credits: 3000, priceEnv: "STRIPE_PRICE_PRO", blurb: "For production work, every week." },
];

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
