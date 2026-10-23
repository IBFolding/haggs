import assert from "node:assert/strict";
import test from "node:test";
import { hosted, isBlobUrl } from "./blob";

test("only this app's own store counts as a trusted link", () => {
  assert.equal(isBlobUrl("https://abc123.public.blob.vercel-storage.com/haggs/results/x.mp4"), true);
  for (const bad of ["http://abc.public.blob.vercel-storage.com/x", "https://evil.test/x.public.blob.vercel-storage.com", "https://public.blob.vercel-storage.com.evil.test/x", "/api/local/x.mp4", "data:image/png;base64,AAAA", "not a url"]) assert.equal(isBlobUrl(bad), false, bad);
});

test("a deployment is hosted only when a store is connected", () => {
  const was = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal(hosted(), false);
  process.env.BLOB_READ_WRITE_TOKEN = "x";
  assert.equal(hosted(), true);
  if (was === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = was;
});
