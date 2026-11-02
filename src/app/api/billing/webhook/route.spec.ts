import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { POST } from "./route";

test("signed delayed-payment webhook fulfills only after payment and retries database failures", async () => {
  const config = { STRIPE_API_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture", HAGGS_WEBHOOK_SECRET: "fixture", NEXT_PUBLIC_SUPABASE_URL: "https://billing-fixture.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture" };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  Object.assign(process.env, config);
  const originalFetch = globalThis.fetch;
  const grants: unknown[] = [];
  let databaseFails = false;
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://billing-fixture.invalid/rest/v1/rpc/credits_grant");
    grants.push(JSON.parse(String(init?.body)));
    return databaseFails ? Response.json({ message: "fixture failure" }, { status: 500 }) : Response.json(null);
  }) as typeof fetch;
  const object = { id: "cs_fixture", payment_status: "paid", amount_total: 1500, currency: "usd", client_reference_id: "u1", metadata: { haggs_user: "u1", haggs_topup: "fixed15", haggs_pack_version: "fixed-2026-10", haggs_credit_grant: "1200", haggs_price_id: "price_fixture" } };
  async function send(type: string, patch = {}, signature = true) {
    const body = JSON.stringify({ id: `evt_${type}`, type, data: { object: { ...object, ...patch } } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: config.STRIPE_WEBHOOK_SECRET });
    return POST(new Request("https://haggs.test/api/billing/webhook", { method: "POST", body, headers: { "stripe-signature": signature ? header : "invalid" } }));
  }
  try {
    assert.equal((await send("checkout.session.completed", {}, false)).status, 400);
    assert.equal((await send("checkout.session.completed", { payment_status: "unpaid" })).status, 200);
    assert.equal((await send("checkout.session.async_payment_failed", { payment_status: "unpaid" })).status, 200);
    assert.equal(grants.length, 0);
    assert.equal((await send("checkout.session.async_payment_succeeded")).status, 200);
    assert.deepEqual(grants, [{ target: "u1", cents: 1200, ref: "cs_fixture", secret: "fixture" }]);
    assert.equal((await send("checkout.session.completed")).status, 200);
    assert.deepEqual(grants[1], grants[0], "both delivery types share the SQL idempotency reference");
    assert.equal((await send("checkout.session.async_payment_succeeded", { amount_total: 1 })).status, 500);
    assert.equal(grants.length, 2, "invalid paid entitlements do not grant");
    databaseFails = true;
    assert.equal((await send("checkout.session.async_payment_succeeded")).status, 500);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
