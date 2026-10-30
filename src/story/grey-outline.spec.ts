import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOutline, outlineSource } from "./grey-outline";
import { addSurface, normalizeScene, replaceRoomSource, updateSurface } from "./grey-scene";
const patch = {mask:{kind:"image" as const,url:"/old-outline.png",at:1,price:"test"}};
test("pending detection cannot attach an old photo's pixels after replacement", async()=>{
 let scene=addSurface({source:{url:"/a.png",kind:"image"}},"Floor");const id=scene.surfaces![0]!.id;
 const started=outlineSource(scene,"/a.png",false);
 let complete!:()=>void; const pending=new Promise<void>(resolve=>{complete=resolve;}).then(()=>applyOutline(scene,id,started,outlineSource(scene,scene.source!.url,false),patch));
 scene=replaceRoomSource(scene,{url:"/b.png",kind:"image"});complete();
 assert.equal(await pending,scene);assert.equal(scene.surfaces![0]!.mask,undefined);
 scene=replaceRoomSource(scene,{url:"/a.png",kind:"image"});
 assert.equal(applyOutline(scene,id,started,outlineSource(scene,"/a.png",false),patch),scene);
 assert.equal(normalizeScene(scene).source?.revision,scene.source?.revision);
});
test("current results preserve newer material edits and removed targets stay removed",()=>{
 let scene=addSurface({},"Floor");const id=scene.surfaces![0]!.id;const source=outlineSource(scene,"/a.png",false);
 scene=updateSurface(scene,id,{strength:.4,texture:{url:"/wood.png",name:"Wood",scale:2}});
 const next=applyOutline(scene,id,source,source,patch);
 assert.equal(next.surfaces![0]!.mask?.url,patch.mask.url);assert.equal(next.surfaces![0]!.strength,.4);assert.equal(next.surfaces![0]!.texture?.scale,2);
 const removed={...scene,surfaces:[]};assert.equal(applyOutline(removed,id,source,source,patch),removed);
 assert.equal(applyOutline(scene,id,source,outlineSource(scene,"/a.png",true),patch),scene);
});
test('a pending static video outline is invalid after changing the source trim',()=>{
 const scene=addSurface({source:{url:'/clip.mp4',kind:'video',trimIn:2}},'Floor');
 const before=outlineSource(scene,'/clip.mp4',true);
 const changed={...scene,source:{...scene.source!,trimIn:4}};
 assert.equal(applyOutline(changed,scene.surfaces![0]!.id,before,outlineSource(changed,'/clip.mp4',true),patch),changed);
});
