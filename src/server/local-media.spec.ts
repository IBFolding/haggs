import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { localFile, parseRange } from "./local-media";

const root = mkdtempSync(join(tmpdir(), "haggs-local-"));
mkdirSync(join(root, "takes"));
writeFileSync(join(root, "takes", "a.mp4"), "video");
writeFileSync(join(root, "notes.md"), "private");
writeFileSync(join(root, "reel.haggs.json"), "{}");
const outside = mkdtempSync(join(tmpdir(), "haggs-out-"));
writeFileSync(join(outside, "b.mp4"), "x");
symlinkSync(join(outside, "b.mp4"), join(root, "takes", "link.mp4"));

test("serves media under the root and nothing else", () => {
  assert.equal(localFile(root, ["takes", "a.mp4"], "development")?.type, "video/mp4");
  assert.equal(localFile(root, ["reel.haggs.json"], "development")?.type, "application/json");
  assert.equal(localFile(root, ["notes.md"], "development"), null, "only media and project files");
  assert.equal(localFile(root, ["..", "..", "etc", "passwd"], "development"), null);
  assert.equal(localFile(root, ["takes", "link.mp4"], "development"), null, "a symlink out of the root is refused");
  assert.equal(localFile(root, ["takes", "missing.mp4"], "development"), null);
});

test("is off in production and when no root is set", () => {
  assert.equal(localFile(root, ["takes", "a.mp4"], "production"), null);
  assert.equal(localFile("", ["takes", "a.mp4"], "development"), null);
  assert.equal(localFile(undefined, ["takes", "a.mp4"], "development"), null);
});

test("byte ranges are read so video can seek", () => {
  assert.deepEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepEqual(parseRange("bytes=900-", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.equal(parseRange("bytes=2000-", 1000), "unsatisfiable");
  assert.equal(parseRange(null, 1000), null);
});

test("a local media URL becomes a data URI so a remote model can read it; anything else passes through", async () => {
  const { inlineLocal } = await import("./local-media");
  writeFileSync(join(root, "takes", "still.png"), Buffer.from([1, 2, 3]));
  assert.deepEqual(await inlineLocal(["/api/local/takes/still.png", "https://cdn.test/x.png", "data:image/png;base64,AA"], root, "development"), [
    "data:image/png;base64,AQID",
    "https://cdn.test/x.png",
    "data:image/png;base64,AA",
  ]);
  await assert.rejects(inlineLocal(["/api/local/notes.md"], root, "development"), /can't be sent/);
  await assert.rejects(inlineLocal(["/api/local/takes/still.png"], root, "production"), /can't be sent/);
});
