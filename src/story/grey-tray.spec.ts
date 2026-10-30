import {test} from "node:test";
import assert from "node:assert/strict";
import {addUploadedLayer, applyTrayReference} from "./grey-tray";
import {addProp, addSurface, updateProp, updateSurface} from "./grey-scene";
test("uploading an actor with an existing prop keeps the old prop untouched and selects the new actor",()=>{
 const first=addProp({}, {name:"Chair",url:"/chair.png"});const oldId=first.props![0]!.id;
 const scene=updateProp(first,oldId,{role:"object",x:.2,y:.7,w:.4});
 const result=addUploadedLayer(scene,{name:"Actor",url:"/actor.png"},"actor");
 assert.equal(result.scene.props!.length,2);assert.deepEqual(result.scene.props![0],scene.props![0]);
 assert.notEqual(result.selected,oldId);assert.equal(result.scene.props![1]!.id,result.selected);assert.equal(result.scene.props![1]!.role,"actor");
 const object=addUploadedLayer(result.scene,{name:"Table",url:"/table.png"},"object");
 assert.equal(object.scene.props![2]!.id,object.selected);assert.equal(object.scene.props![2]!.role,"object");assert.equal(object.scene.props![1]!.role,"actor");
});
test("successive materials stay on the canvas-selected wall rather than reverting to floor",()=>{
 let scene=addSurface(addSurface({},"Floor"),"Wall");const floor=scene.surfaces![0]!.id,wall=scene.surfaces![1]!.id;
 scene=updateSurface(scene,floor,{texture:{url:"/floor.png",name:"Floor",scale:1}});
 const one=applyTrayReference(scene,wall,{id:"a",name:"Paint",url:"/a.png"});
 assert.equal(one.selected,wall);assert.equal(one.kind,"surface");
 const two=applyTrayReference(one.scene,one.selected,{id:"b",name:"Brick",url:"/b.png"});
 assert.equal(two.selected,wall);assert.equal(two.scene.surfaces!.find(s=>s.id===wall)!.texture!.url,"/b.png");assert.equal(two.scene.surfaces!.find(s=>s.id===floor)!.texture!.url,"/floor.png");
 const newTarget=applyTrayReference(two.scene,"Door",{id:"c",name:"Door",url:"/door.png"});assert.equal(newTarget.scene.surfaces!.at(-1)!.id,newTarget.selected);
});
