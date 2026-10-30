import assert from "node:assert/strict";
import { it } from "node:test";
import { addRoomReference, assignObjectReference, removeRoomReference, assignSurfaceReference, normalizeScene, referenceUses, updateSurface } from "./grey-scene";
import { greyPlan } from "./grey-render";
it("reference collection does not alter the room; assignment and swaps preserve the mask", () => {
  let scene = addRoomReference({}, { url: "/oak.png", name: "Oak" });
  assert.equal(scene.props, undefined);
  assert.equal(scene.surfaces, undefined);
  assert.deepEqual(referenceUses(scene, "/oak.png"), []);
  scene = assignSurfaceReference(scene, "Floor", scene.references![0]!);
  const id = scene.surfaces![0]!.id;
  scene = updateSurface(scene, id, { mask: { url: "/floor.png", kind: "image", at: 1, price: "test" } });
  scene = addRoomReference(scene, { url: "/tile.png", name: "Tile" });
  scene = assignSurfaceReference(scene, "Floor", scene.references![1]!);
  assert.equal(scene.surfaces!.length, 1);
  assert.equal(scene.surfaces![0]!.mask!.url, "/floor.png");
  assert.deepEqual(referenceUses(scene, "/tile.png"), ["Floor"]);
  assert.deepEqual(referenceUses(scene, "/oak.png"), []);
  const restored = normalizeScene(JSON.parse(JSON.stringify(scene)));
  assert.deepEqual(restored.references, scene.references);
  assert.equal(restored.surfaces![0]!.mask!.kind, "image");
});
it("still photo and PNG selection loop for the whole draft without VP9 decoding", () => {
  const scene = { source: { url: "/room.png", kind: "image" as const }, surfaces: [{ id: "floor", label: "Floor", strength: 1, mask: { url: "/mask.png", kind: "image" as const, at: 1, price: "test" }, texture: { url: "/oak.png", name: "Oak", scale: 1 } }] };
  const plan = greyPlan(scene, { w: 64, h: 64 }, 3, "/room.png");
  assert.deepEqual(plan.inputs.find(i => i.role === "surface")!.args, ["-loop", "1", "-t", "3"]);
  assert.deepEqual(plan.inputs.find(i => i.role === "footage-picture")!.args, ["-loop", "1", "-t", "3"]);
});

it("object swaps preserve placement and removing a card keeps assigned assets", () => {
  let scene = addRoomReference({}, { url: "/chair.png", name: "Chair" });
  scene = assignObjectReference(scene, null, scene.references![0]!);
  const original = { ...scene.props![0]!, x: 0.23, rotate: 34, hidden: true, keys: [{ t: 1, x: 0.8 }] };
  scene = { ...scene, props: [original] };
  scene = addRoomReference(scene, { url: "/stool.png", name: "Stool" });
  scene = assignObjectReference(scene, original.id, scene.references![1]!);
  assert.deepEqual(scene.props, [{ ...original, url: "/stool.png", name: "Stool" }]);
  scene = removeRoomReference(scene, scene.references![1]!.id);
  assert.equal(scene.references!.length, 1);
  assert.equal(normalizeScene(JSON.parse(JSON.stringify(scene))).props![0]!.url, "/stool.png");
});
