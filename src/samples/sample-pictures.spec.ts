import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { SAMPLES } from "../brand/samples";
import { LOOKS, LOOK_SAMPLES, STARTERS, STARTER_COVERS } from "../comic/comic";

const exists = (src: string) => existsSync(join(process.cwd(), "public", src));

test("every comic look but your own has a picture, and every starter a cover, and the files are there", () => {
  for (const l of LOOKS) if (l.id !== "custom") assert.ok(LOOK_SAMPLES[l.id] && exists(LOOK_SAMPLES[l.id]!), l.id);
  for (const s of STARTERS) assert.ok(STARTER_COVERS[s.id] && exists(STARTER_COVERS[s.id]!), s.id);
});

test("every Ads sample product comes with its photo", () => {
  for (const s of SAMPLES) assert.ok(s.product.picture && exists(s.product.picture), s.id);
});
