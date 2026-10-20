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
  assert.deepEqual(PLANS.map((p) => [p.id, p.monthly, p.credits]), [["byok", 15, 0], ["starter", 25, 500], ["mid", 49, 1000], ["pro", 99, 3000]]);
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
