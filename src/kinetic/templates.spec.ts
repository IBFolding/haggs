import assert from "node:assert/strict";
import { test } from "node:test";

import { TEMPLATES, buildTemplate, defaults } from "./templates";
import { layout, parseSheet } from "./beats";

test("there are several templates, each with a name, a blurb and fields that have labels", () => {
  assert.ok(TEMPLATES.length >= 6);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.blurb && t.fields.length >= 1, t.id);
    for (const f of t.fields) assert.ok(f.id && f.label && f.value, `${t.id}.${f.id}`);
  }
});

test("every template builds a sheet that parses with no problems from its default values", () => {
  for (const t of TEMPLATES) {
    const p = parseSheet(buildTemplate(t, defaults(t)));
    assert.deepEqual(p.problems, [], t.id);
    assert.ok(p.blocks.length >= 6, `${t.id} has ${p.blocks.length} blocks`);
    const total = layout(p).totalSeconds;
    assert.ok(total >= 12 && total <= 60, `${t.id} runs ${total.toFixed(1)}s`);
  }
});

test("the first block is never a picture the film might not have: frame 1 is words or a number", () => {
  for (const t of TEMPLATES) {
    const first = parseSheet(buildTemplate(t, defaults(t))).blocks[0]!;
    assert.ok(first.kind === undefined || first.kind === "count" || first.kind === "stack", t.id);
  }
});

test("what you type goes into the sheet, shouted, and an empty field falls back to its default", () => {
  const t = TEMPLATES.find((x) => x.id === "launch")!;
  const v = { ...defaults(t), product: "Kiln & Co.", tagline: "" };
  const sheet = buildTemplate(t, v);
  assert.match(sheet, /KILN & CO\./);
  assert.ok(sheet.includes(defaults(t).tagline!.toUpperCase()));
});

test("a | in someone's words can't break the sheet", () => {
  const t = TEMPLATES[0]!;
  const sheet = buildTemplate(t, { ...defaults(t), [t.fields[0]!.id]: "A | B | red" });
  assert.deepEqual(parseSheet(sheet).problems, []);
});
