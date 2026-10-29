import assert from "node:assert/strict";
import { test } from "node:test";

import { formatById } from "../sheets/formats";
import { parseScreenplay } from "../sheets/screenplay";
import { buildSheets, fixCell } from "../sheets/sheets";
import { applyBreakdown, BREAKDOWN_SCHEMA, breakdownRequest, byHandPrompt, readReply, sceneDigest, validateBreakdown, type Breakdown } from "./breakdown";

const episode = (n: number) =>
  [
    `EXT. ROOFTOP — NIGHT`, "", `NIA (24) dangles a phone over the edge in episode ${n}.`, "",
    "                        NIA", "              Say it again. I dare you.", "",
    "INT. LIFT — CONTINUOUS", "", "JONAH (25) holds the doors, out of breath.", "",
    "                        JONAH", "              I lied about the ring.", "",
  ].join("\n");
const sheets = buildSheets([parseScreenplay(episode(1), { episode: 1 }), parseScreenplay(episode(2), { episode: 2 })], { title: "Ring Tone", seconds: 20 });

const breakdown: Breakdown = {
  logline: "A proposal goes wrong on a rooftop.",
  characters: [{ name: "Nia", look: "cropped hair", wardrobe: "red puffer", voice: "dry", lock: "Nia: 24, cropped natural hair, red puffer" }],
  locations: [{ name: "ROOFTOP", look: "string lights", light: "sodium", lock: "A city roof under string lights" }],
  beats: [
    { title: "Hook", scenes: [1], feeling: "shock", withhold: "" },
    { title: "Second episode", scenes: [3, 4], feeling: "dread", withhold: "the ring" },
  ],
  shots: [
    { beat: 1, scene: 1, action: "Nia holds the phone over the drop.", size: "Close-up", angle: "Low", lens: "35mm", move: "crash-zoom-in", seconds: 10, dialogue: "", sound: "wind" },
    { beat: 2, scene: 4, action: "Jonah in the lift.", size: "Medium", angle: "Eye level", lens: "50mm", move: "", seconds: 10, dialogue: "", sound: "" },
  ],
};

test("the request numbers every scene across episodes and never asks for the script to be rewritten", () => {
  const request = breakdownRequest(sheets, formatById("vertical-drama"));
  assert.match(request.user, /^1\. EXT\. ROOFTOP — NIGHT \[NIA\]/m);
  assert.match(request.user, /^4\. INT\. LIFT — CONTINUOUS \[JONAH\]/m);
  assert.match(request.user, /episode 2/);
  assert.match(request.system, /Do not rewrite the script/);
  assert.match(request.system, /Hook: /);
  assert.match(request.system, /adding up to exactly 20 seconds/);
  assert.deepEqual(BREAKDOWN_SCHEMA.required, ["logline", "characters", "locations", "beats", "shots"]);
  assert.ok(!("script" in BREAKDOWN_SCHEMA.properties));
});

test("a long script is cut down scene by scene, so the last scene still goes", () => {
  const digest = sceneDigest(sheets, 400);
  assert.match(digest, /^4\. INT\. LIFT/m);
  assert.ok(digest.length < 400 + 4000);
});

test("a breakdown lays beats and shots on the uploaded scenes and keeps a lock someone already wrote", () => {
  const written = fixCell(sheets, "characters", "NIA", "lock", "Nia as I wrote her");
  const { sheets: made, problems } = applyBreakdown(written, breakdown);
  assert.deepEqual(problems, []);
  assert.deepEqual(made.story.map((b) => b.sceneIds), [["e1-s1"], ["e2-s1", "e2-s2"]]);
  assert.equal(made.shots[1]!.sceneId, "e2-s2");
  assert.equal(made.characters.find((c) => c.id === "NIA")!.lock, "Nia as I wrote her");
  assert.equal(made.characters.find((c) => c.id === "NIA")!.wardrobe, "red puffer");
  assert.equal(made.locations.find((l) => l.id === "ROOFTOP")!.lock, "A city roof under string lights");
  assert.equal(made.logline, "A proposal goes wrong on a rooftop.");
  assert.equal(made.script.length, sheets.script.length);
});

test("a reply with no beats is refused, not half-applied", () => {
  assert.throws(() => validateBreakdown({ characters: [], locations: [], shots: [] }), /no beats/);
  assert.throws(() => validateBreakdown({ beats: [{}], locations: [], shots: [] }), /no characters/);
});

test("without a key, the same request can be pasted into a chat, and its reply read back from inside a code block", () => {
  const prompt = byHandPrompt(breakdownRequest(sheets));
  assert.match(prompt, /Do not rewrite the script/);
  assert.match(prompt, /"beats":\[\{"title"/);
  assert.match(prompt, /^4\. INT\. LIFT/m);
  const reply = `Here you go:\n\`\`\`json\n${JSON.stringify(breakdown)}\n\`\`\`\nLet me know.`;
  assert.deepEqual(validateBreakdown(readReply(reply)), breakdown);
  assert.throws(() => readReply("Sorry, I can't."), /No JSON/);
  assert.throws(() => readReply('{"beats": ['), /No JSON|isn't complete/);
});

test("an addressed breakdown replaces only the target board, preserving the open board", async () => {
  const { normalizeSheets, putSheetsView, sheetsView } = await import("../sheets/sheets");
  const { applyBoardBreakdown } = await import("./board-breakdown");
  const original = applyBreakdown(sheets, breakdown).sheets;
  const all = putSheetsView(normalizeSheets(original, "open"), "target", { ...original, story: original.story.map((b) => ({ ...b, title: "Target original" })) });
  const before = structuredClone(sheetsView(all, "open"));
  const made = applyBoardBreakdown(all, "target", "open", { ...breakdown, beats: breakdown.beats.map((b) => ({ ...b, title: "Target replacement" })) });
  assert.deepEqual(sheetsView(made, "open").story, before.story);
  assert.deepEqual(sheetsView(made, "open").shots, before.shots);
  assert.equal(sheetsView(made, "target").story[0]!.title, "Target replacement");
  assert.deepEqual(made.script, all.script);
  assert.throws(() => applyBoardBreakdown(all, "target", "open", {}), /no beats/);
});

test("malformed agent beat is refused before application", () => {
  assert.throws(() => validateBreakdown({ beats: [{}], characters: [], locations: [], shots: [] }), /beats/);
});
