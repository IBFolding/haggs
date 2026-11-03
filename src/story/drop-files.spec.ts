import assert from "node:assert/strict";
import test from "node:test";

import { checkDrop, dragHasFiles, mimeOf } from "./drop-files";

const f = (name: string, type: string, size = 1000) => ({ name, type, size });

test("an image drop is accepted where images are taken", () => {
  const r = checkDrop([f("a.png", "image/png")], { kinds: ["image"] });
  assert.equal(r.accepted.length, 1);
  assert.equal(r.error, null);
});

test("a video is refused on an image-only spot with a clear reason", () => {
  const r = checkDrop([f("a.mp4", "video/mp4")], { kinds: ["image"] });
  assert.equal(r.accepted.length, 0);
  assert.match(r.error!, /Drop an image/);
});

test("video is accepted where the picker takes images and video", () => {
  assert.equal(checkDrop([f("a.mov", "video/quicktime")], { kinds: ["image", "video"] }).accepted.length, 1);
});

test("a desktop drop with no reported type falls back to the extension", () => {
  assert.equal(mimeOf(f("photo.JPG", "")), "image/jpeg");
  assert.equal(checkDrop([f("clip.mp4", "")], { kinds: ["video"] }).accepted.length, 1);
  assert.equal(checkDrop([f("notes.txt", "")], { kinds: ["image"] }).accepted.length, 0);
});

test("a spot limited to certain image types refuses others", () => {
  const rules = { kinds: ["image" as const], mimes: ["image/png"] };
  assert.equal(checkDrop([f("a.png", "image/png")], rules).accepted.length, 1);
  const bad = checkDrop([f("a.gif", "image/gif")], rules);
  assert.equal(bad.accepted.length, 0);
  assert.match(bad.error!, /PNG, JPEG or WebP/);
});

test("single-file spots use the first file and say so", () => {
  const r = checkDrop([f("a.png", "image/png"), f("b.png", "image/png")], { kinds: ["image"] });
  assert.deepEqual(r.accepted.map((x) => x.name), ["a.png"]);
  assert.match(r.error!, /one file/);
});

test("multi-file spots keep the valid ones and report what was skipped", () => {
  const r = checkDrop([f("a.png", "image/png"), f("b.pdf", "application/pdf"), f("c.webp", "image/webp")], { kinds: ["image"], multiple: true });
  assert.deepEqual(r.accepted.map((x) => x.name), ["a.png", "c.webp"]);
  assert.match(r.error!, /1 file was skipped/);
});

test("files over the limit are refused", () => {
  const r = checkDrop([f("big.png", "image/png", 301 * 1024 * 1024)], { kinds: ["image"] });
  assert.equal(r.accepted.length, 0);
  assert.match(r.error!, /300 MB/);
});

test("an empty drop does nothing", () => {
  assert.deepEqual(checkDrop([], { kinds: ["image"] }), { accepted: [], error: null });
});

test("only drags that carry files count; in-app asset drags do not", () => {
  assert.equal(dragHasFiles(["Files"]), true);
  assert.equal(dragHasFiles(["application/x-haggs-asset", "text/plain"]), false);
  assert.equal(dragHasFiles(undefined), false);
});
