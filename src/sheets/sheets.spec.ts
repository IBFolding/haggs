import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { hashPrompt, promptFor } from "../story/assemble";
import { createProject } from "../story/model";
import { cameraMoves, movePrompt, MOVE_GROUPS } from "./camera";
import { parseScreenplay } from "./screenplay";
import {
  SHEETS, addBeat, addRow, addShot, alterRows, buildSheets, exportSheets, fixCell, importSheets,
  moveRow, promptForShot, qaSheet, removeRow, syncBoard, toProject,
} from "./sheets";

const sample = readFileSync(new URL("./fixtures/sheets-sample.md", import.meta.url), "utf8");

/** The item at `i`, failing the test rather than the type checker when it is missing. */
function at<T>(list: readonly T[], i: number): T {
  const item = list[i];
  assert.ok(item !== undefined, `expected an item at ${i}`);
  return item;
}

const sheetsWith = (options = {}) => buildSheets([parseScreenplay(sample)], { title: "Reel", seconds: 15, ...options });

test("a screenplay parses into titled, numbered scenes with acts, places, times and source lines", () => {
  const s = parseScreenplay(sample);
  assert.equal(s.series, "LANTERN ROAD");
  assert.equal(s.episode, 2);
  assert.equal(s.title, "The Ferry");
  assert.deepEqual(s.scenes.map((x) => x.heading), [
    "EXT. RIVER LANDING — DAWN",
    "INT. FERRY — CABIN — CONTINUOUS",
    "EXT. RIVER LANDING — NIGHT (YEARS AGO)",
    "INT. FERRY — CABIN — LATER",
  ]);
  assert.deepEqual(s.scenes.map((x) => x.id), ["e2-s1", "e2-s2", "e2-s3", "e2-s4"]);
  const [a, b, c, d] = [at(s.scenes, 0), at(s.scenes, 1), at(s.scenes, 2), at(s.scenes, 3)];
  assert.deepEqual([a.setting, a.place, a.time, a.act], ["EXT", "RIVER LANDING", "DAWN", "TEASER"]);
  assert.deepEqual([b.place, b.area, b.time, b.act], ["FERRY", "CABIN", "CONTINUOUS", "ACT ONE"]);
  assert.deepEqual([c.flash, c.time], [true, "NIGHT"]);
  assert.equal(a.from, 11);
  assert.equal(a.to, b.from - 1);
  assert.equal(d.to, s.lines);
  assert.match(a.action, /Fog on the water/);
  assert.match(a.action, /OTTO \(20\) runs down the bank/);
});

test("dialogue keeps speaker, extension and parenthetical, and characters are merged across cues", () => {
  const s = parseScreenplay(sample);
  const [a, b, d] = [at(s.scenes, 0), at(s.scenes, 1), at(s.scenes, 3)];
  assert.deepEqual(at(a.dialogue, 0), { character: "MAYA", extension: "", parenthetical: "", words: "He said dawn. It's dawn." });
  assert.deepEqual(at(a.dialogue, 1), {
    character: "OTTO", extension: "O.S.", parenthetical: "calling; out of breath", words: "Dawn is a range, not a minute!",
  });
  assert.equal(at(b.dialogue, 1).words, "I always come. Late.");
  assert.deepEqual([at(d.dialogue, 0).character, at(d.dialogue, 0).extension], ["MAYA", "CONT'D"]);
  assert.deepEqual(s.characters.map((c) => [c.name, c.lines, c.age]), [["MAYA", 3, 19], ["OTTO", 2, 20]]);
  assert.deepEqual(at(s.characters, 0).scenes, ["e2-s1", "e2-s2", "e2-s4"]);
  assert.ok(!s.characters.some((c) => /SMASH|FADE|TEASER|ACT/.test(c.name)));
});

test("scripts without indentation and with Windows line endings parse the same way", () => {
  const flat = sample.split("\n").map((line) => line.trimStart()).join("\r\n");
  const s = parseScreenplay(flat);
  assert.equal(s.scenes.length, 4);
  assert.equal(at(at(s.scenes, 0).dialogue, 1).character, "OTTO");
  assert.equal(at(at(s.scenes, 1).dialogue, 1).words, "I always come. Late.");
});

test("an opening with no heading, a non-INT/EXT slugline and montage items all land in scenes", () => {
  const s = parseScreenplay([
    "SHOW", "", "TEASER", "", "FADE IN:", "", "LIGHT.", "", "MAYA walks out of it.", "",
    "                        MAYA", "              Hello.", "", "ACT ONE", "",
    "NOWHERE — A PLACE MADE OF MEMORY", "", "The tide brings moments.", "",
    "— INT. LARK HOUSE: Anna folding laundry,", "  the window light going strange.", "", "EXT. DOCK — DAY", "", "Rain.",
  ].join("\n"));
  assert.deepEqual(s.scenes.map((x) => [x.heading, x.act, x.place]), [
    ["TEASER", "TEASER", ""],
    ["NOWHERE — A PLACE MADE OF MEMORY", "ACT ONE", ""],
    ["EXT. DOCK — DAY", "ACT ONE", "DOCK"],
  ]);
  const [opening, nowhere] = [at(s.scenes, 0), at(s.scenes, 1)];
  assert.equal(opening.from, 7);
  assert.equal(opening.action, "LIGHT. MAYA walks out of it.");
  assert.equal(at(opening.dialogue, 0).words, "Hello.");
  assert.match(nowhere.action, /INT\. LARK HOUSE: Anna folding laundry/);
  assert.equal(nowhere.area, "NOWHERE — A PLACE MADE OF MEMORY");

  const plank = parseScreenplay(
    ["EXT. HILL — DUSK", "", "                    ELLIS WARD. HE KEPT THE", "            APPOINTMENTS", "", "                        DR. HALE", "              Hm."].join("\n"),
  );
  assert.deepEqual(plank.characters.map((c) => c.name), ["DR. HALE"]);
});

test("parsing rejects files that are not screenplays and oversized input", () => {
  assert.throws(() => parseScreenplay("just some notes\nwith no scenes"), /scene heading/);
  assert.throws(() => parseScreenplay("x".repeat(3_000_001)), /3 MB/);
  assert.throws(() => parseScreenplay(42), /text/);
});

test("the seven sheets are built from several episodes in order, with characters and locations merged", () => {
  const ep1 = sample.replace('Episode 2 — "The Ferry"', 'Episode 1 — "The Landing"');
  const sh = buildSheets([parseScreenplay(sample), parseScreenplay(ep1)], { title: "Lantern Road reel", seconds: 30 });
  assert.deepEqual(SHEETS.map((s) => s.id), ["script", "story", "characters", "locations", "shots", "prompts", "qa"]);
  assert.deepEqual(sh.sources.map((s) => s.episode), [1, 2]);
  assert.equal(at(sh.script, 0).id, "e1-s1");
  assert.equal(sh.script.length, 8);
  assert.deepEqual(sh.characters.map((c) => c.name), ["MAYA", "OTTO"]);
  assert.equal(at(sh.characters, 0).scenes.length, 6);
  assert.deepEqual(sh.locations.map((l) => [l.name, l.setting]), [["RIVER LANDING", "EXT"], ["FERRY", "INT"]]);
  assert.deepEqual(at(sh.locations, 1).areas, ["CABIN"]);
  for (const c of sh.characters) assert.deepEqual([c.look, c.wardrobe, c.voice, c.lock, c.never], ["", "", "", "", ""]);
  assert.deepEqual(sh.story, []);
  assert.deepEqual(sh.shots, []);
  assert.throws(() => buildSheets([parseScreenplay(sample), parseScreenplay(sample)]), /same episode/);
});

test("beats come from scenes and shots come from beats, carrying the scene's cast, place and words", () => {
  let sh = addBeat(sheetsWith(), { title: "She waits", sceneIds: ["e2-s1"] });
  const beat = at(sh.story, 0);
  assert.equal(beat.title, "She waits");
  assert.equal(beat.source, "Ep 2, lines 11–30");
  sh = addShot(sh, beat.id, { seconds: 5, move: "dolly-in" });
  const shot = at(sh.shots, 0);
  assert.equal(shot.beatId, beat.id);
  assert.equal(shot.sceneId, "e2-s1");
  assert.deepEqual(shot.characters, ["MAYA", "OTTO"]);
  assert.equal(shot.location, "RIVER LANDING");
  assert.equal(shot.dialogue, "MAYA: He said dawn. It's dawn.\nOTTO (O.S.): Dawn is a range, not a minute!");
  assert.match(shot.action, /Fog on the water/);
  assert.throws(() => addShot(sh, "missing"), /beat/);
  assert.throws(() => addBeat(sh, { title: "x", sceneIds: ["nope"] }), /scene/);
});

test("the prompt is derived from the shot, its identity locks, its place and its camera move", () => {
  let sh = sheetsWith({ style: "35mm film, warm dawn haze" });
  sh = addBeat(sh, { title: "Waiting", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id, { move: "dolly-in", size: "Wide", action: "Maya on the dock at dawn, lantern in hand." });
  sh = fixCell(sh, "characters", "MAYA", "lock", "Maya: 19, dark curly hair, green raincoat");
  sh = fixCell(sh, "locations", "RIVER LANDING", "lock", "Wooden dock, grey river, fog");
  const p = promptForShot(sh, at(sh.shots, 0));
  assert.match(p, /^Wide shot\. Maya on the dock at dawn, lantern in hand\./);
  assert.match(p, /Maya: 19, dark curly hair, green raincoat/);
  assert.match(p, /Wooden dock, grey river, fog/);
  assert.ok(p.includes(movePrompt("dolly-in")));
  assert.match(p, /35mm film, warm dawn haze/);
  assert.ok(!/OTTO/.test(p), "a character with no lock adds nothing to the prompt");
  assert.ok(p.length <= 4000);
});

test("fix, add, remove, move and alter edit the sheets without mutating the input", () => {
  let sh = sheetsWith();
  const before = structuredClone(sh);
  const fixed = fixCell(sh, "characters", "OTTO", "look", "tall, rain-soaked");
  assert.equal(at(fixed.characters, 1).look, "tall, rain-soaked");
  assert.deepEqual(sh, before);
  assert.throws(() => fixCell(sh, "characters", "OTTO", "id", "X"), /cannot be changed/);
  assert.throws(() => fixCell(sh, "nope", "OTTO", "look", "x"), /sheet/);
  assert.throws(() => fixCell(sh, "characters", "NOBODY", "look", "x"), /row/);

  sh = addRow(sh, "characters", { name: "ferryman" });
  const added = at(sh.characters, sh.characters.length - 1);
  assert.deepEqual([added.name, added.id, added.lock], ["FERRYMAN", "FERRYMAN", ""]);
  assert.throws(() => addRow(sh, "characters", { name: "MAYA" }), /already/);

  sh = addBeat(sh, { title: "One", sceneIds: ["e2-s1"] });
  sh = addBeat(sh, { title: "Two", sceneIds: ["e2-s2"] });
  sh = moveRow(sh, "story", at(sh.story, 1).id, 0);
  assert.deepEqual(sh.story.map((b) => b.title), ["Two", "One"]);
  sh = addShot(sh, at(sh.story, 0).id);
  sh = addShot(sh, at(sh.story, 1).id);
  sh = alterRows(sh, "shots", sh.shots.map((s) => s.id), { move: "crane-up", seconds: 10 });
  assert.ok(sh.shots.every((s) => s.move === "crane-up" && s.seconds === 10));
  const first = at(sh.shots, 0).id;
  assert.throws(() => alterRows(sh, "shots", [first], { move: "moonwalk" }), /camera move/);
  assert.throws(() => alterRows(sh, "shots", [first], { seconds: 40 }), /0.5–15/);

  sh = removeRow(sh, "story", at(sh.story, 0).id);
  assert.equal(sh.story.length, 1);
  assert.equal(sh.shots.length, 1, "removing a beat removes its shots");
  assert.throws(() => fixCell(sh, "prompts", "x", "text", "y"), /derived/);
  assert.throws(() => addRow(sh, "qa", {}), /derived/);
  assert.throws(() => removeRow(sh, "script", "e2-s1"), /stay on the sheet/);
});

test("QA reports what would make a bad reel before anything is spent", () => {
  let sh = sheetsWith({ rules: ["lantern goes out"] });
  assert.ok(qaSheet(sh).some((q) => q.level === "error" && /No shots/.test(q.message)));
  sh = addBeat(sh, { title: "Waiting", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id, { seconds: 5, action: "The lantern goes out on the water." });
  const q = qaSheet(sh);
  const messages = q.map((x) => x.message).join("\n");
  assert.match(messages, /MAYA has no identity lock/);
  assert.match(messages, /RIVER LANDING has no look lock/);
  assert.match(messages, /runs 5s of the 15s target/);
  assert.match(messages, /withheld: "lantern goes out"/);
  assert.match(messages, /dialogue.*lip-sync/i);
  assert.ok(q.every((x) => ["error", "warn"].includes(x.level) && SHEETS.some((s) => s.id === x.sheet)));
});

test("the sheets open as a board project whose shots carry the cast, the locks and the camera move", () => {
  let sh = sheetsWith({ title: "Lantern reel", style: "35mm film" });
  sh = fixCell(sh, "characters", "MAYA", "lock", "Maya: 19, green raincoat");
  sh = fixCell(sh, "locations", "RIVER LANDING", "lock", "Wooden dock, fog");
  sh = fixCell(sh, "locations", "RIVER LANDING", "light", "Cold dawn");
  sh = addBeat(sh, { title: "Waiting", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id, { seconds: 10, move: "dolly-in", size: "Wide", blocking: "Maya on the dock edge" });
  sh = addBeat(sh, { title: "Facing each other", sceneIds: ["e2-s2"] });
  sh = addShot(sh, at(sh.story, 1).id, { seconds: 5, move: "static" });

  const p = toProject(sh);
  assert.equal(p.name, "Lantern reel");
  assert.equal(p.shots.length, 2);
  assert.equal(p.direction.constants, "35mm film");
  const a = at(p.shots, 0);
  assert.deepEqual([a.heading, a.seconds, a.model.id], ["EXT. RIVER LANDING — DAWN", 10, "minimax/minimax-h3"]);
  assert.match(a.beat, /Fog on the water/);
  const camera = a.direction?.camera ?? "";
  assert.match(camera, /^Wide shot\. /);
  assert.ok(camera.includes(movePrompt("dolly-in").replace(/^Camera: /, "")));
  assert.equal(a.direction?.staging, "Maya on the dock edge");
  assert.equal(a.direction?.light, "Cold dawn");
  assert.match(a.direction?.constants ?? "", /Maya: 19, green raincoat/);
  assert.match(a.direction?.constants ?? "", /Wooden dock, fog/);
  assert.deepEqual(p.threads.map((t) => [t.name, t.kind]), [["MAYA", "character"], ["OTTO", "character"]]);
  assert.deepEqual(a.threadIds, p.threads.map((t) => t.id));
  assert.equal(p.source?.templateId, "script-sheets");
  assert.match(promptFor(p, 1), /Continues from: EXT\. RIVER LANDING/);
  assert.throws(() => toProject(sheetsWith()), /shot/);
});

test("sending to an existing board updates linked shots in place and keeps their renders", () => {
  let sh = sheetsWith();
  sh = addBeat(sh, { title: "One", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id, { seconds: 5 });
  sh = addBeat(sh, { title: "Two", sceneIds: ["e2-s2"] });
  sh = addShot(sh, at(sh.story, 1).id, { seconds: 5 });
  const first = syncBoard(createProject("Mine"), sh);
  assert.deepEqual([first.added, first.updated, first.removed, first.kept], [2, 0, 0, 0]);
  assert.equal(first.project.name, "Mine", "the project keeps its own name");

  // Render shot 1 on the board, add a hand-made shot, then change the sheets.
  const board = structuredClone(first.project);
  const one = at(board.shots, 0);
  one.render = { url: "u", kind: "video", usd: 0.4, promptHash: hashPrompt(promptFor(board, 0)), at: 1 };
  one.locked = true;
  board.shots.push({ id: "manual", heading: "INSERT", beat: "A hand", threadIds: [], seconds: 2, model: { id: "x", settings: {} } });
  sh = fixCell(sh, "shots", at(sh.shots, 0).id, "action", "Maya alone at dawn.");
  sh = removeRow(sh, "story", at(sh.story, 1).id);
  sh = addBeat(sh, { title: "Three", sceneIds: ["e2-s4"] });
  sh = addShot(sh, at(sh.story, 1).id, { seconds: 3 });

  const next = syncBoard(board, sh);
  assert.deepEqual([next.added, next.updated, next.removed, next.kept], [1, 1, 1, 0]);
  const shots = next.project.shots;
  assert.deepEqual(shots.map((s) => s.heading), ["EXT. RIVER LANDING — DAWN", "INT. FERRY — CABIN — LATER", "INSERT"]);
  assert.equal(at(shots, 0).id, one.id);
  assert.equal(at(shots, 0).beat, "Maya alone at dawn.");
  assert.equal(at(shots, 0).render?.url, "u", "a render survives a re-send");
  assert.equal(at(shots, 0).locked, true);
  assert.equal(at(shots, 2).id, "manual", "shots made on the board are left alone");
  assert.deepEqual(board.shots.length, 3, "the input project is not mutated");
});

test("a linked shot that has a render is kept, not deleted, when its row is removed", () => {
  let sh = addBeat(sheetsWith(), { title: "One", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id);
  const board = syncBoard(createProject("p"), sh).project;
  at(board.shots, 0).render = { url: "u", kind: "image", usd: null, promptHash: "h", at: 1 };
  const next = syncBoard(board, removeRow(sh, "story", at(sh.story, 0).id));
  assert.deepEqual([next.removed, next.kept], [0, 1]);
  assert.equal(next.project.shots.length, 1);
  assert.equal(next.project.shots[0]?.sheetShotId, undefined, "it is unlinked so it reads as a board shot now");
});

test("sheets export and import as JSON and reject a wrong file", () => {
  const sh = addBeat(sheetsWith(), { title: "A", sceneIds: ["e2-s1"] });
  assert.deepEqual(importSheets(exportSheets(sh)), sh);
  assert.throws(() => importSheets('{"version":9}'), /sheet file/);
  assert.throws(() => importSheets("nope"), /sheet file/);
  assert.throws(() => importSheets("x".repeat(5_000_001)), /5 MB/);
});

test("the camera picker offers the named cinematic moves as prompt direction only", () => {
  assert.ok(cameraMoves.length >= 60);
  assert.equal(new Set(cameraMoves.map((m) => m.id)).size, cameraMoves.length);
  for (const name of ["Static", "Dolly In", "Crash Zoom In", "Crane Up", "Bullet Time", "360 Orbit", "FPV Drone", "Snorricam", "Dolly Zoom In", "Whip Pan", "Through Object In", "Lazy Susan"]) {
    assert.ok(cameraMoves.some((m) => m.label === name), name);
  }
  for (const m of cameraMoves) {
    assert.ok(m.prompt.length > 20 && m.prompt.length < 300, m.id);
    assert.ok(MOVE_GROUPS.includes(m.group), m.id);
    assert.ok(!/higgsfield/i.test(m.prompt));
  }
  assert.throws(() => movePrompt("moonwalk"), /camera move/);
  assert.equal(movePrompt(""), "");
});

test("each board keeps its own beats and shots while characters and places stay shared", async () => {
  const { normalizeSheets, putSheetsView, sheetsView } = await import("./sheets");
  let sh = addBeat(sheetsWith({ title: "Series" }), { title: "Old beat", sceneIds: ["e2-s1"] });
  sh = normalizeSheets(sh, "main");
  assert.deepEqual(sh.story, [], "legacy beats move onto the first board");
  assert.deepEqual(sheetsView(sh, "main").story.map((b) => b.title), ["Old beat"]);

  let ep = sheetsView(sh, "ep1", { title: "Episode 1", seconds: 30 });
  assert.deepEqual([ep.title, ep.seconds, ep.story.length], ["Episode 1", 30, 0]);
  ep = addBeat(ep, { title: "Ferry", sceneIds: ["e2-s2"] });
  ep = addShot(ep, at(ep.story, 0).id);
  ep = fixCell(ep, "characters", "MAYA", "lock", "green raincoat");
  sh = putSheetsView(sh, "ep1", ep);

  assert.equal(at(sh.characters, 0).lock, "green raincoat", "a lock fixed on one board shows on every board");
  assert.equal(sheetsView(sh, "main").characters[0]?.lock, "green raincoat");
  assert.deepEqual(sheetsView(sh, "main").story.map((b) => b.title), ["Old beat"]);
  assert.deepEqual(sheetsView(sh, "ep1").story.map((b) => b.title), ["Ferry"]);
  assert.equal(sheetsView(sh, "ep1").title, "Episode 1");
  assert.equal(sh.title, "Series", "the series title is not overwritten by a board's");
  assert.deepEqual(importSheets(exportSheets(sh)), sh);
});

test("reference pictures on characters and places travel to every shot they are in, and become the character's face", () => {
  let sh = addBeat(sheetsWith(), { title: "Dock", sceneIds: ["e2-s1"] });
  sh = addShot(sh, at(sh.story, 0).id);
  sh = fixCell(sh, "characters", "MAYA", "refs", ["maya-front.png", "maya-side.png"]);
  sh = fixCell(sh, "locations", "RIVER LANDING", "refs", ["dock.png"]);
  const p = syncBoard(createProject("p"), sh).project;
  assert.deepEqual(p.shots[0]?.refs, ["maya-front.png", "dock.png"], "one picture per character, then the place");
  assert.equal(p.threads.find((t) => t.name === "MAYA")?.ref, "maya-front.png");
  assert.equal(p.threads.find((t) => t.name === "OTTO")?.ref, undefined);
  assert.throws(() => fixCell(sh, "characters", "MAYA", "refs", "nope"), /pictures/);
  const cleared = syncBoard(p, fixCell(sh, "characters", "MAYA", "refs", [])).project;
  assert.equal(cleared.threads.find((t) => t.name === "MAYA")?.ref, undefined, "removing the reference removes the face");
});
