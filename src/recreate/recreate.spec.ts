import assert from "node:assert/strict";
import { test } from "node:test";

import { ANALYSIS_PROMPT, buildRecreation, parseShots } from "./recreate";

const reply = `Here is the breakdown:
\`\`\`json
[
 {"start": 0, "end": 1.2, "what": "A woman in a leather jacket walks toward camera on a street", "camera": "handheld push-in", "text": "WALK", "transition": "cut"},
 {"start": 1.2, "end": 2.0, "what": "Close-up of a star pendant on a chain", "camera": "static", "text": "", "transition": "flash"},
 {"start": 2.0, "end": 2.1, "what": "glitch", "camera": "", "text": "", "transition": "cut"},
 {"start": 2.1, "end": 4.5, "what": "She turns and looks back over her shoulder", "camera": "slow orbit", "text": "THIS ONE", "transition": "whip"}
]
\`\`\``;

test("the analysis asks for every shot as JSON with times, subject, camera, on-screen words and the cut", () => {
  for (const word of ["JSON", "start", "end", "camera", "text", "transition"]) assert.match(ANALYSIS_PROMPT, new RegExp(word));
});

test("a reply is read into shots: JSON found in the chatter, times clamped, flicker merged into the shot before", () => {
  const shots = parseShots(reply, 4.5);
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((s) => [s.start, s.end]), [[0, 1.2], [1.2, 2.1], [2.1, 4.5]]);
  assert.equal(shots[0]!.text, "WALK");
  assert.equal(shots[2]!.camera, "slow orbit");
  assert.ok(shots.every((s) => s.seconds > 0.3));
});

test("a reply with no shots in it is an error that says so", () => {
  assert.throws(() => parseShots("I can't see a video.", 5), /shots/i);
  assert.throws(() => parseShots("[]", 5), /shots/i);
  assert.throws(() => parseShots("[{\"start\":\"a\"}]", 5), /shots/i);
});

test("the recreation is a board with one shot per reference shot, same lengths, your person in each, the words kept", () => {
  const shots = parseShots(reply, 4.5);
  const p = buildRecreation("Walk edit", shots, { lock: "Maya: a 30-year-old woman, braided hair", instructions: "Set it in Tokyo at night", refs: ["/sheet.png"], aspect: "9:16" });
  const b = p.boards![0]!;
  assert.equal(b.shots.length, 3);
  assert.equal(b.aspect, "9:16");
  assert.deepEqual(b.shots.map((s) => s.seconds), shots.map((s) => Math.round(s.seconds * 10) / 10));
  assert.match(b.shots[0]!.beat, /Maya/);
  assert.match(b.shots[0]!.beat, /Tokyo at night/);
  assert.match(b.shots[0]!.beat, /handheld push-in/);
  assert.equal(b.shots[0]!.caption, "WALK");
  assert.deepEqual(b.shots[0]!.refs, ["/sheet.png"]);
  assert.equal(b.shots[1]!.caption, undefined);
});
