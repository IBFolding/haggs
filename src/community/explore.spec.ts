import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { cantShare, exploreMessage, isStoreUrl, profileRow, shareRow, toPost, toPublic } from "./explore";

const STORE = "https://abc123.public.blob.vercel-storage.com/haggs/u-1/results/a.mp4";

test("only files in haggs's own store can be shared", () => {
  assert.equal(isStoreUrl(STORE), true);
  for (const bad of ["http://abc.public.blob.vercel-storage.com/x", "https://evil.test/abc.public.blob.vercel-storage.com/x", "/api/local/x.mp4", "data:image/png;base64,AA", "javascript:alert(1)"]) assert.equal(isStoreUrl(bad), false, bad);
});

test("a share is refused with a reason: sounds, local files, or no handle yet", () => {
  assert.match(cantShare({ url: STORE, kind: "audio" }, { handle: "kilnco" })!, /pictures and clips/);
  assert.match(cantShare({ url: "/api/local/x.png", kind: "image" }, { handle: "kilnco" })!, /live site/);
  assert.match(cantShare({ url: STORE, kind: "video" }, null)!, /handle/);
  assert.equal(cantShare({ url: STORE, kind: "video" }, { handle: "kilnco" }), null);
});

test("the shared row carries the words, the model and the price in credits, rounded up", () => {
  const row = shareRow({ url: STORE, kind: "video", prompt: "  a mug  ", modelName: "Wan 2.2", usd: 0.0686 }, "u-1");
  assert.deepEqual(row, { user_id: "u-1", kind: "video", url: STORE, prompt: "a mug", model: "Wan 2.2", credits: 7 });
  assert.equal(shareRow({ url: STORE, kind: "image", prompt: "", modelName: "", usd: null }, "u-1").credits, null);
});

test("what the public sees: links and pictures are checked again on the way out", () => {
  const p = toPublic({ user_id: "u-1", handle: "kilnco", name: "Kiln", picture: "https://evil.test/x.png", bio: "", links: { instagram: "@kilnco", x: "javascript:alert(1)", website: "kilnandco.com" } });
  assert.equal(p.picture, null);
  assert.deepEqual(p.links, { instagram: "https://instagram.com/kilnco", website: "https://kilnandco.com" });
  assert.equal(toPost({ id: "1", user_id: "u-1", kind: "image", url: "https://evil.test/x.png" }), null);
  const post = toPost({ id: "1", user_id: "u-1", kind: "video", url: STORE, prompt: "p", model: "Wan", credits: 52, created_at: "2026-10-28T10:00:00Z", profiles: { handle: "kilnco", name: "Kiln", picture: null, bio: "", links: {} } })!;
  assert.equal(post.by?.handle, "kilnco");
  assert.equal(post.credits, 52);
});

test("a profile is public only with a handle, and a picture only from the store", () => {
  assert.equal(profileRow({ name: "Kiln", handle: "", picture: null, bio: "", links: {} }, "u-1"), null);
  const row = profileRow({ name: "Kiln", handle: "@KilnCo", picture: "/api/local/me.png", bio: "pots", links: {} }, "u-1")!;
  assert.equal(row.handle, "kilnco");
  assert.equal(row.picture, null);
});

test("database refusals become sentences", () => {
  assert.equal(exploreMessage({ code: "42P01", message: 'relation "public.posts" does not exist' }, "x"), "Explore isn't switched on yet.");
  assert.equal(exploreMessage({ code: "23505", message: 'duplicate key value violates unique constraint "profiles_handle_key"' }, "x"), "That handle is taken. Try another.");
  assert.equal(exploreMessage({ code: "23505", message: "posts_once" }, "x"), "You've already shared this.");
  assert.equal(exploreMessage(null, "x"), null);
});

test("the migration lets anyone read, only the owner write, and only store links in", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261028000000_explore.sql"), "utf8");
  for (const t of ["profiles", "posts"]) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  assert.match(sql, /for select using \(true\)/);
  assert.equal((sql.match(/auth\.uid\(\) = user_id/g) ?? []).length >= 6, true);
  assert.match(sql, /url text not null check \(url ~ '\^https:\/\/\[a-z0-9-\]\+\\\.public\\\.blob\\\.vercel-storage\\\.com\/'\)/);
});
