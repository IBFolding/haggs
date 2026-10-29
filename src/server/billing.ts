/**
 * Subscriptions, carried over from Open Haggsfield v1: the same four plans,
 * the same Stripe prices. Stripe is the record — a person's plan is read
 * live from their Stripe subscriptions, so there is no second copy of who
 * paid for what to drift out of step.
 */

/**
 * A credit is one cent of generation at Comfy's list price. Of every legacy paid plan
 * and legacy pack, we keep a share (HAGGS_PLATFORM_CUT, a percentage set in the
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
export type Plan = { id: "byok" | "starter" | "mid" | "pro"; name: string; monthly: number; credits: number; priceEnv: string; storageGB: number; blurb: string };

export const PLANS: Plan[] = [
  { id: "byok", name: "Platform", monthly: 15, credits: 0, priceEnv: "STRIPE_PRICE_BYOK", storageGB: 0, blurb: "The whole studio, unlocked. Generation runs on your own Comfy key or your own GPU, at Comfy's price." },
  { id: "starter", name: "Creator", monthly: 39, credits: 2400, priceEnv: "STRIPE_PRICE_STARTER_FIXED_2026", storageGB: 5, blurb: "The whole studio, with generation included. For a first short, a comic or a series." },
  { id: "mid", name: "Studio", monthly: 69, credits: 4400, priceEnv: "STRIPE_PRICE_MID_FIXED_2026", storageGB: 15, blurb: "More generation every month: a whole series' worth of boards." },
  { id: "pro", name: "Production", monthly: 99, credits: 6400, priceEnv: "STRIPE_PRICE_PRO_FIXED_2026", storageGB: 30, blurb: "The most generation, for work every week." },
];

export const PLAN_VERSION = "fixed-2026-10";
const LEGACY_PLAN_ENVS: Record<string,string> = {byok:"STRIPE_PRICE_BYOK",starter:"STRIPE_PRICE_STARTER",mid:"STRIPE_PRICE_MID",pro:"STRIPE_PRICE_PRO"};

export type Topup = { id: string; usd: number; credits: number; retainedUsd: number; priceEnv: string };
/** Versioned new-purchase entitlements. Never reinterpret an existing Stripe session. */
export const TOPUP_VERSION = "fixed-2026-10";
export const TOPUPS: Topup[] = [
  { id: "fixed15", usd: 15, credits: 1200, retainedUsd: 3, priceEnv: "STRIPE_PRICE_TOPUP_FIXED_15" },
  { id: "fixed30", usd: 30, credits: 2400, retainedUsd: 6, priceEnv: "STRIPE_PRICE_TOPUP_FIXED_30" },
  { id: "fixed50", usd: 50, credits: 4200, retainedUsd: 8, priceEnv: "STRIPE_PRICE_TOPUP_FIXED_50" },
  { id: "fixed75", usd: 75, credits: 6500, retainedUsd: 10, priceEnv: "STRIPE_PRICE_TOPUP_FIXED_75" },
  { id: "fixed100", usd: 100, credits: 8500, retainedUsd: 15, priceEnv: "STRIPE_PRICE_TOPUP_FIXED_100" },
];
/** Fulfillment only: no new legacy checkout, old signed events retain their old mapping. */
const LEGACY_TOPUPS = [{id:"t10",usd:10},{id:"t25",usd:25},{id:"t50",usd:50}];

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
  prices?: { retrieve: (id:string) => Promise<{active:boolean;currency:string;unit_amount:number|null;recurring?:unknown}> };
  customers: {
    search(query: { query: string; limit?: number }): Promise<{ data: { id: string }[] }>;
    create(args: { email: string; metadata: Record<string, string> }): Promise<{ id: string }>;
  };
  checkout: { sessions: { create(args: Record<string, unknown>): Promise<{ id?: string; url: string | null; amount_total?: number | null; currency?: string | null }>; expire?(id: string): Promise<unknown> } };
  billingPortal: { sessions: { create(args: Record<string, unknown>): Promise<{ url: string }> } };
  subscriptions: {
    list(args: Record<string, unknown>): Promise<{ data: { status: string; cancel_at_period_end?: boolean; items: { data: { price: { id: string }; current_period_end?: number }[] } }[] }>;
  };
};

async function customerOf(stripe: StripeLike, user: User): Promise<string | null> {
  const found = await stripe.customers.search({ query: `metadata['haggs_user']:'${user.id.replace(/'/g, "")}'`, limit: 1 });
  return found.data[0]?.id ?? null;
}


/** A refusal written for the customer. Anything else that goes wrong (a Stripe error, say) is logged, never shown. */
export class BillingError extends Error {}
export const customerMessage = (caught: unknown, fallback: string) => {
  if (caught instanceof BillingError) return caught.message;
  console.error("billing:", caught instanceof Error ? caught.message : caught);
  return fallback;
};

type PriceLike = { active: boolean; currency: string; unit_amount: number | null; recurring?: unknown };
/**
 * The price's own record, when the Stripe key may read prices: null when it may not.
 * A key without that permission still checks out: the session's total is verified instead, see confirmTotal.
 */
async function readPrice(stripe: StripeLike, id: string): Promise<PriceLike | null> {
  if (!stripe.prices) return null;
  try { return await stripe.prices.retrieve(id); } catch (caught) { console.error("billing: price could not be read, verifying the session total instead:", caught instanceof Error ? caught.message : caught); return null; }
}
/** With no price read, the session Stripe built must charge exactly what the plan costs, in dollars; otherwise it is cancelled and no link is given. */
async function confirmTotal(stripe: StripeLike, session: { id?: string; url: string | null; amount_total?: number | null; currency?: string | null }, usd: number, what: string): Promise<void> {
  if (session.amount_total === usd * 100 && session.currency === "usd") return;
  if (session.id) await stripe.checkout.sessions.expire?.(session.id).catch(() => undefined);
  throw new BillingError(`This ${what} is not configured correctly. No checkout was created.`);
}

export async function checkout(stripe: StripeLike, env: Env, planId: string, user: User, origin: string): Promise<string> {
  const plan = configured(env).find((p) => p.id === planId);
  if (!plan) throw new BillingError("That plan can't be bought right now.");
  const price = await readPrice(stripe, plan.price);
  const recurring = price?.recurring as { interval?: string; interval_count?: number } | null | undefined;
  if (price && (!price.active || price.currency !== "usd" || price.unit_amount !== plan.monthly * 100 || recurring?.interval !== "month" || recurring.interval_count !== 1)) throw new BillingError("This subscription is not configured correctly. No checkout was created.");
  const customer = (await customerOf(stripe, user)) ?? (await stripe.customers.create({ email: user.email, metadata: { haggs_user: user.id } })).id;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: plan.price, quantity: 1 }],
    allow_promotion_codes: false,
    success_url: `${origin}/account?checkout=done`,
    cancel_url: `${origin}/pricing`,
    subscription_data: { metadata: { haggs_user: user.id, haggs_plan: plan.id, haggs_plan_version: PLAN_VERSION, haggs_credit_grant: String(plan.credits) } },
  });
  if (!price) await confirmTotal(stripe, session, plan.monthly, "subscription");
  if (!session.url) throw new BillingError("Stripe didn't return a checkout page.");
  return session.url;
}

/** `ending` is set when the plan is cancelled and stops at `renews` instead of renewing. */
export type Status = { plan: Plan["id"] | null; status: string; renews: number | null; ending?: true };

export async function status(stripe: StripeLike, env: Env, user: User): Promise<Status> {
  const customer = await customerOf(stripe, user);
  if (!customer) return { plan: null, status: "none", renews: null };
  const prices = new Map<string, Plan["id"]>(PLANS.flatMap(p => [env[p.priceEnv],env[LEGACY_PLAN_ENVS[p.id]!]].filter((v):v is string=>Boolean(v)).map(v=>[v,p.id])));
  const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
  const ours = subs.data
    .map((s) => ({ s, item: s.items.data.find((i) => prices.has(i.price.id)) }))
    .filter((x) => x.item && !["canceled", "incomplete_expired"].includes(x.s.status));
  const best = ours.find((x) => x.s.status === "active" || x.s.status === "trialing") ?? ours[0];
  if (!best?.item) return { plan: null, status: "none", renews: null };
  return { plan: prices.get(best.item.price.id)!, status: best.s.status, renews: best.item.current_period_end ? best.item.current_period_end * 1000 : null, ...(best.s.cancel_at_period_end ? { ending: true as const } : {}) };
}

export async function portal(stripe: StripeLike, env: Env, user: User, origin: string): Promise<string> {
  const customer = await customerOf(stripe, user);
  if (!customer) throw new BillingError("There's no subscription to manage yet.");
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
  if (!pack) throw new BillingError("That pack can't be bought right now.");
  const price = await readPrice(stripe, pack.price);
  if (price && (!price.active || price.currency !== "usd" || price.unit_amount !== pack.usd * 100 || price.recurring)) throw new BillingError("This credit pack is not configured correctly. No checkout was created.");
  const customer = (await customerOf(stripe, user)) ?? (await stripe.customers.create({ email: user.email, metadata: { haggs_user: user.id } })).id;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: pack.price, quantity: 1 }],
    success_url: `${origin}/account?topup=done`,
    cancel_url: `${origin}/account`,
    allow_promotion_codes: false,
    metadata: { haggs_user: user.id, haggs_topup: pack.id, haggs_pack_version: TOPUP_VERSION, haggs_credit_grant: String(pack.credits), haggs_price_id: pack.price },
  } as never);
  if (!price) await confirmTotal(stripe, session, pack.usd, "credit pack");
  if (!session.url) throw new BillingError("Stripe didn't return a checkout page.");
  return session.url;
}

/** What a paid Stripe event means for credits: reset a person's monthly credits on renewal, or add a top-up pack. Anything else is ignored. */
export type CreditChange = { user: string; bucket: "plan" | "topup"; cents: number; ref: string; kind: "renewal" | "topup" } | null;

export function changeFor(event: { id: string; type: string; data: { object: Record<string, unknown> } }, env: Env): CreditChange {
  const o = event.data.object as { metadata?: Record<string, string>; subscription_details?: { metadata?: Record<string, string> }; parent?: { subscription_details?: {metadata?: Record<string,string>} }; lines?: { data?: { price?: { id?: string }; pricing?: {price_details?:{price?:string}} }[] }; billing_reason?: string; payment_status?: string; amount_total?: number; currency?: string; client_reference_id?: string; id?: string; amount_paid?: number; total?: number };
  if (event.type === "invoice.paid") {
    const meta = o.parent?.subscription_details?.metadata ?? o.subscription_details?.metadata ?? {};
    const priceId = o.lines?.data?.[0]?.pricing?.price_details?.price ?? o.lines?.data?.[0]?.price?.id;
    const plan = configured(env).find((p) => p.price === priceId) ?? PLANS.find((p) => p.id === meta.haggs_plan);
    if (!meta.haggs_user || !plan) return null;
    if (meta.haggs_plan_version) {
      if (meta.haggs_plan_version !== PLAN_VERSION || meta.haggs_credit_grant !== String(plan.credits) || o.currency !== "usd" || o.amount_paid !== plan.monthly * 100 || !o.id || !["subscription_create","subscription_cycle"].includes(o.billing_reason ?? "")) return null;
      return {user:meta.haggs_user,bucket:"plan",cents:plan.credits,ref:o.id,kind:"renewal"};
    }
    // Existing subscriptions retain their legacy renewal mapping; never claw back balances.
    return { user: meta.haggs_user, bucket: "plan", cents: plan.id === "byok" ? 0 : creditsForPrice(plan.monthly), ref: o.id ?? event.id, kind: "renewal" };
  }
  if (event.type === "checkout.session.completed" && o.metadata?.haggs_topup && o.payment_status === "paid") {
    const meta=o.metadata;
    if(!meta.haggs_user)return null;
    if(meta.haggs_pack_version){
      if(meta.haggs_pack_version!==TOPUP_VERSION||!o.id||o.client_reference_id!==meta.haggs_user)return null;
      const pack=TOPUPS.find(t=>t.id===meta.haggs_topup);
      if(!pack||o.currency!=="usd"||o.amount_total!==pack.usd*100||meta.haggs_credit_grant!==String(pack.credits)||!meta.haggs_price_id)return null;
      return {user:meta.haggs_user,bucket:"topup",cents:pack.credits,ref:o.id,kind:"topup"};
    }
    const legacy=LEGACY_TOPUPS.find(t=>t.id===meta.haggs_topup);
    if(!legacy)return null;
    return {user:meta.haggs_user,bucket:"topup",cents:creditsForPrice(legacy.usd),ref:o.id??event.id,kind:"topup"};
  }
  return null;
}

/** What credits buy, in things people make: the outputs, not the dollars. Priced at Comfy's list: a 4-second clip about 52 cents, a picture about 7. */
export function capacity(credits: number): { clips: number; pictures: number } {
  return { clips: Math.floor(credits / 52 / 5) * 5, pictures: Math.floor(credits / 7 / 10) * 10 };
}
