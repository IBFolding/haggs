import assert from "node:assert/strict";
import { test } from "node:test";

import { partnerNodes } from "./partner";

test("partner nodes are the ones that call someone else's paid API", () => {
  const catalog = { KSampler: { api_node: false }, KlingOmniProEditVideoNode: { api_node: true }, ElevenLabsTextToSpeech: { api_node: true } } as never;
  const prompt = { "1": { class_type: "KSampler", inputs: {} }, "2": { class_type: "KlingOmniProEditVideoNode", inputs: {} }, "3": { class_type: "KlingOmniProEditVideoNode", inputs: {} } } as never;
  assert.deepEqual(partnerNodes(prompt, catalog), ["KlingOmniProEditVideoNode"]);
  assert.deepEqual(partnerNodes({ "1": { class_type: "KSampler", inputs: {} } } as never, catalog), []);
});
