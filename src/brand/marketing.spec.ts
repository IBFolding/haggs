import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { QUICK_APPS } from "../comfy/quick";
import { MODES, TEMPLATES, marketingPrompt, templatesFor } from "./marketing";

test("every mode has templates, ids are unique, and each says what it adds", () => {
  for (const m of MODES) assert.ok(templatesFor(m.id, "all").length >= 4, m.id);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) assert.ok(t.direction.length > 20, t.id);
});

test("samples are our own files, and apps are real ready-made apps", () => {
  for (const t of TEMPLATES) {
    if (t.sample) assert.ok(existsSync(join(process.cwd(), "public", t.sample)), `${t.id}: ${t.sample}`);
    if (t.app) assert.ok(QUICK_APPS.some((a) => a.id === t.app), `${t.id}: ${t.app}`);
  }
});

test("filters by mode and by kind", () => {
  assert.ok(templatesFor("all", "video").every((t) => t.makes === "video"));
  assert.ok(templatesFor("motion", "all").every((t) => t.mode === "motion"));
  assert.equal(templatesFor("all", "all").length, TEMPLATES.length);
});

test("the prompt carries your words, the template, the product, the person and the brand, in plain words", () => {
  const t = TEMPLATES.find((x) => x.id === "shot-ice")!;
  const p = marketingPrompt({ words: "Summer launch.", template: t, product: { name: "Ember mug", words: "a speckled terracotta mug" }, person: "a woman in her thirties", kit: { id: "k", name: "Kiln & Co.", url: "", logo: null, colors: ["#c8553d"], fonts: [], about: "Small-batch stoneware", tone: "warm", createdAt: 0, updatedAt: 0 } });
  assert.match(p, /^Summer launch\. /);
  assert.match(p, /crushed ice/);
  assert.match(p, /The product is Ember mug: a speckled terracotta mug\./);
  assert.match(p, /The person: a woman in her thirties/);
  assert.match(p, /Brand: Kiln & Co\./);
  assert.match(p, /#c8553d/);
  assert.equal(marketingPrompt({ words: "" }), "No watermark.");
});

test("a brand name that ends in a full stop is not given a second one", () => {
  const p = marketingPrompt({ words: "", kit: { id: "k", name: "Kiln & Co.", url: "", logo: null, colors: [], fonts: [], about: "", tone: "", createdAt: 0, updatedAt: 0 } });
  assert.match(p, /Brand: Kiln & Co\. No watermark\./);
});

test("a sample made outside haggs says so, and every sample card picture exists", async () => {
  const { SAMPLE_PICTURES } = await import("../samples/starters");
  for (const src of Object.values(SAMPLE_PICTURES)) assert.ok(existsSync(join(process.cwd(), "public", src)), src);
});
