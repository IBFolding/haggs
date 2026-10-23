import assert from "node:assert/strict";
import test from "node:test";
import { KEEP_DAYS, deletable, expired, megabytes, mine, ownsPath, totalBytes, type Item } from "./library";

const DAY = 86_400_000;
const item = (pathname: string, ageDays: number, size = 1_000_000): Item => ({ url: `https://s.public.blob.vercel-storage.com/${pathname}`, pathname, size, uploadedAt: Date.now() - ageDays * DAY });

test("only your own folder is yours", () => {
  assert.equal(ownsPath("u-1", "haggs/u-1/results/a.mp4"), true);
  assert.equal(ownsPath("u-1", "haggs/u-2/results/a.mp4"), false);
  assert.equal(ownsPath("u-1", "haggs/guest/results/a.mp4"), false);
  assert.equal(ownsPath("u-1", "haggs/u-1/../u-2/a.mp4"), false);
});

test("your files come newest first and nobody else's are listed", () => {
  const list = mine("u-1", [item("haggs/u-1/results/old.mp4", 9), item("haggs/u-2/results/x.mp4", 1), item("haggs/u-1/uploads/new.png", 1)]);
  assert.deepEqual(list.map((i) => i.pathname), ["haggs/u-1/uploads/new.png", "haggs/u-1/results/old.mp4"]);
});

test("files are removed after the keep time, and only inside the app's folder", () => {
  const old = item("haggs/guest/results/a.mp4", KEEP_DAYS + 1);
  const fresh = item("haggs/guest/results/b.mp4", KEEP_DAYS - 1);
  const stranger = item("other/c.mp4", 400);
  assert.deepEqual(expired([old, fresh, stranger]), [old]);
});

test("a delete request only ever removes files the person owns", () => {
  const a = item("haggs/u-1/results/a.mp4", 1), b = item("haggs/u-2/results/b.mp4", 1);
  assert.deepEqual(deletable("u-1", [a.url, b.url, "https://evil.test/x"], [a, b]), [a.url]);
});

test("sizes are shown in megabytes", () => {
  assert.equal(megabytes(12_340_000), 12.3);
  assert.equal(totalBytes([item("haggs/a", 1, 2), item("haggs/b", 1, 3)]), 5);
});
