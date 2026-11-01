import assert from "node:assert/strict";
import { test } from "node:test";

import { FILM_TEMPLATES, buildFilm, filmDefaults } from "./film-templates";
import { layout, parseSheet } from "./beats";

test("there are several templates, each with a name, a blurb and fields that have labels", () => {
  assert.ok(FILM_TEMPLATES.length >= 6);
  assert.equal(new Set(FILM_TEMPLATES.map((t) => t.id)).size, FILM_TEMPLATES.length);
  for (const t of FILM_TEMPLATES) {
    assert.ok(t.name && t.blurb && t.fields.length >= 1, t.id);
    for (const f of t.fields) assert.ok(f.id && f.label && f.value, `${t.id}.${f.id}`);
  }
});

test("every template builds a sheet that parses with no problems from its default values", () => {
  for (const t of FILM_TEMPLATES) {
    const p = parseSheet(buildFilm(t, filmDefaults(t)));
    assert.deepEqual(p.problems, [], t.id);
    assert.ok(p.blocks.length >= 6, `${t.id} has ${p.blocks.length} blocks`);
    const total = layout(p).totalSeconds;
    assert.ok(total >= 12 && total <= 60, `${t.id} runs ${total.toFixed(1)}s`);
  }
});

test("the first block is never a picture the film might not have: frame 1 is words or a number", () => {
  for (const t of FILM_TEMPLATES) {
    const first = parseSheet(buildFilm(t, filmDefaults(t))).blocks[0]!;
    assert.ok(first.kind === undefined || first.kind === "count" || first.kind === "stack", t.id);
  }
});

test("what you type goes into the sheet, shouted, and an empty field falls back to its default", () => {
  const t = FILM_TEMPLATES.find((x) => x.id === "launch")!;
  const v = { ...filmDefaults(t), product: "Kiln & Co.", tagline: "" };
  const sheet = buildFilm(t, v);
  assert.match(sheet, /KILN & CO\./);
  assert.ok(sheet.includes(filmDefaults(t).tagline!.toUpperCase()));
});

test("a | in someone's words can't break the sheet", () => {
  const t = FILM_TEMPLATES[0]!;
  const sheet = buildFilm(t, { ...filmDefaults(t), [t.fields[0]!.id]: "A | B | red" });
  assert.deepEqual(parseSheet(sheet).problems, []);
});
