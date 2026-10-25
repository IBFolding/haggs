import assert from "node:assert/strict";
import { test } from "node:test";

import { brandFromHtml, brandWords, createBrandStore } from "./brand";
import { memoryKv } from "../story/kv";

const page = `<!doctype html><html><head>
<title>Kiln &amp; Co. | Handmade mugs</title>
<meta property="og:site_name" content="Kiln &amp; Co.">
<meta name="description" content="Small-batch stoneware mugs, thrown by hand in Portland.">
<meta name="theme-color" content="#d9532b">
<meta property="og:image" content="/img/share.jpg">
<link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/touch.png">
<style>body{font-family:'DM Serif Display', Georgia, serif;color:#1a1a1a;background:#faf6f0}
a{color:#d9532b} .btn{background:#d9532b;color:#fff} h2{font-family:Inter,sans-serif;color:#d9532b}</style>
</head><body><img class="site-logo" src="/img/logo.svg" alt="Kiln"><h1>Mugs with a pulse</h1></body></html>`;

test("a page gives a name, a line about it, a logo and a palette", () => {
  const kit = brandFromHtml(page, "https://kiln.example/shop");
  assert.equal(kit.name, "Kiln & Co.");
  assert.match(kit.about, /stoneware mugs/);
  assert.equal(kit.logo, "https://kiln.example/img/logo.svg");
  assert.equal(kit.colors[0], "#d9532b");
  assert.ok(kit.colors.includes("#faf6f0") && kit.colors.length <= 5);
  assert.deepEqual(kit.fonts.slice(0, 2), ["DM Serif Display", "Inter"]);
});

test("the logo falls back to the touch icon, then the favicon, and never to nothing silly", () => {
  const bare = `<title>X</title><link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/touch.png">`;
  assert.equal(brandFromHtml(bare, "https://x.example/").logo, "https://x.example/touch.png");
  assert.equal(brandFromHtml("<title>Y</title>", "https://y.example/").logo, null);
});

test("a page with nothing in it still gives a kit named for its address", () => {
  const kit = brandFromHtml("", "https://www.plain-site.example/a/b");
  assert.equal(kit.name, "plain-site.example");
  assert.deepEqual(kit.colors, []);
});

test("white, black and grey are not the palette", () => {
  const kit = brandFromHtml(`<style>a{color:#fff;background:#000} b{color:#ccc} i{color:#3366cc}</style>`, "https://z.example/");
  assert.deepEqual(kit.colors, ["#3366cc"]);
});

test("brandWords puts the name, tone, colours and fonts into a prompt", () => {
  const w = brandWords({ name: "Kiln", colors: ["#d9532b", "#faf6f0"], fonts: ["DM Serif Display"], about: "", tone: "warm, handmade" });
  assert.match(w, /Kiln/);
  assert.match(w, /warm, handmade/);
  assert.match(w, /#d9532b/);
  assert.match(w, /DM Serif Display/);
});

test("the store keeps, lists newest first, and removes", async () => {
  const store = createBrandStore(memoryKv());
  const a = await store.save({ name: "A", url: "", logo: null, colors: [], fonts: [], about: "", tone: "" });
  const b = await store.save({ name: "B", url: "", logo: null, colors: [], fonts: [], about: "", tone: "" });
  assert.deepEqual((await store.list()).map((k) => k.name), ["B", "A"]);
  await store.remove(a.id);
  assert.deepEqual((await store.list()).map((k) => k.id), [b.id]);
  await assert.rejects(store.save({ name: " ", url: "", logo: null, colors: [], fonts: [], about: "", tone: "" }), /name/i);
});
