import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCanvas } from "./canvas";
import { QUICK_APPS, quickById } from "./quick";

test("every ready-made app has a name, a plain sentence, and a unique id", () => {
  assert.ok(QUICK_APPS.length >= 8);
  assert.equal(new Set(QUICK_APPS.map((a) => a.id)).size, QUICK_APPS.length);
  for (const a of QUICK_APPS) assert.ok(a.name && a.says.length > 20 && a.says.length < 120, a.id);
});

test("the ones built from steps compile to a real workflow", () => {
  for (const a of QUICK_APPS.filter((x) => !x.canvas.nodes.some((n) => n.kind === "library"))) {
    const w = compileCanvas(a.canvas, {});
    assert.ok(Object.values(w).some((n) => /^Save(Image|Video)$/.test(n.class_type)), a.id);
  }
});

test("the ones that stack a library workflow name it, so it can be loaded", () => {
  const lib = QUICK_APPS.filter((x) => x.canvas.nodes.some((n) => n.kind === "library"));
  assert.ok(lib.length >= 3);
  for (const a of lib) for (const n of a.canvas.nodes) if (n.kind === "library") assert.match(n.template ?? "", /^[\w.-]+$/);
  assert.equal(quickById("nope"), undefined);
});
