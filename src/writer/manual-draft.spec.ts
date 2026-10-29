import assert from "node:assert/strict";
import { test } from "node:test";
import { formatById } from "../sheets/formats";
import { manualDraftPrompt, readManualDraft } from "./manual-draft";
const format = formatById("vertical-drama")!;
const reply = { title: "Build night", logline: "A demo saves the evening.", script: "INT. STUDIO — NIGHT\n\nA developer opens a laptop.\n\nDEV\nIt works.\n", characters: [], locations: [], beats: [{ title: "Demo", scenes: [1], feeling: "relief", withhold: "" }], shots: [{ beat: 1, scene: 1, action: "A laptop opens.", size: "Wide", angle: "Eye level", lens: "35mm", move: "", seconds: 5, dialogue: "", sound: "" }] };
test("manual writing includes the same format, direction and full draft schema", () => {
  const prompt = manualDraftPrompt(format, "A developer saves demo night", "One location only");
  assert.match(prompt, /A developer saves demo night/); assert.match(prompt, /One location only/);
  assert.match(prompt, /JSON Schema/); assert.match(prompt, /"script"/); assert.match(prompt, /"shots"/);
  assert.throws(() => manualDraftPrompt(format, "", ""), /idea/);
});
test("a pasted fenced draft fills the sheets without a network call", () => {
  const result = readManualDraft(`Here is the draft:\n\`\`\`json\n${JSON.stringify(reply)}\n\`\`\``, format);
  assert.equal(result.sheets.title, "Build night"); assert.equal(result.sheets.script.length, 1); assert.equal(result.sheets.story.length, 1); assert.equal(result.sheets.shots.length, 1);
});
test("incomplete, malformed and oversized replies cannot apply", () => {
  assert.throws(() => readManualDraft('{"script":', format), /JSON/);
  assert.throws(() => readManualDraft(JSON.stringify({ ...reply, beats: null }), format), /beats/);
  assert.throws(() => readManualDraft("x".repeat(1_000_001), format), /too large/);
});

test("nested malformed fields are rejected before applying a manual draft", () => {
  for (const bad of [null, 5, {}, []]) {
    assert.throws(() => readManualDraft(JSON.stringify({ ...reply, shots: [{ ...reply.shots[0], dialogue: bad }] }), format), /shots/);
  }
});
