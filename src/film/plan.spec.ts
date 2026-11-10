import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeWorld, validateWorld } from "../worlds/spec";
import { filmCameraAt, filmManifest, filmShotAt, filmWorld, makeFilmDocument, validateFilmDocument } from "./plan";

describe("Haggs Film Engine scene → film pipeline", () => {
  it("creates deterministic eight-shot 60s films with frame-exact continuity", () => {
    const world = makeWorld("aether", 512);
    const doc = makeFilmDocument(world);
    assert.equal(doc.shots.length, 8);
    assert.equal(doc.duration, 60);
    assert.equal(doc.fps, 24);
    assert.equal(doc.shots[0]?.start, 0);
    assert.equal(doc.shots[7]?.end, 60);
    assert.deepEqual(doc, makeFilmDocument(world));
    assert.ok(validateFilmDocument(doc));
    assert.ok(validateWorld(filmWorld(doc)));
    for (let i = 0; i < doc.shots.length; i++) {
      const shot = doc.shots[i]!;
      assert.ok(Math.round(shot.start * 24) === shot.start * 24);
      assert.ok(Math.round(shot.end * 24) === shot.end * 24);
      if (i) assert.equal(doc.shots[i - 1]!.end, shot.start);
      assert.deepEqual(filmCameraAt(shot, shot.start).position, shot.from);
      assert.deepEqual(filmCameraAt(shot, shot.end).position, shot.to);
    }
  });

  it("validates visual changes and never treats plans as completed renders", () => {
    const doc = makeFilmDocument(makeWorld("dunes", 2), 60, [{name:"Approach",beat:"Track toward the ancient arch.",seconds:8,lensMm:48}]);
    assert.equal(doc.shots.length, 1);
    assert.equal(doc.shots[0]?.name, "Approach");
    const manifest = filmManifest(doc);
    assert.equal(manifest.state, "planned-not-rendered");
    assert.equal(manifest.shots[0]?.lensMm, 48);
    assert.equal(filmShotAt(doc, 0).id, "S01");
    assert.equal(filmShotAt(doc, 60).id, "S01");
    assert.ok(validateFilmDocument(doc));
    const changed = JSON.parse(JSON.stringify(doc));
    changed.shots[0].end = 59.2;
    assert.equal(validateFilmDocument(changed), false);
    const invalid = JSON.parse(JSON.stringify(doc));
    invalid.shots[0].review = "inference-finished";
    assert.equal(validateFilmDocument(invalid), false);
  });

  it("safely constrains shot count, lens and total running time", () => {
    const tooMany = Array.from({length:55}, (_,i)=>({name:`Shot ${i}`,beat:"Steady camera orbit",seconds:1,lensMm:500}));
    const doc = makeFilmDocument(makeWorld("neon",44), 110, tooMany);
    assert.equal(doc.shots.length, 16);
    assert.ok(doc.shots.every(s => s.lensMm <= 120 && s.start < s.end));
    assert.equal(doc.shots[15]?.end, 110);
    assert.ok(validateFilmDocument(doc));
  });
});
