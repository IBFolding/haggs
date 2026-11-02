import assert from "node:assert/strict";
import { test } from "node:test";

import type { Sheets } from "../sheets/sheets";
import { createProject, newShot, type Project } from "./model";
import type { PictureRun as Run } from "./runs";
import { saveRun } from "./save-run";

const run: Run = { id: "r1", modelId: "flux3", modelName: "FLUX 3", prompt: "Rowan at the river, laughing", settings: {}, url: "/api/local/r1.png", kind: "image", usd: 0.1, at: 5 };

function project(): Project {
  return { ...createProject("W"), boards: [{ id: "b1", name: "Sizzle", kind: "reel", shots: [{ ...newShot(), id: "s1", beat: "River" }], notes: [] }] };
}
function sheets(): Sheets {
  return {
    version: 1, title: "W", logline: "", seconds: 60, format: "16:9", style: "", rules: [], sources: [], script: [], story: [], shots: [],
    characters: [{ id: "ROWAN", name: "Rowan", aliases: [], age: 25, lines: 3, scenes: [], look: "", wardrobe: "", voice: "", lock: "", never: "", refs: ["/api/local/old-face.png"] }],
    locations: [{ id: "RIVERSIDE", name: "Riverside", setting: "EXT", areas: [], scenes: [], look: "", light: "", lock: "" }],
  };
}

test("saved as a take, it goes on the shot and into Media", () => {
  const out = saveRun(project(), null, run, { as: "take", boardId: "b1", shotId: "s1" });
  const shot = out.project.boards![0]!.shots[0]!;
  assert.equal(shot.render!.url, run.url);
  assert.equal(shot.takes!.at(-1)!.usd, 0.1);
  assert.equal(out.project.media!.length, 1);
  assert.equal(out.project.media![0]!.shotId, "s1");
  assert.match(out.message, /take on Sizzle/);
});

test("saved as a new shot, it starts a shot at the end of the board", () => {
  const out = saveRun(project(), null, run, { as: "new-shot", boardId: "b1" });
  const shots = out.project.boards![0]!.shots;
  assert.equal(shots.length, 2);
  assert.equal(shots[1]!.render!.url, run.url);
  assert.equal(shots[1]!.beat, "Rowan at the river, laughing");
});

test("saved as a character reference, it joins their pictures; as their face, it goes first", () => {
  const added = saveRun(project(), sheets(), run, { as: "character", id: "ROWAN" });
  assert.deepEqual(added.sheets!.characters[0]!.refs, ["/api/local/old-face.png", run.url]);
  assert.equal(added.project.media![0]!.status, "reference");
  const face = saveRun(project(), sheets(), run, { as: "character", id: "ROWAN", face: true });
  assert.deepEqual(face.sheets!.characters[0]!.refs, [run.url, "/api/local/old-face.png"]);
});

test("saved as a place reference, and saving the same picture twice keeps one copy", () => {
  const once = saveRun(project(), sheets(), run, { as: "place", id: "RIVERSIDE" });
  const twice = saveRun(once.project, once.sheets, run, { as: "place", id: "RIVERSIDE" });
  assert.deepEqual(twice.sheets!.locations[0]!.refs, [run.url]);
  assert.equal(twice.project.media!.length, 1);
});

test("a reference needs the project's sheets, and a full set of eight is refused", () => {
  assert.throws(() => saveRun(project(), null, run, { as: "character", id: "ROWAN" }), /sheets/);
  const full = sheets();
  full.characters[0]!.refs = Array.from({ length: 8 }, (_, i) => `/api/local/${i}.png`);
  assert.throws(() => saveRun(project(), full, run, { as: "character", id: "ROWAN" }), /eight/);
  assert.throws(() => saveRun(project(), sheets(), run, { as: "character", id: "NOBODY" }), /isn't on/);
});

test("kept in Media only, nothing else changes", () => {
  const out = saveRun(project(), null, { ...run, kind: "video", url: "/api/local/r1.mp4" }, { as: "media" });
  assert.equal(out.project.media![0]!.kind, "video");
  assert.equal(out.project.boards![0]!.shots[0]!.render, undefined);
});

test("a picture starts a new project: one board, its first shot showing the picture", async () => {
  const { projectFrom } = await import("./save-run");
  const p = projectFrom({ ...run, prompt: "A lighthouse keeper's ghost on the rocks, storm light" });
  assert.equal(p.name, "A lighthouse keeper's ghost on the rocks");
  assert.equal(p.boards!.length, 1);
  const shot = p.boards![0]!.shots[0]!;
  assert.equal(shot.render!.url, run.url);
  assert.match(shot.beat, /lighthouse/);
  assert.equal(p.media![0]!.url, run.url);
});

import {chooseTake} from "./takes";
test("saving a workflow result as a take preserves the previous Grey setup and trim",()=>{
 const p=project(),old=p.boards![0]!.shots[0]!;
 old.render={url:"/api/local/old.mp4",kind:"video",usd:0,at:1,promptHash:"old"};
 old.trimIn=2;old.greyScene={source:{url:old.render.url,kind:"video",trimIn:2},space:{floor:"wood",wall:"plaster"}};
 const before=JSON.stringify(p);
 const result=saveRun(p,null,run,{as:"take",boardId:"b1",shotId:"s1"});
 const shot=result.project.boards![0]!.shots[0]!;
 assert.equal(shot.greyScene,undefined);assert.equal(shot.trimIn,0);
 const restored=chooseTake(shot,shot.takes![0]!.id);
 assert.deepEqual(restored.greyScene,old.greyScene);assert.equal(restored.trimIn,2);
 assert.equal(result.project.media![0]!.url,run.url);assert.equal(JSON.stringify(p),before);
});
