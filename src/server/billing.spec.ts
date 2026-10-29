import assert from "node:assert/strict";
import { test } from "node:test";

import { PLANS, checkout, configured, customerMessage, portal, status, type StripeLike } from "./billing";

const env = { STRIPE_API_KEY: "sk_test_x", STRIPE_PRICE_BYOK: "price_b", STRIPE_PRICE_STARTER: "price_s", STRIPE_PRICE_MID: "price_m", STRIPE_PRICE_PRO: "price_p", STRIPE_PRICE_STARTER_FIXED_2026: "price_s", STRIPE_PRICE_MID_FIXED_2026: "price_m", STRIPE_PRICE_PRO_FIXED_2026: "price_p", STRIPE_PORTAL_CONFIG_ID: "bpc_1" };
const user = { id: "u1", email: "a@b.test" };

function fakeStripe(subs: { price: string; status: string; end: number; ending?: boolean }[] = []) {
  const calls: Record<string, unknown[]> = {};
  const log = (name: string, arg: unknown) => ((calls[name] ??= []).push(arg), arg);
  const stripe: StripeLike = {
    prices: { retrieve: async (id) => ({ active: true, currency: "usd", unit_amount: ({price_b:1500,price_s:3900,price_m:6900,price_p:9900} as Record<string,number>)[id] ?? 0, recurring: {interval:"month",interval_count:1} }) },
    customers: {
      search: async (q) => (log("search", q), { data: subs.length ? [{ id: "cus_1" }] : [] }),
      create: async (a) => (log("create", a), { id: "cus_new" }),
    },
    checkout: { sessions: { create: async (a) => (log("checkout", a), { url: "https://checkout.stripe.test/s" }) } },
    billingPortal: { sessions: { create: async (a) => (log("portal", a), { url: "https://billing.stripe.test/p" }) } },
    subscriptions: { list: async (a) => (log("subs", a), { data: subs.map((s) => ({ status: s.status, ...(s.ending ? { cancel_at_period_end: true } : {}), items: { data: [{ price: { id: s.price }, current_period_end: s.end }] } })) }) },
  };
  return { stripe, calls };
}

test("the four v1 plans are offered, and only the ones with a price are configured", () => {
  assert.deepEqual(PLANS.map((p) => [p.id, p.monthly, p.credits]), [["byok", 15, 0], ["starter", 39, 2400], ["mid", 69, 4400], ["pro", 99, 6400]]);
  assert.deepEqual(configured(env).map((p) => p.id), ["byok", "starter", "mid", "pro"]);
  assert.deepEqual(configured({ ...env, STRIPE_API_KEY: "" }), [], "no Stripe key, no checkout");
  assert.deepEqual(configured({ ...env, STRIPE_PRICE_MID_FIXED_2026: "" }).map((p) => p.id), ["byok", "starter", "pro"]);
});

test("checkout makes a subscription session for the signed-in person, tied to their account", async () => {
  const { stripe, calls } = fakeStripe();
  const url = await checkout(stripe, env, "starter", user, "http://localhost:3111");
  assert.equal(url, "https://checkout.stripe.test/s");
  const session = calls.checkout![0] as Record<string, unknown>;
  assert.equal(session.mode, "subscription");
  assert.deepEqual(session.line_items, [{ price: "price_s", quantity: 1 }]);
  assert.equal(session.customer, "cus_new");
  assert.equal(session.client_reference_id, "u1");
  assert.match(String(session.success_url), /^http:\/\/localhost:3111\/account\?checkout=done/);
  assert.deepEqual((calls.create![0] as { metadata: unknown }).metadata, { haggs_user: "u1" });
  await assert.rejects(checkout(stripe, env, "nope", user, "http://x"), /plan/);
});

test("status reads the live subscription from Stripe; no customer means no plan", async () => {
  const end = Math.floor(Date.now() / 1000) + 86400 * 20;
  assert.deepEqual(await status(fakeStripe([{ price: "price_m", status: "active", end }]).stripe, env, user), { plan: "mid", credits: 4400, status: "active", renews: end * 1000 });
  assert.deepEqual(await status(fakeStripe([{ price: "price_m", status: "active", end, ending: true }]).stripe, env, user), { plan: "mid", credits: 4400, status: "active", renews: end * 1000, ending: true }, "a cancelled plan says it ends instead of renewing");
  assert.deepEqual(await status(fakeStripe().stripe, env, user), { plan: null, credits: 0, status: "none", renews: null });
  assert.deepEqual(await status(fakeStripe([{ price: "price_other", status: "active", end }]).stripe, env, user), { plan: null, credits: 0, status: "none", renews: null }, "a price that isn't a haggs plan doesn't count");
});

test("the billing portal opens for an existing customer only", async () => {
  const { stripe, calls } = fakeStripe([{ price: "price_s", status: "active", end: 1 }]);
  assert.equal(await portal(stripe, env, user, "http://localhost:3111"), "https://billing.stripe.test/p");
  assert.equal((calls.portal![0] as { configuration?: string }).configuration, "bpc_1");
  await assert.rejects(portal(fakeStripe().stripe, env, user, "http://x"), /no subscription/);
});

import { TOPUPS, capacity, changeFor, creditsFor } from "./billing";

process.env.HAGGS_PLATFORM_CUT = "25"; // a test value, not the real cut

test("the share we keep comes from the environment; the rest of every paid plan and pack is the customer's, and the platform plan includes nothing", () => {
  assert.deepEqual(PLANS.map(p=>p.credits),[0,2400,4400,6400]);
  assert.deepEqual(TOPUPS.map(t=>[t.usd,t.credits]), [[15,1200],[30,2400],[50,4200],[75,6500],[100,8500]]);
  assert.equal(PLANS.find((p) => p.id === "byok")!.credits, 0);
});

test("customers see what credits make, never what they cost or what we keep", () => {
  const { clips, pictures } = capacity(2925);
  assert.deepEqual([clips, pictures], [55, 410]);
  for (const p of PLANS) assert.doesNotMatch(p.blurb, /\$\d|%|credit|margin/i, `${p.id}: the blurb shows no figures`);
});

test("a run is worth its price in cents, rounded up", () => {
  assert.equal(creditsFor(0.0686), 7);
  assert.equal(creditsFor(0.52), 52);
  assert.equal(creditsFor(0.04), 4);
  assert.equal(creditsFor(0), 1);
});

test("a paid invoice resets the person's monthly credits; a paid top-up adds a pack; nothing else does", () => {
  const env = { STRIPE_API_KEY: "k", STRIPE_PRICE_STARTER: "price_s" };
  const renewal = changeFor({ id: "evt1", type: "invoice.paid", data: { object: { id: "in_1", lines: { data: [{ price: { id: "price_s" } }] }, subscription_details: { metadata: { haggs_user: "u1", haggs_plan: "starter" } } } } }, env);
  assert.deepEqual(renewal, { user: "u1", bucket: "plan", cents: 2925, ref: "in_1", kind: "renewal" });
  const topup = changeFor({ id: "evt2", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", metadata: { haggs_user: "u1", haggs_topup: "t25" } } } }, env);
  assert.deepEqual(topup, { user: "u1", bucket: "topup", cents: 1875, ref: "cs_1", kind: "topup" });
  assert.equal(changeFor({ id: "e3", type: "checkout.session.completed", data: { object: { id: "cs_2", payment_status: "unpaid", metadata: { haggs_user: "u1", haggs_topup: "t25" } } } }, env), null);
  assert.equal(changeFor({ id: "e4", type: "customer.created", data: { object: {} } }, env), null);
  assert.equal(changeFor({ id: "e5", type: "invoice.paid", data: { object: { id: "in_2", subscription_details: { metadata: {} } } } }, env), null);
});

test("fixed subscription allowances are independent of the legacy cut", () => {
  const was = process.env.HAGGS_PLATFORM_CUT;
  delete process.env.HAGGS_PLATFORM_CUT;
  assert.deepEqual(PLANS.map((p) => p.credits), [0, 2400, 4400, 6400]);
  process.env.HAGGS_PLATFORM_CUT = "150";
  assert.equal(PLANS[1]!.credits, 2400, "legacy cut cannot change fixed allowance");
  process.env.HAGGS_PLATFORM_CUT = was ?? "25";
});

import { TOPUP_VERSION, topupCheckout, topupsConfigured } from './billing';
import { readFileSync } from 'node:fs';
test('fixed packs grant exact allowances independent of the subscription percentage',()=>{
 assert.deepEqual(TOPUPS.map(p=>[p.usd,p.credits,p.retainedUsd]),[[15,1200,3],[30,2400,6],[50,4200,8],[75,6500,10],[100,8500,15]]);
 assert.deepEqual(topupsConfigured({...env,STRIPE_PRICE_TOPUP_50:'legacy'}),[]);
});
test('new pack checkout validates USD one-time price and snapshots server-owned entitlement',async()=>{
 const {stripe,calls}=fakeStripe();stripe.prices={retrieve:async()=>({active:true,currency:'usd',unit_amount:1500,recurring:null})};
 const e={...env,STRIPE_PRICE_TOPUP_FIXED_15:'price_fixed15'};
 await topupCheckout(stripe,e,'fixed15',user,'http://localhost:3112');
 const s=calls.checkout![0] as {metadata:Record<string,string>;allow_promotion_codes:boolean;line_items:unknown};
 assert.equal(s.metadata.haggs_credit_grant,'1200');assert.equal(s.metadata.haggs_pack_version,TOPUP_VERSION);assert.equal(s.allow_promotion_codes,false);
 assert.deepEqual(s.line_items,[{price:'price_fixed15',quantity:1}]);
 stripe.prices={retrieve:async()=>({active:true,currency:'usd',unit_amount:1000})};
 await assert.rejects(topupCheckout(stripe,e,'fixed15',user,'http://localhost:3112'),/not configured correctly/);
 assert.equal(calls.checkout!.length,1);
 await assert.rejects(topupCheckout(stripe,e,'t10',user,'http://localhost:3112'),/can't be bought/);
});
test('fixed fulfillment rejects discounts, wrong currency, forged grants and unknown versions',()=>{
 for(const pack of TOPUPS){
  const o={id:'cs_fixed',payment_status:'paid',amount_total:pack.usd*100,currency:'usd',client_reference_id:'u1',metadata:{haggs_user:'u1',haggs_topup:pack.id,haggs_pack_version:TOPUP_VERSION,haggs_credit_grant:String(pack.credits),haggs_price_id:'price_fixed'}};
  const event=(object:Record<string,unknown>,id='evt1')=>({id,type:'checkout.session.completed',data:{object}});
  const expected={user:'u1',bucket:'topup',cents:pack.credits,ref:'cs_fixed',kind:'topup'};
  assert.deepEqual(changeFor(event(o),{}),expected);
  assert.deepEqual(changeFor(event(o,'evt_retry'),{}),expected,'same session uses same ledger idempotency ref');
  for(const patch of [{amount_total:pack.usd*100-1},{currency:'eur'},{payment_status:'unpaid'},{client_reference_id:'other'},{metadata:{...o.metadata,haggs_credit_grant:'999999'}},{metadata:{...o.metadata,haggs_pack_version:'unknown'}},{metadata:{...o.metadata,haggs_pack_version:undefined}}])assert.equal(changeFor(event({...o,...patch}),{}),null);
 }
});
test('fulfillment ledger enforces one grant per user/kind/bucket/session',()=>{
 const sql=readFileSync(new URL('../../supabase/migrations/20261023000100_credits.sql',import.meta.url),'utf8');
 assert.match(sql,/unique index[^;]+\(user_id, kind, bucket, ref\)/);
 assert.match(sql,/values \(target, 'topup', cents, 'topup', ref\) on conflict do nothing/);
});

 test("subscription checkout rejects wrong amount, currency, period and inactive prices before creating a customer", async()=>{
  for (const patch of [{unit_amount:390},{currency:'eur'},{active:false},{recurring:null},{recurring:{interval:'year',interval_count:1}},{recurring:{interval:'month',interval_count:2}}]) {
   const {stripe,calls}=fakeStripe(); stripe.prices={retrieve:async()=>({active:true,currency:'usd',unit_amount:3900,recurring:{interval:'month',interval_count:1},...patch})};
   await assert.rejects(checkout(stripe,env,'starter',user,'http://localhost:3112'),/not configured correctly/);
   assert.equal(calls.create,undefined); assert.equal(calls.checkout,undefined);
  }
 });

test("a key that cannot read prices still checks out when the session's own total is right, and is cancelled when it is not", async () => {
  const denied = async () => { throw new Error("Permission denied. The provided key 'rk_live_secret' does not have the required permissions"); };
  const expired: string[] = [];
  const build = (total: number | null, currency = "usd") => { const f = fakeStripe(); f.stripe.prices = { retrieve: denied }; f.stripe.checkout.sessions = { create: async () => ({ id: "cs_1", url: "https://checkout.stripe.test/s", amount_total: total, currency }), expire: async (id: string) => { expired.push(id); } }; return f; };
  assert.equal(await checkout(build(3900).stripe, env, "starter", user, "http://x"), "https://checkout.stripe.test/s");
  const topupEnv = { ...env, STRIPE_PRICE_TOPUP_FIXED_30: "price_t30" };
  assert.equal(await topupCheckout(build(3000).stripe, topupEnv, "fixed30", user, "http://x"), "https://checkout.stripe.test/s");
  for (const [total, currency] of [[3800, "usd"], [3900, "eur"], [null, "usd"]] as const) {
    await assert.rejects(checkout(build(total, currency).stripe, env, "starter", user, "http://x"), /not configured correctly/);
  }
  assert.deepEqual(expired, ["cs_1", "cs_1", "cs_1"]);
});
test("customers never see a Stripe error, only our own refusals", () => {
  assert.equal(customerMessage(new Error("Permission denied. The provided key 'rk_live_secret'"), "Try again."), "Try again.");
});

test("status distinguishes legacy renewal allowance from fixed-price allowance", async () => {
  const previous = process.env.HAGGS_PLATFORM_CUT;
  process.env.HAGGS_PLATFORM_CUT = "20";
  try {
    const prices = { ...env, STRIPE_PRICE_STARTER: "legacy", STRIPE_PRICE_STARTER_FIXED_2026: "fixed" };
    const legacy = await status(fakeStripe([{ price: "legacy", status: "active", end: 100 }]).stripe, prices, user);
    const fixed = await status(fakeStripe([{ price: "fixed", status: "active", end: 100 }]).stripe, prices, user);
    assert.equal(legacy.credits, 3120);
    assert.equal(fixed.credits, 2400);
    assert.equal((await status(fakeStripe([{ price: "price_b", status: "active", end: 100 }]).stripe, prices, user)).credits, 0);
  } finally { if (previous === undefined) delete process.env.HAGGS_PLATFORM_CUT; else process.env.HAGGS_PLATFORM_CUT = previous; }
});
