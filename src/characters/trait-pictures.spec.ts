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

test("every pictured place choice has its picture file", async () => {
  const { PLACE_ROWS } = await import("../locations/location");
  const { PLACE_PICTURED, placePicture } = await import("./trait-pictures");
  for (const id of PLACE_PICTURED) {
    const row = PLACE_ROWS.find((r) => r.id === id);
    assert.ok(row, id);
    for (const o of row.options) assert.ok(existsSync(join(process.cwd(), "public", placePicture(id, o))), placePicture(id, o));
  }
});

test("the look picker's light, look and era choices, and four framings, have their pictures", async () => {
  const { LOOK_ROWS } = await import("../catalog/look");
  const { lookPhotoFor } = await import("../app/look-picker");
  for (const id of ["light", "look", "era"] as const) for (const o of LOOK_ROWS.find((r) => r.id === id)!.options) {
    const src = lookPhotoFor(id, o.id);
    assert.ok(src && existsSync(join(process.cwd(), "public", src)), `${id}/${o.id}`);
  }
  for (const f of ["extreme-wide", "over-shoulder", "low-angle", "top-down"]) assert.ok(existsSync(join(process.cwd(), "public", lookPhotoFor("framing", f)!)), f);
});
