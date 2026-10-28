import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blenderManifest, BLENDER_README, BLENDER_SCRIPT } from "./grey-blender";
import { addLight, addProp, setAtmos, setLook, setPropModel, updateLight, updateProp, type GreyScene } from "./grey-scene";
import { setKey } from "./grey-camera";
import { defaultGrey } from "./grey";

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

describe("blenderManifest with a grey room camera and 3D parts", () => {
  it("adds the camera, its keys in frames and the figures only when a grey frame is given", () => {
    assert.equal(blenderManifest(built(), opts).camera, undefined);
    let grey = { ...defaultGrey(["Ellis", "Rowan"]), cam: { angle: 20, distance: 5, height: 1.5, lens: 35 } };
    grey = { ...grey, camKeys: setKey(setKey(undefined, 0, grey.cam), 6, { ...grey.cam, distance: 2 }) };
    const m = blenderManifest(built(), { ...opts, grey });
    assert.deepEqual(m.camera, { angle: 20, distance: 5, height: 1.5, lens: 35 });
    assert.deepEqual(m.cameraKeys!.map((k) => [k.frame, k.distance]), [[1, 5], [145, 2]]);
    assert.deepEqual(m.figures!.map((f) => f.label), ["Ellis", "Rowan"]);
    assert.ok(m.notes.some((n) => /perspective camera/.test(n)));
  });

  it("a still grey camera has no keys", () => {
    const m = blenderManifest(built(), { ...opts, grey: defaultGrey() });
    assert.ok(m.camera);
    assert.equal(m.cameraKeys, undefined);
  });

  it("a prop with a 3D model gets its model file in assets, and a light carries spot and power", () => {
    let s = built();
    s = setPropModel(s, s.props![0]!.id, { url: "/api/local/uploads/chair.glb", name: "chair.glb" });
    s = updateLight(s, s.lights![0]!.id, { spot: true, power: 900 });
    const m = blenderManifest(s, opts);
    assert.match(m.props[0]!.model!, /^assets\/\d+-chair\.glb$/);
    assert.equal(m.assets[m.props[0]!.model!], "/api/local/uploads/chair.glb");
    assert.deepEqual([m.lights[0]!.spot, m.lights[0]!.power], [true, 900]);
  });

  it("power can be set back to automatic", () => {
    let s = built();
    s = updateLight(s, s.lights![0]!.id, { spot: true, power: 900 });
    s = updateLight(s, s.lights![0]!.id, { power: Number.NaN });
    assert.equal(s.lights![0]!.power, undefined);
    assert.equal(s.lights![0]!.spot, true);
    assert.equal("power" in blenderManifest(s, opts).lights[0]!, false);
  });

  it("the README tells you about the Grey Room camera only when there is one", () => {
    assert.doesNotMatch(BLENDER_README(blenderManifest(built(), opts)), /GreyRoomCamera/);
    assert.match(BLENDER_README(blenderManifest(built(), { ...opts, grey: defaultGrey() })), /GreyRoomCamera/);
  });

  it("ignores a model that isn't a 3D file, and clamps light power", () => {
    let s = built();
    s = setPropModel(s, s.props![0]!.id, { url: "/api/local/uploads/chair.png", name: "chair.png" });
    assert.equal(s.props![0]!.model, undefined);
    s = updateLight(s, s.lights![0]!.id, { power: 99999 });
    assert.equal(s.lights![0]!.power, 5000);
  });
});

describe("the Blender script", () => {
  it("is a script that reads scene.json, builds an orthographic camera and writes an mp4", () => {
    assert.match(BLENDER_SCRIPT, /import bpy/);
    assert.match(BLENDER_SCRIPT, /scene\.json/);
    assert.match(BLENDER_SCRIPT, /ORTHO/);
    assert.match(BLENDER_SCRIPT, /FFMPEG/);
    assert.match(BLENDER_SCRIPT, /keyframe_insert/);
    assert.match(BLENDER_SCRIPT, /GreyRoomCamera/);
    assert.match(BLENDER_SCRIPT, /import_scene\.gltf/);
    assert.doesNotMatch(BLENDER_SCRIPT, /\$\{/, "no template leftovers");
  });
});
