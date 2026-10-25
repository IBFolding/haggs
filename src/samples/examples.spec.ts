import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { EXAMPLES, examplesFor } from "./examples";

test("every example points at a file that is shipped", () => {
  for (const e of EXAMPLES) assert.ok(existsSync(`public${e.src}`), e.src);
});

test("Photos (the Create surface) shows pictures, Video shows clips, Edit shows none", () => {
  assert.ok(examplesFor("Create").length >= 3 && examplesFor("Create").every((e) => e.kind === "image"));
  assert.ok(examplesFor("Video").length >= 2 && examplesFor("Video").every((e) => e.kind === "video"));
  assert.equal(examplesFor("Edit").length, 0);
});

test("each example carries the prompt that made it and what it cost", () => {
  for (const e of EXAMPLES) assert.ok(e.prompt.length > 30 && e.model.length > 3 && e.cost.startsWith("$"), e.src);
});
