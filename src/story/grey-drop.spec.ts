import { test } from "node:test";
import assert from "node:assert/strict";
import { dropAsset } from "./grey-drop";
import { addProp, updateProp } from "./grey-scene";
test("dragging adds at the drop position; swapping keeps placement, role and animation", () => {
  const base=addProp({}, {name:"Actor",url:"/actor.png"}); const id=base.props![0]!.id;
  const scene=updateProp(base,id,{x:.2,y:.7,w:.4,role:"actor",keys:[{t:1,x:.3}]});
  const swapped=dropAsset(scene,JSON.stringify({name:"New",url:"/new.png"}),.9,.1,id)!;
  assert.equal(swapped.id,id); assert.equal(swapped.scene.props!.length,1);
  assert.equal(swapped.scene.props![0]!.x,.2); assert.equal(swapped.scene.props![0]!.w,.4);
  assert.equal(swapped.scene.props![0]!.role,"actor"); assert.deepEqual(swapped.scene.props![0]!.keys,[{t:1,x:.3}]);
  const added=dropAsset(scene,JSON.stringify({name:"Chair",url:"/chair.png"}),.8,.6)!;
  assert.equal(added.scene.props!.length,2); assert.equal(added.scene.props![1]!.x,.8);
});
test("invalid drag data and locked targets are ignored",()=>{
 assert.equal(dropAsset({},"bad",0,0),null);
 assert.equal(dropAsset({},JSON.stringify({name:"bad",url:"javascript:bad"}),0,0),null);
 const scene=addProp({}, {name:"Locked",url:"/x.png"});const id=scene.props![0]!.id;
 assert.equal(dropAsset(updateProp(scene,id,{locked:true}),JSON.stringify({name:"X",url:"/x.png"}),0,0,id),null);
});
