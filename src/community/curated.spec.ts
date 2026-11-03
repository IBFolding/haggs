import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { STUDIO_SAMPLES, THIRD_PARTY_WORKFLOWS } from "./curated";

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
