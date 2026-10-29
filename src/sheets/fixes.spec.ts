import assert from "node:assert/strict";
import { test } from "node:test";

import { fitRuntime, fixAll, fixesFor, trimAction } from "./fixes";
import { parseScreenplay } from "./screenplay";
import { addBeat, addShot, buildSheets, fixCell, promptForShot, qaSheet, runtime, type Sheets } from "./sheets";

const script = ["EXT. ROOFTOP — NIGHT", "", "NIA (24) dangles a phone over the edge.", "", "                        NIA", "              Say it again.", ""].join("\n");

function reel(seconds: number, lengths: number[]): Sheets {
  let sheets = buildSheets([parseScreenplay(script)], { seconds });
  sheets = addBeat(sheets, { sceneIds: [sheets.script[0]!.id] });
  const beat = sheets.story[0]!.id;
  for (const s of lengths) sheets = addShot(sheets, beat, { seconds: s, action: "Nia on the edge." });
  return sheets;
}

test("fitting the runtime lands exactly on the target, on whole frames, inside 0.5–15s", () => {
  for (const [target, lengths] of [[30, [5, 5, 5]], [20, [3, 7, 12, 1]], [7, [15, 15]], [61, [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]]] as const) {
    const fitted = fitRuntime(reel(target, [...lengths]))!;
    assert.equal(runtime(fitted), target);
    for (const s of fitted.shots) {
      assert.ok(s.seconds >= 0.5 && s.seconds <= 15);
      assert.equal(Math.round(s.seconds * 30), s.seconds * 30);
    }
  }
});

test("a target the shots can't reach can't be fitted, but can be moved to what the shots run", () => {
  const sheets = reel(120, [5, 5]);
  assert.equal(fitRuntime(sheets), null);
  const finding = qaSheet(sheets).find((f) => f.code === "runtime")!;
  const fixes = fixesFor(sheets, finding);
  assert.deepEqual(fixes.map((f) => f.label), ["Make the target 10s"]);
  assert.equal(fixes[0]!.apply(sheets).seconds, 10);
  // Fix what I can leaves an unreachable target to the person.
  assert.equal(fixAll(sheets, qaSheet(sheets)).sheets.seconds, 120);
});

test("a prompt that is too long loses sentences from the end of its action until it fits", () => {
  let sheets = reel(10, [10]);
  const id = sheets.shots[0]!.id;
  sheets = fixCell(sheets, "shots", id, "action", Array.from({ length: 70 }, (_, i) => `Sentence ${i} goes on about the rooftop and the wind and the phone.`).join(" ").slice(0, 3990));
  sheets = fixCell(sheets, "shots", id, "blocking", "Nia at the edge, Jonah in the doorway behind her.");
  assert.ok(qaSheet(sheets).some((f) => f.code === "long-prompt"));
  const trimmed = trimAction(sheets, id);
  assert.ok(promptForShot(trimmed, trimmed.shots[0]!).length < 4000);
  assert.match(trimmed.shots[0]!.action, /^Sentence 0 /);
  assert.match(trimmed.shots[0]!.action, /\.$/);
});

test("a missing lock is written from the look already on the sheet, and a shot with no action takes its scene's", () => {
  let sheets = reel(5, [5]);
  const id = sheets.shots[0]!.id;
  sheets = fixCell(sheets, "shots", id, "characters", ["NIA"]);
  sheets = fixCell(sheets, "characters", "NIA", "look", "cropped natural hair");
  sheets = fixCell(sheets, "characters", "NIA", "wardrobe", "red puffer");
  sheets = fixCell(sheets, "shots", id, "action", "");
  const { sheets: fixed, fixed: count } = fixAll(sheets, qaSheet(sheets));
  assert.equal(count, 2);
  assert.equal(fixed.characters.find((c) => c.id === "NIA")!.lock, "24 years old. cropped natural hair. red puffer");
  assert.match(fixed.shots[0]!.action, /dangles a phone/);
  assert.ok(!qaSheet(fixed).some((f) => f.code === "no-lock" || f.code === "no-action"));
});

test("dialogue can be moved to sound only when the person asks", () => {
  let sheets = reel(5, [5]);
  const id = sheets.shots[0]!.id;
  sheets = fixCell(sheets, "shots", id, "dialogue", "NIA: Say it again.");
  const finding = qaSheet(sheets).find((f) => f.code === "dialogue")!;
  assert.equal(fixAll(sheets, [finding]).fixed, 0);
  const moved = fixesFor(sheets, finding)[0]!.apply(sheets).shots[0]!;
  assert.equal(moved.dialogue, "");
  assert.match(moved.sound, /Voice: “NIA: Say it again\.”/);
});
