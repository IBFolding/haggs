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

test("through the real Claude call (faked network): the prompt goes out with the schema and the cleaned answer comes back", async () => {
  const { askClaude } = await import("./draft");
  let sent: { system?: string; messages?: { content: string }[]; output_config?: { format?: { schema?: { required?: string[] } } } } = {};
  const fake = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ improved: '"A red fox in deep snow at dawn, low golden light, shallow depth of field."' }) }], usage: { input_tokens: 90, output_tokens: 40 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await askClaude<string>({ key: "sk-test", request: improveRequest("a fox in snow", "Create"), schema: IMPROVE_SCHEMA, read: readImproved, fetch: fake });
  assert.ok(r.ok && r.draft === "A red fox in deep snow at dawn, low golden light, shallow depth of field.");
  assert.equal(sent.messages?.[0]?.content, "a fox in snow");
  assert.match(sent.system ?? "", /improve prompts/i);
  assert.deepEqual(sent.output_config?.format?.schema?.required, ["improved"]);
});

test("a rejected key and a reply with no prompt both come back as plain reasons", async () => {
  const { askClaude } = await import("./draft");
  const bad = await askClaude<string>({ key: "bad", request: improveRequest("a fox", "Create"), schema: IMPROVE_SCHEMA, read: readImproved, fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch });
  assert.ok(!bad.ok && /key/i.test(bad.reason));
  const empty = await askClaude<string>({ key: "k", request: improveRequest("a fox", "Create"), schema: IMPROVE_SCHEMA, read: readImproved, fetch: (async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] }), { status: 200 })) as unknown as typeof fetch });
  assert.ok(!empty.ok && /no prompt/i.test(empty.reason));
});
