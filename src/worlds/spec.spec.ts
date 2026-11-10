import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cameraAt, fromWorldPrompt, makeWorld, PRESETS, shotAt, validateWorld } from "./spec";

describe("Haggs Worlds — shared 3D and film contract", () => {
  it("creates deterministic 3D worlds for all three environments", () => {
    for (const preset of PRESETS) {
      const first = makeWorld(preset, 2026);
      const second = makeWorld(preset, 2026);
      assert.deepEqual(first, second);
      assert.ok(first.objects.length >= 3);
      assert.ok(validateWorld(first));
    }
  });
  it("keeps a continuous film timeline with camera positions at exact endpoints", () => {
    const w = makeWorld();
    assert.equal(w.film.fps, 24);
    assert.equal(w.film.duration, 10);
    assert.equal(w.film.shots.length, 3);
    assert.equal(w.film.shots[0]?.start, 0);
    assert.equal(w.film.shots.at(-1)?.end, 10);
    assert.equal(w.film.fps * w.film.duration, 240);
    for (const shot of w.film.shots) {
      assert.deepEqual(cameraAt(shot, shot.start).position, shot.from);
      assert.deepEqual(cameraAt(shot, shot.end).position, shot.to);
    }
    assert.equal(shotAt(w, 3.5).id, "S02");
    assert.equal(shotAt(w, 10).id, "S03");
  });
  it("uses keyword matching only to pick an offline preset", () => {
    assert.equal(fromWorldPrompt("a neon city under rain").preset, "neon");
    assert.equal(fromWorldPrompt("desert ruins at dawn").preset, "dunes");
    assert.equal(fromWorldPrompt("floating islands under a luminous sky").preset, "aether");
  });
  it("refuses duplicate objects, missing timestamps, unsafe geometry data and oversized worlds", () => {
    const w = makeWorld();
    const duplicate = JSON.parse(JSON.stringify(w));
    duplicate.objects.push({ ...duplicate.objects[0] });
    assert.equal(validateWorld(duplicate), false);
    const gap = JSON.parse(JSON.stringify(w));
    gap.film.shots[1].start += .5;
    assert.equal(validateWorld(gap), false);
    const invalid = JSON.parse(JSON.stringify(w));
    invalid.objects[0].position = [0, Number.POSITIVE_INFINITY, 0];
    assert.equal(validateWorld(invalid), false);
    const extra = JSON.parse(JSON.stringify(w));
    extra.objects = Array.from({ length: 601 }, (_, i) => ({ ...w.objects[0], id: "object-" + i }));
    assert.equal(validateWorld(extra), false);
  });
});
