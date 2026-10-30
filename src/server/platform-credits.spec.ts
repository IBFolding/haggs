import assert from "node:assert/strict";
import test from "node:test";
import { creditOperations } from "./platform-credits";
import { charged, decide, type Deps } from "./platform";

const configured = { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-only" };
function deps(over: Partial<Deps>): Deps {
  return { own: undefined, user: { id: "u", email: "test@example.invalid" }, platformKey: "test-platform-key", subscribed: async () => false, spend: async () => { throw Error("Unexpected spend"); }, refund: async () => {}, ref: () => "test-ref", ...over };
}
const neverCreate = () => { throw Error("Unexpected billing client construction"); };

test("missing configuration reaches the missing-key decision without constructing a client", async () => {
  const credits = creditOperations({}, undefined, neverCreate);
  assert.deepEqual(await decide(deps({ ...credits, platformKey: undefined }), .07, "Ad", "Add a Comfy key."), { ok: false, reason: "Add a Comfy key.", needsKey: true });
});

test("lazy billing preserves signed-in platform and gated own-key checks", async () => {
  const credits = creditOperations({}, undefined, neverCreate);
  const unsigned = await decide(deps({ ...credits, user: null }), .07, "Ad", "key");
  assert.ok(!unsigned.ok && /Sign in/.test(unsigned.reason));
  let gates = 0;
  const denied = await decide(deps({ ...credits, own: "own-key", gate: async () => { gates++; return "Plan required"; } }), .07, "Ad", "key");
  assert.deepEqual(denied, { ok: false, reason: "Plan required", needsKey: true });
  assert.equal(gates, 1);
  const own = await decide(deps({ ...credits, own: "own-key", gate: async () => null }), .07, "Ad", "key");
  assert.ok(own.ok && !own.platform);
});

test("signed-in platform requests fail closed for either missing setting and release storage without submission", async () => {
  for (const env of [{}, { NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL }, { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }]) {
    let submitted = 0, released = 0;
    await assert.rejects(async () => {
      const access = await decide(deps({ ...creditOperations(env, "test-token", neverCreate), prepareStorage: async () => ({ id: "hold", userId: "u", maxBytes: 100, saved: false }), releaseStorage: async () => { released++; } }), .07, "Ad", "key");
      if (access.ok) await charged(access, async () => { submitted++; return { ok: true }; });
    }, /Credit billing is not configured/);
    assert.equal(submitted, 0);
    assert.equal(released, 1);
  }
});

test("only an explicit successful debit permits provider submission; false, unexpected data and RPC errors do not", async () => {
  for (const response of [{ data: false, error: null }, { data: "true", error: null }, { data: true, error: { message: "denied" } }, { data: true, error: null }]) {
    const events: string[] = [];
    let created = 0;
    const credits = creditOperations(configured, "test-token", (url, key, token) => {
      created++; assert.equal(url, configured.NEXT_PUBLIC_SUPABASE_URL); assert.equal(key, configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY); assert.equal(token, "test-token");
      return { rpc: async (name, args) => { events.push(name); assert.deepEqual(args, { cents: 7, memo: "Ad", ref: "test-ref" }); return response; } };
    });
    const run = async () => {
      const access = await decide(deps(credits), .0686, "Ad", "key");
      if (access.ok) await charged(access, async () => { events.push("submit"); return { ok: true }; });
    };
    if (response.error) await assert.rejects(run(), /Credits couldn't be checked/); else await run();
    assert.equal(created, 1);
    assert.deepEqual(events, response.data === true && !response.error ? ["credits_spend", "submit"] : ["credits_spend"]);
  }
});

test("one request shares its authorized client across debit, refund and balance; failed balance is not credit", async () => {
  const calls: string[] = []; let clients = 0;
  const credits = creditOperations(configured, "test-token", () => { clients++; return { rpc: async name => { calls.push(name); return { data: name === "credits_balance" ? [{ plan: 100, topup: 100 }] : true, error: name === "credits_balance" ? { message: "denied" } : null }; } }; });
  assert.equal(await credits.spend(7, "Ad", "ref"), true);
  await credits.refund("ref");
  assert.equal(await credits.hasCredits(), false);
  assert.equal(clients, 1);
  assert.deepEqual(calls, ["credits_spend", "credits_refund", "credits_balance"]);
});
