import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSheet } from "./beats";
import { referenceStates, TEMPLATES } from "./templates";

test("production templates are valid, distinct sheets with words, counters and media examples", () => {
  assert.ok(TEMPLATES.length >= 4);
  assert.equal(new Set(TEMPLATES.map((template) => template.id)).size, TEMPLATES.length);
  assert.equal(new Set(TEMPLATES.map((template) => template.sheet)).size, TEMPLATES.length);
  for (const template of TEMPLATES) {
    const parsed = parseSheet(template.sheet);
    assert.deepEqual(parsed.problems, [], template.name);
    assert.ok(parsed.blocks.length >= 5, template.name);
    assert.ok(parsed.blocks.some((block) => !block.kind), `${template.name} has editable words`);
  }
  assert.ok(TEMPLATES.some((template) => parseSheet(template.sheet).blocks.some((block) => block.kind === "image")));
  assert.ok(TEMPLATES.some((template) => parseSheet(template.sheet).blocks.some((block) => block.kind === "clip")));
  assert.ok(TEMPLATES.some((template) => parseSheet(template.sheet).blocks.some((block) => block.kind === "count")));
});

test("a sheet's reference list is deduplicated and shows what is ready to use", () => {
  const sheet = "@image product | 2\n@clip app | 3\n@image product | 2\nWORDS";
  assert.deepEqual(referenceStates(sheet, ["product"]), [
    { name: "product", kind: "image", ready: true },
    { name: "app", kind: "clip", ready: false },
  ]);
});
