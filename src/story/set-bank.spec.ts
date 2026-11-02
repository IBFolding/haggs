import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memoryKv } from "./kv";
import { addLight, addProp, setLook, setShadow } from "./grey-scene";
import { applySetParts, applySet, captureSet, createSetStore } from "./set-bank";

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

it("saved looks never move a shot's source footage to another shot", () => {
 const source = {url:"/original.mp4",kind:"video" as const};
 const saved = captureSet({...built(),source},"Look");
 assert.equal(saved.scene.source, undefined);
 const other = {url:"/other.mp4",kind:"video" as const};
 assert.deepEqual(applySet({source:other}, {...saved,scene:{...saved.scene,source}}).source,other);
});


it("selective set reuse adds independent props without replacing existing layers or footage",()=>{
 const original=built(),saved=captureSet(original,"Room");
 saved.scene.props![0]!.keys=[{t:0,x:.2},{t:6,x:.8}];
 const target={...built(),source:{url:"own.mp4",kind:"video" as const},direction:"Keep my direction"};
 assert.equal(applySetParts(target,saved,"props"),target,"matching names are retained");
 saved.scene.props![0]!.name="Table";
 const next=applySetParts(target,saved,"props");
 assert.deepEqual(next.props![0],target.props![0]);assert.equal(next.source,target.source);assert.equal(next.matte,target.matte);assert.equal(next.direction,target.direction);
 assert.notEqual(next.props![1]!.id,saved.scene.props![0]!.id);
 next.props![1]!.keys![0]!.x=.9;assert.equal(saved.scene.props![0]!.keys![0]!.x,.2);
 assert.equal(applySetParts(next,saved,"props"),next,"reapplying does not duplicate matching props");
});
it("selective room materials retain masks, props and other shot choices",()=>{
 const target={...built(),space:{floor:"wood" as const,wall:"plaster" as const}};
 const saved=captureSet({...built(),space:{floor:"metal",wall:"concrete"}},"Industrial");
 const next=applySetParts(target,saved,"room");
 assert.deepEqual(next,{...target,space:{floor:"metal",wall:"concrete"}});assert.notEqual(next.space,saved.scene.space);
 assert.equal(applySetParts(target,captureSet(built(),"Legacy"),"room"),target);
});
it("selective prop reuse refuses capacity overflow atomically",()=>{
 const base=built(),prop=base.props![0]!;
 const target={...base,props:Array.from({length:100},(_,i)=>({...prop,id:String(i),name:`Existing ${i}`}))};
 const before=JSON.stringify(target);
 assert.throws(()=>applySetParts(target,captureSet(base,"Room"),"props"),/100 props/);
 assert.equal(JSON.stringify(target),before);
});
