import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { SHOWCASE, SHOWCASE_REEL } from "./showcase";

const all = [SHOWCASE_REEL, ...SHOWCASE];

test("every showcase item has a file in public/, alt text and a label, and stays small", () => {
  const ids = new Set<string>();
  for (const s of all) {
    for (const f of [s.src, s.poster].filter((x): x is string => Boolean(x))) {
      const p = join(process.cwd(), "public", f);
      assert.ok(existsSync(p), f);
      assert.ok(statSync(p).size < 2_000_000, `${f} is over 2 MB`);
    }
    assert.ok(s.alt.length > 20 && s.label.length > 0, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
  }
});

test("the reel is a video with a poster, and WAYLIGHT stays a share of the mix, not all of it", () => {
  assert.equal(SHOWCASE_REEL.kind, "video");
  assert.ok(SHOWCASE_REEL.poster);
  const waylight = SHOWCASE.filter((s) => s.id.startsWith("waylight")).length;
  assert.ok(waylight >= 8 && waylight <= 12);
  assert.ok(SHOWCASE.length - waylight >= 6);
});
