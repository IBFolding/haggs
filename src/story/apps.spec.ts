import assert from "node:assert/strict";
import { test } from "node:test";

import { appFile, createAppStore, readAppFile } from "./apps";
import { memoryKv } from "./kv";
import type { Canvas } from "../comfy/canvas";

const workflow = JSON.stringify({ "1": { class_type: "LoadImage", inputs: { image: "a.png" } } });

test("a shared canvas app keeps its editable layout after importing and reopening", async () => {
  const canvas:Canvas={name:'Ad builder',nodes:[{id:'n1',kind:'picture-in',x:10,y:20},{id:'n2',kind:'animate',x:310,y:50,prompt:'Move gently',seconds:5,resolution:'720p'}],links:[{from:'n1',to:'n2'}]};
  const text=appFile({id:'original',name:'Ad builder',description:'',workflow,canvas,createdAt:1,updatedAt:2});
  const imported=readAppFile(text);assert.deepEqual(imported.canvas,canvas);
  const store=createAppStore(memoryKv()),saved=await store.save(imported);
  assert.deepEqual((await store.load(saved.id))?.canvas,canvas);
});

test("a malformed shared canvas is refused before it reaches the editor", () => {
  const file=(canvas:unknown)=>JSON.stringify({format:'haggs.app/1',name:'Test',workflow,canvas});
  const node={id:'n1',kind:'picture-in',x:0,y:0};
  for(const canvas of [null,{name:'x',nodes:[{...node,kind:'unknown'}],links:[]},{name:'x',nodes:[node,node],links:[]},{name:'x',nodes:[node],links:[{from:'n1',to:'missing'}]},{name:'x',nodes:[{...node,x:'not a number'}],links:[]}])assert.throws(()=>readAppFile(file(canvas)),/editable layout is invalid/);
});

test("an app is saved with its workflow and cover, listed newest first, and renamed in place", async () => {
  const apps = createAppStore(memoryKv());
  const a = await apps.save({ name: "Product to ad", description: "Drop a product, get an ad", workflow });
  const b = await apps.save({ name: "Put me in it", description: "", workflow, cover: { url: "/api/local/r.mp4", kind: "video" } });
  assert.deepEqual((await apps.list()).map((x) => x.name), ["Put me in it", "Product to ad"]);
  await apps.save({ ...a, name: "Product ad" });
  assert.equal((await apps.load(a.id))!.name, "Product ad");
  assert.equal((await apps.list()).length, 2);
  await apps.remove(b.id);
  assert.deepEqual((await apps.list()).map((x) => x.id), [a.id]);
});

test("an app file carries the workflow, its steps and an embedded cover, and reads back as a new app", async () => {
  const text = appFile({ id: "x", name: "Put me in it", description: "Swap", workflow, recipe: { name: "Put me in it", steps: [{ kind: "picture-in" }] }, cover: { url: "data:image/webp;base64,AAAA", kind: "image" }, createdAt: 1, updatedAt: 2 });
  const back = readAppFile(text);
  assert.equal(back.name, "Put me in it");
  assert.equal(back.workflow, workflow);
  assert.equal(back.recipe!.steps[0]!.kind, "picture-in");
  assert.equal(back.cover!.url, "data:image/webp;base64,AAAA");
  assert.equal("id" in back, false, "an imported app gets a new id when saved");
});

test("a file that isn't an app, or carries a cover from somewhere else, is refused or cleaned", () => {
  assert.throws(() => readAppFile("nope"), /isn't a haggs app/);
  assert.throws(() => readAppFile(JSON.stringify({ format: "haggs.app/1", name: "x" })), /workflow/);
  const odd = readAppFile(JSON.stringify({ format: "haggs.app/1", name: "x", workflow, cover: { url: "javascript:alert(1)", kind: "image" } }));
  assert.equal(odd.cover, undefined);
});

test("saved app settings survive reopening but are not included in shared files", async () => {
  const store = createAppStore(memoryKv());
  const settings = { "900/timeline_json": '{"actors":[]}', "2/strength": 0.5 };
  const saved = await store.save({name:"My guide", description:"", workflow, settings});
  assert.deepEqual((await store.load(saved.id))?.settings, settings);
  const shared = appFile(saved);
  assert.equal('settings' in JSON.parse(shared), false);
  assert.equal(readAppFile(shared).settings, undefined);
  const old = await store.save({name:"Older app", description:"", workflow});
  assert.equal((await store.load(old.id))?.settings, undefined);
});
