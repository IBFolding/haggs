import assert from "node:assert/strict";
import { test } from "node:test";

import { PLANS, checkout, configured, portal, status, type StripeLike } from "./billing";

const env = { STRIPE_API_KEY: "sk_test_x", STRIPE_PRICE_BYOK: "price_b", STRIPE_PRICE_STARTER: "price_s", STRIPE_PRICE_MID: "price_m", STRIPE_PRICE_PRO: "price_p", STRIPE_PORTAL_CONFIG_ID: "bpc_1" };
const user = { id: "u1", email: "a@b.test" };

function fakeStripe(subs: { price: string; status: string; end: number }[] = []) {
  const calls: Record<string, unknown[]> = {};
  const log = (name: string, arg: unknown) => ((calls[name] ??= []).push(arg), arg);
  const stripe: StripeLike = {
    customers: {
      search: async (q) => (log("search", q), { data: subs.length ? [{ id: "cus_1" }] : [] }),
      create: async (a) => (log("create", a), { id: "cus_new" }),
    },
    checkout: { sessions: { create: async (a) => (log("checkout", a), { url: "https://checkout.stripe.test/s" }) } },
    billingPortal: { sessions: { create: async (a) => (log("portal", a), { url: "https://billing.stripe.test/p" }) } },
    subscriptions: { list: async (a) => (log("subs", a), { data: subs.map((s) => ({ status: s.status, items: { data: [{ price: { id: s.price }, current_period_end: s.end }] } })) }) },
  };
  return { stripe, calls };
}

test("the four v1 plans are offered, and only the ones with a price are configured", () => {
  assert.deepEqual(PLANS.map((p) => [p.id, p.monthly, p.credits]), [["byok", 15, 0], ["starter", 39, 1500], ["mid", 69, 2800], ["pro", 99, 4500]]);
  assert.deepEqual(configured(env).map((p) => p.id), ["byok", "starter", "mid", "pro"]);
  assert.deepEqual(configured({ ...env, STRIPE_API_KEY: "" }), [], "no Stripe key, no checkout");
  assert.deepEqual(configured({ ...env, STRIPE_PRICE_MID: "" }).map((p) => p.id), ["byok", "starter", "pro"]);
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
  assert.deepEqual(await status(fakeStripe([{ price: "price_m", status: "active", end }]).stripe, env, user), { plan: "mid", status: "active", renews: end * 1000 });
  assert.deepEqual(await status(fakeStripe().stripe, env, user), { plan: null, status: "none", renews: null });
  assert.deepEqual(await status(fakeStripe([{ price: "price_other", status: "active", end }]).stripe, env, user), { plan: null, status: "none", renews: null }, "a price that isn't a haggs plan doesn't count");
});

test("the billing portal opens for an existing customer only", async () => {
  const { stripe, calls } = fakeStripe([{ price: "price_s", status: "active", end: 1 }]);
  assert.equal(await portal(stripe, env, user, "http://localhost:3111"), "https://billing.stripe.test/p");
  assert.equal((calls.portal![0] as { configuration?: string }).configuration, "bpc_1");
  await assert.rejects(portal(fakeStripe().stripe, env, user, "http://x"), /no subscription/);
});

import { TOPUPS, changeFor, creditsFor } from "./billing";

test("every plan and pack keeps its margin after card fees, even when all the credits are used", () => {
  const fee = (usd: number) => usd * 0.029 + 0.3;
  for (const p of PLANS.filter((x) => x.credits)) {
    const kept = p.monthly - p.credits / 100 - fee(p.monthly);
    assert.ok(kept / p.monthly >= 0.5, `${p.id} keeps ${(kept / p.monthly * 100).toFixed(0)}%`);
  }
  for (const t of TOPUPS) {
    const kept = t.usd - t.credits / 100 - fee(t.usd);
    assert.ok(kept / t.usd >= 0.25, `${t.id} keeps ${(kept / t.usd * 100).toFixed(0)}%`);
  }
  const platform = PLANS.find((p) => p.id === "byok")!;
  assert.equal(platform.credits, 0, "the platform plan includes no generation");
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
  assert.deepEqual(renewal, { user: "u1", bucket: "plan", cents: 1500, ref: "in_1", kind: "renewal" });
  const topup = changeFor({ id: "evt2", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", metadata: { haggs_user: "u1", haggs_topup: "t25" } } } }, env);
  assert.deepEqual(topup, { user: "u1", bucket: "topup", cents: 1667, ref: "cs_1", kind: "topup" });
  assert.equal(changeFor({ id: "e3", type: "checkout.session.completed", data: { object: { id: "cs_2", payment_status: "unpaid", metadata: { haggs_user: "u1", haggs_topup: "t25" } } } }, env), null);
  assert.equal(changeFor({ id: "e4", type: "customer.created", data: { object: {} } }, env), null);
  assert.equal(changeFor({ id: "e5", type: "invoice.paid", data: { object: { id: "in_2", subscription_details: { metadata: {} } } } }, env), null);
});
