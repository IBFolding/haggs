import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanCredits, cleanReference, isJobKind, isUuid, partnerKeyOk, sendToStoryPop, signBody } from "./storypop";

const KEY = "k".repeat(40);

test("the partner key is checked exactly, and a short or missing key never opens the door", () => {
  assert.equal(partnerKeyOk(`Bearer ${KEY}`, KEY), true);
  assert.equal(partnerKeyOk(`Bearer ${KEY}x`, KEY), false);
  assert.equal(partnerKeyOk(KEY, KEY), false, "needs the Bearer word");
  assert.equal(partnerKeyOk(null, KEY), false);
  assert.equal(partnerKeyOk("Bearer short", "short"), false, "a key under 24 characters is refused outright");
  assert.equal(partnerKeyOk(`Bearer ${KEY}`, undefined), false);
});

test("inputs are cleaned before they reach the database", () => {
  assert.equal(isUuid("0b6f2d7a-8a8a-4c1c-9d0e-123456789abc"), true);
  assert.equal(isUuid("u-1; drop table"), false);
  assert.equal(cleanReference("remix_ab12:cd"), "remix_ab12:cd");
  assert.equal(cleanReference("has space"), null);
  assert.equal(cleanReference("x".repeat(101)), null);
  assert.equal(cleanCredits(1200), 1200);
  assert.equal(cleanCredits(0), null);
  assert.equal(cleanCredits(1.5), null);
  assert.equal(cleanCredits(1_000_000), null);
  assert.equal(isJobKind("remix"), true);
  assert.equal(isJobKind("hack"), false);
});

test("events to StoryPop are signed so StoryPop can verify them", async () => {
  const seen: { url: string; sig: string; body: string }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, sig: (init.headers as Record<string, string>)["x-haggs-signature"] ?? "", body: String(init.body) });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const env = { STORYPOP_WEBHOOK_URL: "https://storypop.test/api/webhooks/haggs", STORYPOP_WEBHOOK_SECRET: "s3cret-s3cret-s3cret" };

  assert.equal(await sendToStoryPop({ type: "credits.updated", haggsUserId: "u1", creditsBalance: 5 }, env, fetcher), true);
  const first = seen[0]!;
  assert.equal(first.url, env.STORYPOP_WEBHOOK_URL);
  assert.equal(first.sig, signBody(first.body, env.STORYPOP_WEBHOOK_SECRET));
  assert.equal(JSON.parse(first.body).creditsBalance, 5);

  assert.equal(await sendToStoryPop({ type: "credits.updated" }, {}, fetcher), false, "not configured: nothing sent");
  assert.equal(await sendToStoryPop({ type: "credits.updated" }, env, (async () => { throw new Error("down"); }) as unknown as typeof fetch), false, "unreachable: no crash");
});
