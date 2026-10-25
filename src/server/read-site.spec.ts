import assert from "node:assert/strict";
import { test } from "node:test";

import { readSite } from "./read-site";

const page = (body: string, type = "text/html; charset=utf-8", status = 200) => async () => new Response(body, { status, headers: { "content-type": type } });

test("a normal page becomes a brand kit", async () => {
  const r = await readSite("kiln.example", page(`<title>Kiln</title><meta name="theme-color" content="#d9532b">`));
  assert.ok(r.ok);
  assert.equal(r.ok && r.kit.name, "Kiln");
  assert.equal(r.ok && r.kit.url, "https://kiln.example/");
});

test("addresses on this machine or a private network are never fetched", async () => {
  let called = false;
  const spy = async () => { called = true; return new Response(""); };
  for (const bad of ["http://localhost:3000", "https://127.0.0.1/", "https://192.168.1.4/x", "https://10.0.0.2", "file:///etc/passwd", "https://[::1]/"]) {
    const r = await readSite(bad, spy);
    assert.equal(r.ok, false, bad);
  }
  assert.equal(called, false);
});

test("something that isn't a web page, an error, or a huge page gives a plain reason", async () => {
  assert.equal((await readSite("a.example", page("{}", "application/json"))).ok, false);
  const missing = await readSite("a.example", page("no", "text/html", 404));
  assert.ok(!missing.ok && /couldn't/i.test(missing.reason));
  const huge = await readSite("a.example", page("x".repeat(3_000_000)));
  assert.ok(huge.ok, "a huge page is read up to a limit, not refused");
});

test("a site that fails to answer says so", async () => {
  const r = await readSite("a.example", async () => { throw new Error("boom"); });
  assert.ok(!r.ok && /couldn't/i.test(r.reason));
});

test("nothing typed is asked for again", async () => {
  const r = await readSite("   ", page(""));
  assert.ok(!r.ok && /address/i.test(r.reason));
});

test("colours and fonts in a linked stylesheet count too, and a stylesheet on a private address is skipped", async () => {
  const seen: string[] = [];
  const fetcher = async (url: string) => {
    seen.push(url);
    if (url.endsWith("/app.css")) return new Response("a{color:#635bff} b{background:#635bff} body{font-family:'Sohne',sans-serif}", { headers: { "content-type": "text/css" } });
    return new Response(`<title>S</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="https://127.0.0.1/evil.css">`, { headers: { "content-type": "text/html" } });
  };
  const r = await readSite("s.example", fetcher);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.kit.colors, ["#635bff"]);
  assert.deepEqual(r.ok && r.kit.fonts, ["Sohne"]);
  assert.ok(!seen.some((u) => u.includes("127.0.0.1")));
});
