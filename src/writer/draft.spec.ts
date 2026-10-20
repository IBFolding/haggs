import assert from "node:assert/strict";
import { test } from "node:test";

import { formatById } from "../sheets/formats";
import { qaSheet } from "../sheets/sheets";
import { applyDraft, askClaude, draftRequest, validateDraft, type Draft } from "./draft";

const script = [
  "EXT. ROOFTOP — NIGHT", "", "NIA (24) dangles a phone over the edge.", "",
  "                        NIA", "              Say it again. I dare you.", "",
  "INT. LIFT — CONTINUOUS", "", "JONAH (25) holds the doors, out of breath.", "",
  "                        JONAH", "              I lied about the ring.", "",
].join("\n");
const draft: Draft = {
  title: "Ring Tone",
  logline: "A proposal goes wrong on a rooftop.",
  script,
  characters: [
    { name: "Nia", look: "24, cropped natural hair", wardrobe: "red puffer", voice: "dry", lock: "Nia: 24, cropped natural hair, red puffer jacket" },
    { name: "Doorman", look: "60s", wardrobe: "grey uniform", voice: "", lock: "Doorman: 60s, grey uniform" },
  ],
  locations: [{ name: "Rooftop", look: "city roof, string lights", light: "sodium orange", lock: "Rooftop with string lights over a city at night" }],
  beats: [
    { title: "Hook", scenes: [1], feeling: "shock", withhold: "" },
    { title: "Twist", scenes: [2, 9], feeling: "betrayal", withhold: "the ring" },
  ],
  shots: [
    { beat: 1, scene: 1, action: "Nia holds the phone over the drop.", size: "Close-up", angle: "Low", lens: "35mm", move: "crash-zoom-in", seconds: 3, dialogue: "NIA: Say it again.", sound: "wind" },
    { beat: 2, scene: 2, action: "Jonah in the lift, doors shaking.", size: "Medium", angle: "Eye level", lens: "50mm", move: "moonwalk", seconds: 40, dialogue: "", sound: "" },
  ],
};

test("the request tells the writer the format's beats, the screenplay rules and the camera moves", () => {
  const request = draftRequest(formatById("vertical-drama")!, "A proposal on a rooftop goes wrong", "Make Nia the lead.");
  assert.match(request.system, /Hook \(0–3s\)/);
  assert.match(request.system, /Cliffhanger \(80–90s\)/);
  assert.match(request.system, /INT\. or EXT\./);
  assert.match(request.system, /crash-zoom-in/);
  assert.match(request.user, /A proposal on a rooftop goes wrong/);
  assert.match(request.user, /Make Nia the lead\./);
  assert.ok(request.maxTokens >= 4000);
  assert.ok(draftRequest(formatById("drama-60")!, "x", "").maxTokens > request.maxTokens, "an hour needs more room than a vertical");
});

test("a draft fills every sheet, and anything it got wrong is reported rather than trusted", () => {
  const { sheets, problems } = applyDraft(validateDraft(draft), formatById("vertical-drama")!);
  assert.equal(sheets.title, "Ring Tone");
  assert.equal(sheets.format, "9:16");
  assert.equal(sheets.seconds, 90);
  assert.equal(sheets.script.length, 2);
  assert.equal(sheets.characters.find((c) => c.id === "NIA")?.lock, "Nia: 24, cropped natural hair, red puffer jacket");
  assert.ok(sheets.characters.some((c) => c.id === "DOORMAN"), "a character the script never voices is still added");
  assert.equal(sheets.locations.find((l) => l.id === "ROOFTOP")?.light, "sodium orange");
  assert.deepEqual(sheets.story.map((b) => [b.title, b.sceneIds, b.feeling]), [["Hook", ["e1-s1"], "shock"], ["Twist", ["e1-s2"], "betrayal"]]);
  assert.equal(sheets.story[1]?.withhold, "the ring");
  const [a, b] = sheets.shots;
  assert.deepEqual([a?.move, a?.size, a?.seconds, a?.sceneId], ["crash-zoom-in", "Close-up", 3, "e1-s1"]);
  assert.deepEqual([b?.move, b?.seconds], ["", 15], "an unknown move is dropped and a too-long shot is capped");
  assert.ok(problems.some((p) => /scene 9/.test(p)));
  assert.ok(problems.some((p) => /moonwalk/.test(p)));
  assert.ok(problems.some((p) => /40s/.test(p)));
  assert.ok(qaSheet(sheets).every((q) => !/no identity lock/.test(q.message) || !/NIA/.test(q.message)));
});

test("a reply that isn't a draft is refused with a reason, not half-applied", () => {
  assert.throws(() => validateDraft({ title: "x" }), /script/);
  assert.throws(() => validateDraft({ ...draft, script: "no scenes here" }), /scene/);
  assert.throws(() => validateDraft({ ...draft, beats: [] }), /beats/);
});

test("Claude is called with the key, the schema and the request, and its JSON reply is read", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(draft) }], usage: { input_tokens: 900, output_tokens: 1200 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const result = await askClaude({ key: "sk-test", request: draftRequest(formatById("vertical-drama")!, "idea", ""), fetch: fake });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.draft.title, "Ring Tone");
    assert.deepEqual(result.usage, { input: 900, output: 1200 });
  }
  assert.equal(seen?.url, "https://api.anthropic.com/v1/messages");
  const headers = seen?.init.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "sk-test");
  const body = JSON.parse(String(seen?.init.body));
  assert.ok(body.model.startsWith("claude-"));
  assert.equal(body.output_config.format.type, "json_schema");

  const refused = await askClaude({ key: "bad", request: draftRequest(formatById("vertical-drama")!, "idea", ""), fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch });
  assert.deepEqual(refused, { ok: false, reason: "Claude rejected the key. Replace it in Keys." });
});
