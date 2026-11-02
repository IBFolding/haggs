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

import { cleanPublicUrl, extractBrandKit, fetchBrandKit, isPrivateAddress } from "./brandKit";
import { AD_TEMPLATES, templateById } from "./adTemplates";

test("brand kit: only plain public websites are ever fetched", () => {
  assert.ok(cleanPublicUrl("acme.com"));
  assert.ok(cleanPublicUrl("https://www.acme.com/shop"));
  for (const bad of ["http://localhost:3000", "https://127.0.0.1", "http://10.0.0.5", "http://192.168.1.1", "http://169.254.169.254/latest", "ftp://acme.com", "https://user:pw@acme.com", "javascript:alert(1)", "intranet", "http://printer.local", 42, ""]) {
    assert.equal(cleanPublicUrl(bad), null, String(bad));
  }
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("::ffff:10.1.2.3"), true);
  assert.equal(isPrivateAddress("fd00::1"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});

test("brand kit: pulls a name, colours and logo from page HTML", () => {
  const html = '<title>Acme Coffee | Fresh beans</title><meta property="og:description" content="Premium small-batch coffee"><meta name="theme-color" content="#FF2D75"><meta property="og:image" content="/logo.png"><style>a{color:#165dff}</style>';
  const kit = extractBrandKit(html, new URL("https://www.acme.com/"));
  assert.equal(kit.name, "Acme Coffee");
  assert.equal(kit.description, "Premium small-batch coffee");
  assert.deepEqual(kit.colors.slice(0, 2), ["#ff2d75", "#165dff"]);
  assert.equal(kit.logo_url, "https://www.acme.com/logo.png");
  assert.equal(kit.tone, "premium");
});

test("brand kit: a name that resolves to a private address is refused, and redirects are re-checked", async () => {
  const page = async () => new Response("<title>x</title>");
  assert.equal(await fetchBrandKit("https://evil.example", page, async () => ["10.0.0.9"]), null);
  assert.ok(await fetchBrandKit("https://acme.com", page, async () => ["93.184.216.34"]));
  const redirect = async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
  assert.equal(await fetchBrandKit("https://acme.com", redirect, async () => ["93.184.216.34"]), null);
});

test("ad templates: known ids only", () => {
  assert.equal(templateById("product-hero")?.label, "Product hero shot");
  assert.equal(templateById("nope"), undefined);
  assert.ok(AD_TEMPLATES.every((t) => t.est_credits >= 0));
  assert.equal(isJobKind("ad"), true);
});
