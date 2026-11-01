import assert from "node:assert/strict";
import { test } from "node:test";

import robots from "./robots";

test("robots allows the whole site and points crawlers at the live sitemap", () => {
  const file = robots();
  const rule = file.rules as { userAgent: string; allow: string; disallow: string[] };
  assert.equal(rule.userAgent, "*");
  assert.equal(rule.allow, "/");
  for (const path of ["/api/", "/signin", "/signup", "/account", "/grey-preview-local", "/workflows/own-comfy"]) {
    assert.ok(rule.disallow.includes(path), `robots must disallow ${path}`);
  }
  assert.equal(file.sitemap, "https://haggsfield.studio/sitemap.xml");
});
