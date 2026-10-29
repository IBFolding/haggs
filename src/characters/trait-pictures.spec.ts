import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { TRAIT_ROWS } from "./character";
import { HEIGHT_SCALE, PICTURED, picturedChoices, traitPicture } from "./trait-pictures";

test("every pictured trait choice has its picture file", () => {
  const all = picturedChoices();
  assert.equal(all.length, PICTURED.reduce((n, id) => n + (TRAIT_ROWS.find((r) => r.id === id)?.options.length ?? 0), 0));
  for (const c of all) assert.ok(existsSync(join(process.cwd(), "public", c.src)), c.src);
});

test("file names are the choice written with dashes", () => {
  assert.equal(traitPicture("glasses", "thick black frames"), "/traits/glasses-thick-black-frames.webp");
  assert.equal(traitPicture("gender", "non-binary person"), "/traits/gender-non-binary-person.webp");
});

test("every height choice is drawn, shortest to tallest", () => {
  const opts = TRAIT_ROWS.find((r) => r.id === "height")!.options;
  const k = opts.map((o) => HEIGHT_SCALE[o]);
  assert.ok(k.every((v) => typeof v === "number"));
  for (let i = 1; i < k.length; i++) assert.ok(k[i]! > k[i - 1]!);
});
