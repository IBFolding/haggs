import assert from "node:assert/strict";
import { test } from "node:test";

import { createProject } from "../story/model";
import { parseScreenplay } from "./screenplay";
import { addBeat, addShot, buildSheets } from "./sheets";
import { scriptCard, shelf } from "./shelf";

const script = ["EXT. ROOFTOP — NIGHT", "", "NIA (24) dangles a phone over the edge.", "", "                        NIA", "              Say it again.", ""].join("\n");

function written(title: string) {
  let sheets = buildSheets([parseScreenplay(script)], { title, seconds: 10, logline: "A proposal goes wrong." });
  sheets = addBeat(sheets, { sceneIds: [sheets.script[0]!.id] });
  sheets = addShot(sheets, sheets.story[0]!.id, { seconds: 4, action: "Nia on the edge." });
  return sheets;
}

test("a project with a script becomes a card counting its scenes, cast, beats and shots", () => {
  const project = createProject("Ring Tone");
  const card = scriptCard(project, written("Ring Tone"))!;
  assert.deepEqual(
    { scenes: card.scenes, characters: card.characters, places: card.places, beats: card.beats, shots: card.shots, seconds: card.seconds, target: card.target },
    { scenes: 1, characters: 1, places: 1, beats: 1, shots: 1, seconds: 4, target: 10 },
  );
  assert.equal(card.logline, "A proposal goes wrong.");
  assert.equal(scriptCard(project, null), null);
});

test("the shelf is newest first and searches titles, loglines and cast", () => {
  const old = { ...createProject("Old one"), updatedAt: 1 };
  const fresh = { ...createProject("Fresh one"), updatedAt: 2 };
  const blank = createProject("No script");
  const entries = [{ project: old, sheets: written("Ring Tone") }, { project: fresh, sheets: written("Night Bus") }, { project: blank, sheets: null }];
  assert.deepEqual(shelf(entries).map((c) => c.title), ["Night Bus", "Ring Tone"]);
  assert.deepEqual(shelf(entries, "ring").map((c) => c.title), ["Ring Tone"]);
  assert.equal(shelf(entries, "nia rooftop").length, 2);
  assert.equal(shelf(entries, "dragon").length, 0);
});
