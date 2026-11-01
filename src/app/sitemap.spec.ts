import assert from "node:assert/strict";
import { test } from "node:test";

import { SITE, sitemapPaths } from "./sitemap";

test("the sitemap lists the public home and studio pages", () => {
  const paths = new Set(sitemapPaths());
  for (const p of ["/", "/photos", "/video", "/workflows", "/pricing", "/terms", "/privacy", "/explore", "/academy", "/playable", "/docs"]) {
    assert.ok(paths.has(p), `sitemap is missing ${p}`);
  }
});

test("the sitemap includes every bundled workflow, lesson and featured game", () => {
  const paths = new Set(sitemapPaths());
  for (const n of ["haggs_ltx_repair_cut", "haggs_ltx_shot_handles", "haggs_ltx_continuity_brief", "haggs_ltx_action_on_beat"]) {
    assert.ok(paths.has(`/workflows/${n}`), `sitemap is missing /workflows/${n}`);
  }
  assert.ok(paths.has("/workflows/haggs_scene_forge"));
  assert.ok(paths.has("/workflows/community"));
  for (const p of ["/academy/first-video", "/academy/learn/first-video", "/playable/sprout-swarm"]) {
    assert.ok(paths.has(p), `sitemap is missing ${p}`);
  }
});

test("the sitemap keeps out private, user and flag-gated pages", () => {
  const paths = new Set(sitemapPaths());
  for (const p of ["/api/", "/signin", "/signup", "/account", "/workflows/own-comfy", "/auth/callback", "/grey-preview-local"]) {
    assert.ok(!paths.has(p), `${p} must not be in the sitemap`);
  }
  assert.ok(![...paths].some((p) => p.startsWith("/u/") || p.startsWith("/board/")), "user and board ids must not be in the sitemap");
});

test("every sitemap entry is a real absolute URL on the live host", async () => {
  const { default: sitemap } = await import("./sitemap");
  const urls = sitemap().map((u) => u.url);
  assert.ok(urls.length >= 20, `expected a full list, got ${urls.length}`);
  for (const url of urls) {
    assert.ok(url === SITE || url.startsWith(`${SITE}/`), `not a live-host URL: ${url}`);
    assert.ok(url === SITE || !url.endsWith("/"), `no trailing slashes except the home page: ${url}`);
  }
  assert.ok(new Set(urls).size === urls.length, "sitemap has duplicate URLs");
});
