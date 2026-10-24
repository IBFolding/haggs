import assert from "node:assert/strict";
import { test } from "node:test";

import { keptExtension, mayFetchForKeeping } from "./keep-url";

test("the file type decides the extension, the kind is the fallback", () => {
  assert.equal(keptExtension("image/png", "image"), "png");
  assert.equal(keptExtension("image/jpeg; charset=x", "image"), "jpg");
  assert.equal(keptExtension("image/webp", "image"), "webp");
  assert.equal(keptExtension("video/mp4", "video"), "mp4");
  assert.equal(keptExtension("video/webm", "video"), "webm");
  assert.equal(keptExtension("application/octet-stream", "video"), "mp4");
  assert.equal(keptExtension("", "image"), "png");
});

test("only an outside https link is copied; our own files and private addresses are not", () => {
  assert.equal(mayFetchForKeeping("https://cdn.example.test/a.png"), true);
  assert.equal(mayFetchForKeeping("/api/local/x.png"), false);
  assert.equal(mayFetchForKeeping("data:image/png;base64,AAA"), false);
  assert.equal(mayFetchForKeeping("http://cdn.example.test/a.png"), false);
  assert.equal(mayFetchForKeeping("https://localhost/a.png"), false);
  assert.equal(mayFetchForKeeping("https://127.0.0.1/a.png"), false);
  assert.equal(mayFetchForKeeping("https://192.168.1.4/a.png"), false);
  assert.equal(mayFetchForKeeping("https://10.0.0.2/a.png"), false);
  assert.equal(mayFetchForKeeping("https://169.254.169.254/latest"), false);
  assert.equal(mayFetchForKeeping("not a url"), false);
});
