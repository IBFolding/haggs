import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memoryKv } from "./kv";
import { addLight, addProp, setLook, setShadow } from "./grey-scene";
import { applySet, captureSet, createSetStore } from "./set-bank";

const built = () => {
  let s = addProp({ matte: { url: "m.webm", at: 1, price: "x" }, backdrop: { url: "room.png", name: "Room", scale: 2, x: 0.5, y: 0.5, blur: 0 }, place: "p1" }, { name: "Chair", url: "chair.png" });
  s = addLight(s, "key");
  s = setLook(s, { warmth: 0.6 });
  return setShadow(s, { amount: 0.5 });
};

describe("saved sets", () => {
  it("keeps the room, props, lights and look, but never the actor's cut-out, which belongs to one shot", () => {
    const saved = captureSet(built(), "Victorian dining room");
    assert.equal(saved.name, "Victorian dining room");
    assert.equal(saved.scene.matte, undefined);
    assert.equal(saved.scene.props!.length, 1);
    assert.equal(saved.scene.lights!.length, 1);
    assert.equal(saved.scene.backdrop!.url, "room.png");
    assert.equal(saved.scene.look!.warmth, 0.6);
  });

  it("puts a saved set on another shot and keeps that shot's own cut-out", () => {
    const saved = captureSet(built(), "Dining room");
    const other = { matte: { url: "other.webm", at: 2, price: "y" }, props: [{ id: "old", name: "Old", url: "o", x: 0.1, y: 0.1, w: 0.2, rotate: 0, behind: false, opacity: 1 }] };
    const next = applySet(other, saved);
    assert.equal(next.matte!.url, "other.webm");
    assert.deepEqual(next.props!.map((p) => p.name), ["Chair"], "the old props are replaced");
    assert.notEqual(next.props![0]!.id, saved.scene.props![0]!.id, "each use gets its own ids, so two shots never share a prop");
    assert.equal(next.backdrop!.url, "room.png");
  });

  it("saves, lists newest first, renames by saving again, and removes", async () => {
    const store = createSetStore(memoryKv());
    const a = await store.save(captureSet(built(), "One"));
    await new Promise((r) => setTimeout(r, 3));
    const b = await store.save(captureSet(built(), "Two"));
    assert.deepEqual((await store.list()).map((x) => x.name), ["Two", "One"]);
    await store.save({ ...a, name: "One, renamed" });
    assert.equal((await store.list()).find((x) => x.id === a.id)!.name, "One, renamed");
    await store.remove(b.id);
    assert.deepEqual((await store.list()).map((x) => x.id), [a.id]);
    await assert.rejects(store.save(captureSet(built(), "   ")), /name/i);
  });
});
