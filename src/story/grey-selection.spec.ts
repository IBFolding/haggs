import assert from "node:assert/strict";
import { it } from "node:test";
import { validSelection, selectionBounds, selectionFrame } from "./grey-selection";
import { normalizeScene, replaceRoomSource, type GreyScene } from "./grey-scene";
import { greyPlan } from "./grey-render";
const selection = { aspect: 1, points: [{x:.25,y:.25},{x:.75,y:.25},{x:.75,y:.75},{x:.25,y:.75}] };
it("a selected source area aligns inside a letterboxed render", () => {
 assert.ok(validSelection(selection));
 assert.deepEqual(selectionBounds(selection), {x:.25,y:.25,w:.5,h:.5});
 assert.deepEqual(selectionFrame(selection,{w:1280,h:720}),{x:460,y:180,w:360,h:360});
});
it("rejects malformed and degenerate area selections", () => {
 for(const bad of [undefined, {...selection,aspect:0}, {...selection,points:[{x:0,y:0},{x:.5,y:.5},{x:1,y:1}]}, {...selection,points:[{x:-1,y:0},...selection.points]}]) assert.equal(validSelection(bad),false);
});
it("new photo invalidates old outlines and cut-out, preserving references and placed objects", () => {
 const scene: GreyScene={references:[{id:'ref',name:'Oak',url:'/oak.png'}],matte:{url:'/old.png',at:1,price:'free'},surfaces:[{id:'door',label:'Door',strength:1,selection,mode:'replace',mask:{kind:'image',url:'/mask.png',at:1,price:'free'},texture:{url:'/door.png',name:'Door',scale:1}}]};
 const next=replaceRoomSource(scene,{url:'/new.png',kind:'image'});
 assert.equal(next.matte,undefined); assert.equal(next.surfaces![0]!.mask,undefined); assert.equal(next.surfaces![0]!.selection,undefined); assert.equal(next.references,scene.references); assert.equal(next.surfaces![0]!.texture!.url,'/door.png');
});
it("replacement image uses fitted bounds and normal blend, surviving persistence",()=>{
 const scene: GreyScene={source:{url:'/room.png',kind:'image'},surfaces:[{id:'door',label:'Door',strength:1,selection,mode:'replace',mask:{kind:'image',url:'/mask.png',at:1,price:'free'},texture:{url:'/door.png',name:'Door',scale:1}}]};
 const restored=normalizeScene(JSON.parse(JSON.stringify(scene)));
 const plan=greyPlan(restored,{w:1280,h:720},2,'/room.png');
 assert.deepEqual(plan.inputs.find(i=>i.role==='texture')!.fit,{x:460,y:180,w:360,h:360});
 assert.match(plan.filter,/blend=all_mode=normal/);
 assert.deepEqual(restored.surfaces![0]!.selection,selection);
});
