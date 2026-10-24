import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blenderManifest, BLENDER_SCRIPT } from "./grey-blender";
import { addLight, addProp, setAtmos, setLook, updateProp, type GreyScene } from "./grey-scene";

const built = (): GreyScene => {
  let s: GreyScene = { matte: { url: "/api/local/haggs-renders/matte.webm", at: 1, price: "x" }, backdrop: { url: "/api/local/uploads/room.png", name: "Room", scale: 2, x: 0.5, y: 0.5, blur: 0 } };
  s = addProp(s, { name: "Chair", url: "/api/local/uploads/chair.png", behind: true });
  s = updateProp(s, s.props![0]!.id, { x: 0.25, y: 0.8, w: 0.3, rotate: 15, keys: [{ t: 0, x: 0.1 }, { t: 2, x: 0.9 }] });
  s = addLight(s, "key");
  return setAtmos(setLook(s, { exposure: 0.2 }), "rain", 0.6);
};
const opts = { name: "Understudy 1", size: { w: 1080, h: 1920 }, seconds: 4, fps: 24, footage: { url: "/api/local/haggs-uploads/f.mp4", kind: "video" as const } };

describe("blenderManifest", () => {
  it("lists every file the set needs once, under assets/, and refers to them by that name", () => {
    const m = blenderManifest(built(), opts);
    assert.equal(m.frames, 96);
    assert.deepEqual([m.width, m.height, m.fps], [1080, 1920, 24]);
    assert.match(m.actor!.file, /^assets\/\d+-matte\.webm$/);
    assert.equal(m.actor!.kind, "movie");
    assert.match(m.backdrop!.file, /^assets\/\d+-room\.png$/);
    assert.match(m.props[0]!.file, /^assets\/\d+-chair\.png$/);
    assert.deepEqual(Object.values(m.assets).sort(), ["/api/local/haggs-renders/matte.webm", "/api/local/uploads/chair.png", "/api/local/uploads/room.png"].sort());
    assert.equal(new Set(Object.keys(m.assets)).size, 3);
  });

  it("falls back to the original footage when the actor hasn't been cut out", () => {
    const { matte: _m, ...rest } = built();
    const m = blenderManifest(rest, opts);
    assert.match(m.actor!.file, /f\.mp4$/);
  });

  it("carries positions, depth order and motion, and says what isn't included", () => {
    const m = blenderManifest(built(), opts);
    assert.deepEqual([m.props[0]!.x, m.props[0]!.y, m.props[0]!.w, m.props[0]!.rotate, m.props[0]!.behind], [0.25, 0.8, 0.3, 15, true]);
    assert.equal(m.props[0]!.keys!.length, 2);
    assert.equal(m.lights.length, 1);
    assert.equal(m.exposure, 0.2);
    assert.ok(m.notes.some((n) => /air|fog|rain/i.test(n)));
  });
});

describe("the Blender script", () => {
  it("is a script that reads scene.json, builds an orthographic camera and writes an mp4", () => {
    assert.match(BLENDER_SCRIPT, /import bpy/);
    assert.match(BLENDER_SCRIPT, /scene\.json/);
    assert.match(BLENDER_SCRIPT, /ORTHO/);
    assert.match(BLENDER_SCRIPT, /FFMPEG/);
    assert.match(BLENDER_SCRIPT, /keyframe_insert/);
    assert.doesNotMatch(BLENDER_SCRIPT, /\$\{/, "no template leftovers");
  });
});
