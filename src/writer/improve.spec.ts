import assert from "node:assert/strict";
import { test } from "node:test";

import { IMPROVE_SCHEMA, improveRequest, readImproved } from "./improve";

test("the request carries the prompt and the kind of thing being made", () => {
  const r = improveRequest("a fox in snow", "Create");
  assert.match(r.user, /a fox in snow/);
  assert.match(r.system, /picture/i);
  assert.match(improveRequest("a fox running", "Video").system, /camera/i);
  assert.match(improveRequest("make the sky purple", "Edit").system, /keep|change/i);
  assert.ok(r.maxTokens > 100 && r.maxTokens <= 1500);
});

test("the system prompt keeps the person's idea and forbids inventing new subjects, text or brands", () => {
  const s = improveRequest("a fox in snow", "Create").system;
  assert.match(s, /keep/i);
  assert.match(s, /do not (add|invent)/i);
});

test("a prompt that is too long or empty is refused before any call", () => {
  assert.throws(() => improveRequest("   ", "Create"), /describe/i);
  assert.throws(() => improveRequest("x".repeat(3001), "Create"), /too long/i);
});

test("the answer is read from the schema and cleaned", () => {
  assert.equal(readImproved({ improved: '  "A red fox in deep snow, soft morning light."  ' }), "A red fox in deep snow, soft morning light.");
  assert.throws(() => readImproved({}), /no prompt/i);
  assert.throws(() => readImproved({ improved: "   " }), /no prompt/i);
  assert.throws(() => readImproved({ improved: "x".repeat(4001) }), /too long/i);
  assert.deepEqual((IMPROVE_SCHEMA as { required: string[] }).required, ["improved"]);
});
