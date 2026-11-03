import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { STUDIO_SAMPLES, THIRD_PARTY_WORKFLOWS, communityAppPath, communityEntry } from "./curated";

test("every studio sample points at a file in public/ and says what made it", () => {
  for (const s of STUDIO_SAMPLES) {
    assert.ok(existsSync(join(process.cwd(), "public", s.src)), s.src);
    if (s.poster) assert.ok(existsSync(join(process.cwd(), "public", s.poster)), s.poster);
    assert.ok(s.madeWith.length > 0);
  }
});

test("a third-party workflow credits its creator and licence, and links to the creator's own repo", () => {
  for (const w of THIRD_PARTY_WORKFLOWS) {
    assert.match(w.source, /^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    assert.ok(w.source.startsWith(w.creator.url + "/"));
    assert.ok(w.license && w.creator.name && w.requirements.length);
  }
});

test("every curated entry opens as an app page, and a third-party one never claims to run hosted", () => {
  for (const s of STUDIO_SAMPLES) {
    const e = communityEntry(s.id);
    assert.equal(e?.kind, "sample");
    assert.ok(["/photos", "/video", "/comic"].includes(s.tool.href));
  }
  for (const w of THIRD_PARTY_WORKFLOWS) {
    const e = communityEntry(w.id);
    assert.equal(e?.kind, "third-party");
    assert.equal(w.run.hosted, false);
    assert.ok(w.run.steps.length > 0 && w.run.where.length > 0);
    assert.match(w.notes, /not (part of haggs|run by haggs)/i);
  }
  assert.equal(communityEntry("nope"), null);
  assert.equal(communityAppPath("ad-kettle-hero"), "/workflows/community/ad-kettle-hero");
});
