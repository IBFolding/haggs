import assert from "node:assert/strict";
import { test } from "node:test";

import { askClaude } from "../writer/draft";
import { GAME_SCHEMA, editRequest, forClaude, ideaRequest, mcpEditAsk, mcpIdeaAsk, readGameReply, readSent, type GameReply } from "./claude";
import { RANGES, TEMPLATES, defaultSpec, withArt } from "./spec";

/** The schema's own walk: every object names all its fields and allows no others, as structured output needs. */
function strict(node: unknown, path = "root"): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; properties?: Record<string, unknown>; required?: string[]; additionalProperties?: unknown; items?: unknown };
  if (n.type === "object") {
    assert.deepEqual([...(n.required ?? [])].sort(), Object.keys(n.properties ?? {}).sort(), `${path} requires every field`);
    assert.equal(n.additionalProperties, false, `${path} allows no others`);
    for (const [k, v] of Object.entries(n.properties ?? {})) strict(v, `${path}.${k}`);
  }
  if (n.items) strict(n.items, `${path}[]`);
}

test("the schema is strict and names every rule the templates use", () => {
  strict(GAME_SCHEMA);
  const rules = Object.keys((GAME_SCHEMA.properties.rules as { properties: object }).properties);
  for (const t of TEMPLATES) for (const k of Object.keys(RANGES[t])) assert.ok(rules.includes(k), `${t}.${k}`);
});

test("an idea becomes a request; empty and huge ideas are refused", () => {
  const r = ideaRequest("  a penguin sliding down a glacier  ");
  assert.match(r.user, /a penguin sliding down a glacier$/);
  assert.match(r.system, /runner/);
  assert.throws(() => ideaRequest("hi"), /few words/);
  assert.throws(() => ideaRequest("x".repeat(2001)), /2,000/);
});

test("an edit sends the spec without picture links", () => {
  const spec = withArt(defaultSpec("runner"), "player", { url: "https://blob.example.com/p.png" });
  const r = editRequest(spec, "make it faster");
  assert.doesNotMatch(r.user, /blob\.example\.com/);
  assert.match(r.user, /make it faster/);
  assert.equal(JSON.stringify(forClaude(spec)).includes("url"), false);
  assert.throws(() => editRequest(spec, "  "), /what to change/);
});

test("a reply is clamped into a playable spec, with Claude's sentence", () => {
  const reply = readGameReply({ ...defaultSpec("collector"), rules: { speed: 5, hazards: 40, target: 12, seconds: 45, lives: 3, hazardSpeed: 100 }, said: "A meadow at night." });
  assert.equal(reply.spec.template, "collector");
  if (reply.spec.template !== "collector") return;
  assert.equal(reply.spec.rules.speed, RANGES.collector.speed[0]);
  assert.equal(reply.spec.rules.hazards, RANGES.collector.hazards[1]);
  assert.equal(reply.said, "A meadow at night.");
  assert.throws(() => readGameReply({ template: "platformer" }), /needs a template/);
});

test("an edit keeps made art on slots whose prompt is unchanged, and drops it where the prompt changed", () => {
  let before = withArt(defaultSpec("runner"), "player", { url: "https://blob.example.com/p.png" });
  before = withArt(before, "hazard", { url: "https://blob.example.com/h.png" });
  const after = structuredClone(forClaude(before)) as { art: { hazard: { prompt: string } } };
  after.art.hazard.prompt = "a rolling barrel, side view";
  const { spec, said } = readGameReply(after, before);
  if (spec.template !== "runner") return assert.fail();
  assert.equal(spec.art.player.url, "https://blob.example.com/p.png");
  assert.equal(spec.art.hazard.url, undefined);
  assert.equal(said, "Changed.");
});

test("askClaude with the game schema: a good reply reads, a refusal and a bad key say why", async () => {
  const reply = { ...forClaude(defaultSpec("match")) as object, said: "A garden puzzle." };
  let sent: { output_config?: { format?: { schema?: unknown } } } = {};
  const fake = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }], usage: { input_tokens: 10, output_tokens: 20 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const ok = await askClaude<GameReply>({ key: "sk-test", request: ideaRequest("a garden"), schema: GAME_SCHEMA, read: (v) => readGameReply(v), fetch: fake });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.draft.spec.template, "match");
    assert.equal(ok.draft.said, "A garden puzzle.");
  }
  assert.deepEqual(sent.output_config?.format?.schema, GAME_SCHEMA);

  const broken = (async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: '{"template":"maze"}' }] }), { status: 200 })) as unknown as typeof fetch;
  const bad = await askClaude<GameReply>({ key: "sk-test", request: ideaRequest("a maze"), schema: GAME_SCHEMA, read: (v) => readGameReply(v), fetch: broken });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.reason, /needs a template/);

  const refused = await askClaude<GameReply>({ key: "bad", request: ideaRequest("a maze"), schema: GAME_SCHEMA, read: (v) => readGameReply(v), fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.match(refused.reason, /rejected the key/);
});

test("with no key, the MCP request names the tools, the game and its spec without picture links", () => {
  assert.match(mcpIdeaAsk("  a frog on lily pads "), /haggs_propose_game.*: a frog on lily pads$/);
  const made = withArt(defaultSpec("runner"), "player", { url: "https://x.test/p.png" });
  const ask = mcpEditAsk("g1", made, "faster please");
  assert.match(ask, /haggs_propose_game with game "g1"/);
  assert.match(ask, /The player says: faster please/);
  assert.doesNotMatch(ask, /x\.test/);
  assert.equal(JSON.parse(ask.split("\n\n").at(-1)!).title, made.title);
});

test("games sent over MCP are read and clamped; anything else in the inbox is left out", () => {
  const runner = { ...defaultSpec("runner"), rules: { ...defaultSpec("runner").rules, speed: 99999 } };
  const sent = readSent([
    { id: "1", kind: "game", summary: "A runner", payload: { spec: runner, said: "Made it.", game: "g1" } },
    { id: "2", kind: "game", summary: "Broken", payload: { spec: { template: "golf" } } },
    { id: "3", kind: "series", summary: "Not a game", payload: {} },
    { id: "4", kind: "game", payload: { spec: defaultSpec("match") } },
  ]);
  assert.deepEqual(sent.map((s) => [s.id, s.game ?? null]), [["1", "g1"], ["4", null]]);
  assert.equal((sent[0]!.spec.rules as { speed: number }).speed, RANGES.runner.speed[1]);
  assert.equal(sent[0]!.said, "Made it.");
  assert.equal(sent[1]!.summary, defaultSpec("match").title);
  assert.deepEqual(readSent("nope"), []);
});
