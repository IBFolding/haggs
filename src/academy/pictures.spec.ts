import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { MOODS, moodPicture } from "./labs";
import { ACADEMY_HERO, LESSONS, lessonCover } from "./lessons";

const exists = (src: string) => existsSync(join(process.cwd(), "public", src));

test("every lesson has its cover, the Academy its picture, and every lab scene its picture", () => {
  for (const l of LESSONS) assert.ok(exists(lessonCover(l.id)), l.id);
  assert.ok(exists(ACADEMY_HERO));
  for (const m of MOODS) assert.ok(exists(moodPicture(m.id)), m.id);
});
