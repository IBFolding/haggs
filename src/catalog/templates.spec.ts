import assert from "node:assert/strict";
import { test } from "node:test";

import { slotIn, TEMPLATES, templatesFor } from "./templates";

test("every template has a part in brackets to make your own, and a unique id", () => {
  const ids = new Set<string>();
  for (const t of TEMPLATES) {
    assert.ok(!ids.has(t.id), t.id);
    ids.add(t.id);
    assert.ok(slotIn(t.prompt), `${t.id} has nothing to fill in`);
    assert.ok(t.prompt.length < 1000, t.id);
    assert.ok(t.name.length <= 28, t.id);
  }
});

test("Create and Video each have their own set, and only Video starts from a picture", () => {
  assert.ok(templatesFor("Create").length >= 6);
  assert.ok(templatesFor("Video").length >= 6);
  assert.ok(templatesFor("Create").every((t) => !t.fromPicture));
  assert.ok(templatesFor("Video").some((t) => t.fromPicture));
  assert.ok(templatesFor("Video").some((t) => t.id === "product-placement"));
  assert.ok(templatesFor("Create").some((t) => t.id === "ai-influencer"));
});

test("slotIn finds the first bracketed part, brackets included, or nothing", () => {
  assert.deepEqual(slotIn("A photo of [your product] on [a table]"), { start: 11, end: 25 });
  assert.equal(slotIn("no slots here"), null);
});
