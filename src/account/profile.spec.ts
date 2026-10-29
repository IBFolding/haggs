import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanHandle, cleanProfile, readProfile, socialUrl, websiteUrl } from "./profile";

test("a handle loses its @, spaces and odd characters, and must be at least two long", () => {
  assert.equal(cleanHandle("@Mara Keeper!"), "marakeeper");
  assert.equal(cleanHandle("dev.night_shift"), "dev.night_shift");
  assert.equal(cleanHandle("@"), "");
  assert.equal(cleanHandle("a"), "");
});

test("a social link comes from @name, a bare name or a full link on that same site", () => {
  assert.equal(socialUrl("instagram", "@kilnco"), "https://instagram.com/kilnco");
  assert.equal(socialUrl("tiktok", "kilnco"), "https://tiktok.com/@kilnco");
  assert.equal(socialUrl("youtube", "https://www.youtube.com/@kilnco/"), "https://youtube.com/@kilnco");
  assert.equal(socialUrl("x", "twitter.com/kilnco"), "https://twitter.com/kilnco");
  assert.equal(socialUrl("instagram", "https://evil.example/instagram.com/kilnco"), null, "another site is refused");
  assert.equal(socialUrl("x", "   "), null);
});

test("a website is https, with or without a scheme typed; anything else is refused", () => {
  assert.equal(websiteUrl("kilnandco.com"), "https://kilnandco.com");
  assert.equal(websiteUrl("http://kilnandco.com/shop/"), "https://kilnandco.com/shop");
  assert.equal(websiteUrl("javascript:alert(1)"), null);
  assert.equal(websiteUrl("localhost"), null);
});

test("a kept profile is trimmed and limited, and bad links are dropped", () => {
  const p = cleanProfile({ name: "  Kiln & Co.  ", handle: "@Kiln Co", picture: "javascript:x", bio: "x".repeat(300), links: { instagram: "@kilnco", x: "https://example.com/kilnco", website: "kilnandco.com" } });
  assert.equal(p.name, "Kiln & Co.");
  assert.equal(p.handle, "kilnco");
  assert.equal(p.picture, null);
  assert.equal(p.bio.length, 200);
  assert.deepEqual(p.links, { instagram: "https://instagram.com/kilnco", website: "https://kilnandco.com" });
});

test("a profile read back is safe with nothing stored", () => {
  assert.deepEqual(readProfile(undefined), { name: "", handle: "", picture: null, bio: "", links: {} });
  assert.equal(readProfile({ name: 4 }).name, "");
});
