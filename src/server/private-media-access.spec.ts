import assert from "node:assert/strict";
import test from "node:test";
import { privateMediaResponse, type PrivateMediaAccess } from "./private-media-access";
import { privateMediaPath, privateMediaUrl } from "./private-media-url";
const owner = "11111111-1111-4111-8111-111111111111";
const url = `/api/media/haggs/u-${owner}/results/synthetic.mp4`;
function fixture(user: string | null) {
  let shared = false;
  const reads: { path: string; range: string | null }[] = [];
  const io: PrivateMediaAccess = {
    user: async () => user ? { id: user } : null,
    published: async (location, id) => shared && location === url && id === owner,
    read: async (path, range) => { reads.push({ path, range }); return new Response("synthetic", { status: range ? 206 : 200, headers: { "Content-Type": "video/mp4", ...(range ? { "Content-Range": "bytes 0-8/9" } : {}), "Cache-Control": "public,max-age=9999", "Location": "https://secret.invalid", "Set-Cookie": "secret" } }); },
  };
  return { io, reads, share: () => { shared = true; }, revoke: () => { shared = false; } };
}
test("private media defaults deny anonymous and other users before storage is read", async () => {
  for (const user of [null, "22222222-2222-4222-8222-222222222222"]) {
    const f = fixture(user); const response = await privateMediaResponse(url, null, f.io);
    assert.equal(response.status, 404); assert.equal(f.reads.length, 0); assert.match(response.headers.get("cache-control")!, /no-store/);
  }
});
test("owner playback streams bytes and range requests without leaking storage headers", async () => {
  const f = fixture(owner);
  for (const range of [null, "bytes=0-8"]) {
    const response = await privateMediaResponse(url, range, f.io);
    assert.equal(response.status, range ? 206 : 200); assert.equal(await response.text(), "synthetic");
    assert.equal(response.headers.get("location"), null); assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
  assert.deepEqual(f.reads.map(r => r.range), [null, "bytes=0-8"]);
});
test("explicit publication allows anonymous reading, and revocation denies the next request", async () => {
  const f = fixture(null); f.share();
  assert.equal((await privateMediaResponse(url, null, f.io)).status, 200);
  f.revoke(); assert.equal((await privateMediaResponse(url, null, f.io)).status, 404);
  assert.equal(f.reads.length, 1);
});
test("publishing one file does not expose another file from the same owner", async () => {
  const f = fixture(null); f.share();
  assert.equal((await privateMediaResponse(url.replace("synthetic", "other"), null, f.io)).status, 404);
  assert.equal(f.reads.length, 0);
});
test("paths reject external URLs, encoded traversal, credentials and query strings", () => {
  assert.equal(privateMediaUrl(privateMediaPath(url)!.path), url);
  for (const bad of [url + "?token=x", url + "#x", "https://evil.test" + url, url.replace("results/", "../"), url.replace("results/", "%2e%2e/"), url.replace("results/", "//"), url.replace(owner, "owner")]) assert.equal(privateMediaPath(bad), null, bad);
});
test("invalid ranges and active content cannot be served", async () => {
  const f = fixture(owner);
  assert.equal((await privateMediaResponse(url, "bytes=0-1,4-5", f.io)).status, 416); assert.equal(f.reads.length, 0);
  f.io.read = async () => new Response("<script>bad</script>", { headers: { "content-type": "image/svg+xml" } });
  assert.equal((await privateMediaResponse(url, null, f.io)).status, 404);
});

test("authenticated private video stages for server rendering and survives saved URL reopening", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { stageHosted } = await import("./render-hosted");
  const f = fixture(owner);
  const saved = JSON.parse(JSON.stringify({ url })).url as string;
  const dir = await mkdtemp(join(tmpdir(), "haggs-private-stage-"));
  const cut = { clips: [{ shotId: "synthetic", index: 0, heading: "Synthetic", url: saved, kind: "video" as const, start: 0, from: 0, seconds: 1 }], total: 1, voices: [], music: null, aspect: "16:9" as const, skipped: [] };
  try {
    const staged = await stageHosted(cut, dir, async () => { throw Error("Private media must not use unauthenticated fetch"); }, { file: 100, total: 100 }, location => privateMediaResponse(location, null, f.io));
    assert.equal(staged.clips[0]!.url, "/api/local/media/m1.mp4");
    assert.equal(await readFile(join(dir, "media", "m1.mp4"), "utf8"), "synthetic");
    const other = fixture("22222222-2222-4222-8222-222222222222");
    await assert.rejects(stageHosted(cut, dir, fetch, { file: 100, total: 100 }, location => privateMediaResponse(location, null, other.io)), /couldn't be fetched/);
    assert.equal(other.reads.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
