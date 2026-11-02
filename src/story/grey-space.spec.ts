import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultGrey } from "./grey";
import { normalizeScene, resolveScene, sceneIsEmpty, type GreyScene } from "./grey-scene";
import { keySpatialProp, editSpatialProp, addStandInProp, moveSpatialProp, propPosition, requestSceneProposal, roomSpace, sceneProposalSchema } from "./grey-space";

test("spatial edits round trip through the existing scene serializer without losing compositor state", () => {
  const old: GreyScene = { source: { url: "original.mp4", kind: "video" }, references: [{ id: "ref", name: "Kitchen", url: "kitchen.png" }], surfaces: [{ id: "floor-mask", label: "Floor", strength: .8, mask: { url: "mask.png", price: "0", at: 1 } }], look: { exposure: .2, contrast: 0, warmth: 0, saturation: 0, vignette: 0 } };
  const scene = addStandInProp({ ...old, space: { floor: "wood", wall: "plaster" }, direction: "Kitchen at dawn" });
  const moved = moveSpatialProp(scene, scene.props![0]!.id, 2, -2);
  const reopened = normalizeScene(JSON.parse(JSON.stringify(moved)));
  assert.ok(Math.abs(propPosition(reopened.props![0]!).x - 2) < .00001);
  assert.equal(propPosition(reopened.props![0]!).z, -2);
  assert.deepEqual(reopened.source, old.source); assert.deepEqual(reopened.references, old.references);
  assert.equal(reopened.surfaces![0]!.mask!.url, "mask.png"); assert.deepEqual(reopened.space, scene.space); assert.equal(reopened.direction, scene.direction);
});
test("spatial drag respects locked layers, room bounds, and does not discard animation", () => {
  const scene = addStandInProp({}); const p = scene.props![0]!;
  p.keys = [{ t: 0, x: .2 }, { t: 5, x: .8 }]; p.locked = true;
  assert.equal(moveSpatialProp(scene, p.id, 100, -100), scene);
  p.locked = false;
  const moved = moveSpatialProp(scene, p.id, 100, -100);
  assert.deepEqual(propPosition(moved.props![0]!), { x: 3, z: -3 });
  assert.deepEqual(moved.props![0]!.keys, p.keys);
  assert.ok(Math.abs(propPosition(resolveScene(moved, 2.5).props![0]!).x) < .001);
});
test("old and damaged scenes retain sensible material defaults", () => {
  assert.deepEqual(roomSpace(undefined), { floor: "concrete", wall: "plaster" });
  assert.deepEqual(roomSpace({ floor: "untrusted", wall: "metal" }), roomSpace(undefined));
  assert.equal(sceneIsEmpty({ space: { floor: "wood", wall: "metal" } }), false);
  assert.equal(normalizeScene({ direction: "a".repeat(5000) }).direction!.length, 4000);
});
const proposal = { version: 1, summary: "Kitchen at dawn", room: { floor: "wood", wall: "plaster" }, people: [{ label: "Rowan", x: 0, z: 0 }], props: [], camera: defaultGrey().cam, light: defaultGrey().light };
test("AI hook validates output and never mutates or applies the proposal", async () => {
  const request = { description: "Kitchen", references: [], grey: defaultGrey(), scene: {} };
  const before = JSON.stringify(request);
  const result = await requestSceneProposal(async () => proposal, request, new AbortController().signal);
  assert.equal(result.summary, "Kitchen at dawn"); assert.equal(JSON.stringify(request), before);
  assert.equal(sceneProposalSchema.safeParse({ ...proposal, people: [{ label: "x", x: 999, z: 0 }] }).success, false);
  await assert.rejects(requestSceneProposal(async () => ({}), request, new AbortController().signal));
  const aborted = new AbortController(); aborted.abort(); let called = false;
  await assert.rejects(requestSceneProposal(async () => { called = true; return proposal; }, request, aborted.signal));
  assert.equal(called, false);
});
test("editing an animated prop in the spatial viewport records the edit at the playhead", () => {
  const scene = addStandInProp({}); const p = scene.props![0]!;
  p.keys = [{ t: 0, x: .2 }, { t: 5, x: .8 }];
  const edited = moveSpatialProp(scene, p.id, 1.5, 0, 2.5);
  assert.equal(resolveScene(edited, 2.5).props![0]!.x, .75);
  assert.equal(resolveScene(edited, 0).props![0]!.x, .2);
  assert.equal(resolveScene(edited, 5).props![0]!.x, .8);
});
test("spatial inspector preserves original assets and keys, respects locks and edits animated transforms at the playhead",async()=>{
 const {editSpatialProp}=await import('./grey-space');const scene=addStandInProp({source:{url:'original.mp4',kind:'video'}}),p=scene.props![0]!;
 p.keys=[{t:0,w:.2,rotate:0},{t:5,w:.8,rotate:90}];
 const edited=editSpatialProp(scene,p.id,{name:'Table',w:.5,rotate:45},2);
 assert.equal(edited.props![0]!.url,p.url);assert.deepEqual(edited.source,scene.source);assert.equal(edited.props![0]!.id,p.id);
 assert.equal(resolveScene(edited,2).props![0]!.w,.5);assert.equal(resolveScene(edited,0).props![0]!.w,.2);assert.equal(resolveScene(edited,5).props![0]!.rotate,90);
 const locked=editSpatialProp(edited,p.id,{locked:true},2);assert.equal(editSpatialProp(locked,p.id,{w:1},2),locked);
 const hidden=editSpatialProp(locked,p.id,{hidden:true},2);assert.equal(hidden.props![0]!.hidden,true);assert.equal(editSpatialProp(hidden,p.id,{locked:false},2).props![0]!.locked,false);
});


test("prop materials round trip safely without changing source media, animation or legacy props", async()=>{
 const {editSpatialProp,propMaterial}=await import("./grey-space");
 const scene=addStandInProp({source:{url:"footage.mp4",kind:"video"}}),id=scene.props![0]!.id;
 scene.props![0]!.keys=[{t:0,w:.2},{t:2,w:.4}];
 const edited=editSpatialProp(scene,id,{material:"wood"},1);
 const reopened=normalizeScene(JSON.parse(JSON.stringify(edited)));
 assert.equal(reopened.props![0]!.material,"wood");assert.deepEqual(reopened.props![0]!.keys,scene.props![0]!.keys);
 assert.equal(reopened.props![0]!.url,scene.props![0]!.url);assert.deepEqual(reopened.source,scene.source);
 const locked=editSpatialProp(edited,id,{locked:true},1);
 assert.equal(editSpatialProp(locked,id,{material:"metal"},1),locked);
 assert.equal(editSpatialProp(locked,id,{material:undefined},1),locked);
 assert.equal(editSpatialProp(edited,id,{material:undefined},1).props![0]!.material,undefined);
 assert.equal(propMaterial("__proto__"),undefined);
 const bad=JSON.parse(JSON.stringify(edited));bad.props[0].material='<script>';
 assert.equal(normalizeScene(bad).props![0]!.material,undefined);
 assert.equal(normalizeScene(scene).props![0]!.material,undefined);
});

test("palette drops validate local choices, place bounded props and preserve locked layers and source assets",async()=>{
 const {readSpatialDrop,applySpatialDrop}=await import("./grey-space");
 assert.equal(readSpatialDrop('{"kind":"box","url":"https://example.com"}'),undefined);
 assert.equal(readSpatialDrop('{"kind":"material","material":"__proto__"}'),undefined);
 assert.equal(readSpatialDrop('x'.repeat(101)),undefined);assert.deepEqual(readSpatialDrop('{"kind":"box"}'),{kind:"box"});
 const scene=addStandInProp({source:{url:"source.mp4",kind:"video"},references:[{id:"r",name:"Ref",url:"ref.png"}]});
 const added=applySpatialDrop(scene,{kind:"box"},{x:50,z:-50},0);
 assert.deepEqual(added.props![0],scene.props![0]);assert.deepEqual(added.source,scene.source);assert.deepEqual(added.references,scene.references);
 assert.deepEqual(propPosition(added.props![1]!),{x:3,z:-3});
 const floor=applySpatialDrop(added,{kind:"material",material:"wood"},{surface:"floor"},0);
 assert.equal(floor.space!.floor,"wood");assert.equal(floor.space!.wall,"plaster");
 added.props![0]!.locked=true;assert.equal(applySpatialDrop(added,{kind:"material",material:"metal"},{propId:added.props![0]!.id},0),added);
 assert.equal(applySpatialDrop(scene,{kind:"box"},{x:NaN,z:0},0),scene);
 const full={props:Array.from({length:100},()=>scene.props![0]!)};assert.equal(applySpatialDrop(full,{kind:"box"},{x:0,z:0},0),full);
});
test("spatial camera movement keeps lens and height and edits a shared path without replacing other keys",async()=>{
 const {spatialCameraAt}=await import("./grey-space"),{setKey,presetKeys}=await import("./grey-camera");
 const cam={...defaultGrey().cam,lens:85,height:2},keys=presetKeys("Push in",cam);
 const moved=spatialCameraAt(cam,3,-4);assert.equal(moved.distance,5);assert.ok(Math.abs(moved.angle-36.86989765)<.001);assert.equal(moved.lens,85);assert.equal(moved.height,2);
 const edited=setKey(keys,2,moved);assert.deepEqual(edited.find(k=>k.t===0),keys[0]);assert.deepEqual(edited.at(-1),keys.at(-1));assert.equal(edited.find(k=>k.t===2)!.lens,85);
 assert.equal(spatialCameraAt(cam,NaN,0),cam);assert.equal(spatialCameraAt(cam,0,0).distance,1);assert.equal(spatialCameraAt(cam,40,40).distance,12);
});

test("duplicating a prop makes an independent visible layer while preserving source, material and animation",async()=>{
 const {duplicateSpatialProp}=await import("./grey-space");
 const scene=addStandInProp({source:{url:"source.mp4",kind:"video"}}),original=scene.props![0]!;
 original.locked=true;original.hidden=true;original.material="wood";original.keys=[{t:0,x:.2,w:.2},{t:3,x:.7,w:.5}];original.model={url:"chair.glb",name:"Chair"};
 const before=JSON.stringify(scene),next=duplicateSpatialProp(scene,original.id),copy=next.props![1]!;
 assert.equal(JSON.stringify(scene),before);assert.deepEqual(next.props![0],original);assert.deepEqual(next.source,scene.source);
 assert.notEqual(copy.id,original.id);assert.equal(copy.url,original.url);assert.equal(copy.material,"wood");assert.equal(copy.locked,false);assert.equal(copy.hidden,false);
 assert.ok(Math.abs((copy.keys![1]!.x!-copy.keys![0]!.x!)-.5)<1e-9);assert.equal(copy.keys![1]!.w,.5);
 copy.keys![0]!.w=.9;copy.model!.name="Changed";assert.equal(original.keys[0]!.w,.2);assert.equal(original.model.name,"Chair");
});
test("prop duplication respects room bounds and capacity without dropping existing layers",async()=>{
 const {duplicateSpatialProp}=await import("./grey-space");const scene=addStandInProp({}),p=scene.props![0]!;p.x=.98;p.keys=[{t:0,x:0},{t:3,x:1}];
 const copy=duplicateSpatialProp(scene,p.id).props![1]!;assert.equal(copy.x,.98);assert.deepEqual(copy.keys,p.keys);
 const full={props:Array.from({length:100},()=>p)};assert.equal(duplicateSpatialProp(full,p.id),full);assert.equal(duplicateSpatialProp(scene,"missing"),scene);
});


test("direct camera edits cross the zero-degree seam continuously and retain unwrapped orbit angles",async()=>{
 const {spatialCameraAt}=await import("./grey-space");const cam=defaultGrey().cam;
 const point=(angle:number)=>({x:Math.sin(angle*Math.PI/180)*5,z:-Math.cos(angle*Math.PI/180)*5});
 const a=point(1);assert.ok(Math.abs(spatialCameraAt({...cam,angle:359},a.x,a.z).angle-361)<1e-9);
 const b=point(45);assert.ok(Math.abs(spatialCameraAt({...cam,angle:400},b.x,b.z).angle-405)<1e-9);
 const c=point(359);assert.ok(Math.abs(spatialCameraAt({...cam,angle:1},c.x,c.z).angle+1)<1e-9);
});


test("viewport prop keys animate position and size through the shared scene and survive reopen",()=>{
  const scene=addStandInProp({source:{url:"original.mp4",kind:"video"}}),id=scene.props![0]!.id;
  const start=keySpatialProp(scene,id,0);
  const moved=moveSpatialProp(start,id,2,1,6);
  const resized=editSpatialProp(moved,id,{w:.8},6);
  const keyed=keySpatialProp(resized,id,6);
  const opened=normalizeScene(JSON.parse(JSON.stringify(keyed)));
  const half=resolveScene(opened,3).props![0]!;
  assert.ok(Math.abs(propPosition(half).x-1)<.001);
  assert.ok(Math.abs(half.w-(scene.props![0]!.w+.8)/2)<.001);
  assert.deepEqual(opened.source,scene.source);
  assert.equal(scene.props![0]!.keys,undefined);
  assert.equal(opened.props![0]!.keys!.length,2);
});
test("removing prop keys preserves other layers and holds the last visible pose",()=>{
  const scene=addStandInProp(addStandInProp({})),id=scene.props![0]!.id;
  const keyed=keySpatialProp(moveSpatialProp(keySpatialProp(scene,id,0),id,2,1,6),id,6);
  const withoutStart=keySpatialProp(keyed,id,0,true);
  assert.equal(withoutStart.props![0]!.keys!.length,1);
  const still=keySpatialProp(withoutStart,id,6,true);
  assert.equal(still.props![0]!.keys,undefined);
  assert.deepEqual(propPosition(still.props![0]!),propPosition(resolveScene(keyed,6).props![0]!));
  assert.deepEqual(still.props![1],scene.props![1]);
  assert.equal(keySpatialProp(keyed,id,3,true),keyed);
});
test("prop key actions respect locks and reject invalid playheads",()=>{
  const scene=addStandInProp({}),id=scene.props![0]!.id;
  for(const t of [NaN,Infinity,-1,7])assert.equal(keySpatialProp(scene,id,t),scene);
  const locked={...scene,props:scene.props!.map(p=>({...p,locked:true}))};
  assert.equal(keySpatialProp(locked,id,0),locked);
  assert.equal(keySpatialProp(locked,id,0,true),locked);
  assert.equal(keySpatialProp(scene,"missing",0),scene);
});


test("prop retiming preserves sparse channels, later keys and source assets; collisions and locks refuse edits",async()=>{
 const {retimeSpatialPropKey}=await import("./grey-space");const scene=addStandInProp({source:{url:"original.mp4",kind:"video"}}),p=scene.props![0]!;
 p.keys=[{t:0,x:.2},{t:2,w:.5,opacity:.4},{t:9,x:.8,rotate:370}];p.model={url:"chair.glb",name:"Chair"};const original=JSON.stringify(scene);
 const moved=retimeSpatialPropKey(scene,p.id,0,1.5);
 assert.deepEqual(moved.props![0]!.keys,[{t:1.5,x:.2},...p.keys.slice(1)]);assert.deepEqual(moved.source,scene.source);assert.deepEqual(moved.props![0]!.model,p.model);assert.equal(moved.props![0]!.url,p.url);assert.equal(JSON.stringify(scene),original);
 for(const target of [2,2.01,2.05,-1,7,NaN,Infinity])assert.equal(retimeSpatialPropKey(scene,p.id,0,target),scene);
 assert.equal(retimeSpatialPropKey(scene,p.id,4,1),scene);assert.equal(retimeSpatialPropKey(scene,"missing",0,1),scene);
 p.locked=true;assert.equal(retimeSpatialPropKey(scene,p.id,0,1),scene);
});
test("prop reversal mirrors every sparse channel over the complete path without trimming longer imported animation",async()=>{
 const {reverseSpatialPropKeys}=await import("./grey-space");const scene=addStandInProp({source:{url:"original.mp4",kind:"video"}}),p=scene.props![0]!;
 p.keys=[{t:1,x:.2,opacity:1},{t:3,w:.5},{t:5,x:.6,rotate:370},{t:9,x:.8,opacity:.2}];const original=JSON.stringify(scene);
 const reversed=reverseSpatialPropKeys(scene,p.id);assert.deepEqual(reversed.props![0]!.keys!.map(k=>k.t),[1,5,7,9]);
 for(const t of [0,1,2,3,5,7,9,10]){const a=resolveScene(scene,10-t).props![0]!,b=resolveScene(reversed,t).props![0]!;for(const channel of ["x","y","w","rotate","opacity"] as const)assert.ok(Math.abs(a[channel]-b[channel])<1e-9);}
 assert.deepEqual(reverseSpatialPropKeys(reversed,p.id),scene);assert.equal(JSON.stringify(scene),original);assert.deepEqual(normalizeScene(JSON.parse(JSON.stringify(reversed))).props![0]!.keys,reversed.props![0]!.keys);
 p.locked=true;assert.equal(reverseSpatialPropKeys(scene,p.id),scene);p.locked=false;p.keys=[{t:0,x:.1}];assert.equal(reverseSpatialPropKeys(scene,p.id),scene);p.keys=[{t:0,x:.1},{t:0,x:.2}];assert.equal(reverseSpatialPropKeys(scene,p.id),scene);
});

test("reversing imported prop keys preserves sub-millisecond spacing instead of collapsing keys",async()=>{
 const {reverseSpatialPropKeys}=await import("./grey-space");const scene=addStandInProp({}),p=scene.props![0]!;p.keys=[{t:1,x:.1},{t:1.0004,x:.3},{t:2,x:.8}];
 const reversed=reverseSpatialPropKeys(scene,p.id),keys=reversed.props![0]!.keys!;
 assert.equal(keys.length,3);assert.ok(keys[1]!.t<keys[2]!.t);assert.ok(Math.abs(keys[1]!.t-1.9996)<1e-12);
 for(const t of [1,1.9996,1.9998,2])assert.ok(Math.abs(resolveScene(reversed,t).props![0]!.x-resolveScene(scene,3-t).props![0]!.x)<1e-9);
});

test("retiming an imported close key selects the nearest moment and retains its neighbour",async()=>{
 const {retimeSpatialPropKey}=await import("./grey-space");const scene=addStandInProp({}),p=scene.props![0]!;p.keys=[{t:0,x:.1},{t:.0004,w:.3},{t:4,x:.8}];
 const moved=retimeSpatialPropKey(scene,p.id,.0004,2);
 assert.deepEqual(moved.props![0]!.keys,[{t:0,x:.1},{t:2,w:.3},{t:4,x:.8}]);assert.deepEqual(p.keys,[{t:0,x:.1},{t:.0004,w:.3},{t:4,x:.8}]);
});


test("explicit figure placement preserves walking, facing, camera paths, other figures and source data",async()=>{
 const {placeSpatialObject}=await import("./grey-space");const grey={...defaultGrey(["One","Two"]),pose:"walk" as const};grey.subjects[0]!.facing=75;
 grey.camKeys=[{...grey.cam,t:0},{...grey.cam,t:6,angle:90}];const scene=addStandInProp({source:{url:"source.mp4",kind:"video"}}),before=JSON.stringify({grey,scene});
 const moved=placeSpatialObject(grey,scene,`subject:${grey.subjects[0]!.id}`,1.25,-2.5,3);assert.equal(moved?.kind,"figure");if(moved?.kind!=="figure")return;
 assert.deepEqual(moved.grey.subjects[0],{...grey.subjects[0],x:1.25,z:-2.5});assert.deepEqual(moved.grey.subjects[1],grey.subjects[1]);assert.deepEqual(moved.grey.camKeys,grey.camKeys);assert.equal(moved.grey.pose,"walk");assert.equal(JSON.stringify({grey,scene}),before);
});
test("explicit animated prop placement keys the playhead and preserves other times and assets",async()=>{
 const {placeSpatialObject}=await import("./grey-space");const grey=defaultGrey(),scene=addStandInProp({source:{url:"source.mp4",kind:"video"}}),p=scene.props![0]!;
 p.keys=[{t:0,x:.2,y:.3},{t:6,x:.8,y:.7}];p.model={url:"chair.glb",name:"Chair"};const before=JSON.stringify(scene);
 const moved=placeSpatialObject(grey,scene,`prop:${p.id}`,1.5,-1.5,3);assert.equal(moved?.kind,"prop");if(moved?.kind!=="prop")return;
 assert.deepEqual(propPosition(resolveScene(moved.scene,3).props![0]!),{x:1.5,z:-1.5});assert.deepEqual(resolveScene(moved.scene,0).props![0]!.x,.2);assert.deepEqual(resolveScene(moved.scene,6).props![0]!.y,.7);
 assert.equal(moved.scene.props![0]!.url,p.url);assert.deepEqual(moved.scene.props![0]!.model,p.model);assert.deepEqual(moved.scene.source,scene.source);assert.equal(JSON.stringify(scene),before);
 const reopened=normalizeScene(JSON.parse(JSON.stringify(moved.scene)));assert.deepEqual(propPosition(resolveScene(reopened,3).props![0]!),{x:1.5,z:-1.5});
 p.locked=true;assert.equal(placeSpatialObject(grey,scene,`prop:${p.id}`,0,0,3),undefined);
});
test("explicit placement refuses missing objects, camera selection and invalid coordinates without changing the project",async()=>{
 const {placeSpatialObject}=await import("./grey-space");const grey=defaultGrey(),scene=addStandInProp({}),before=JSON.stringify({grey,scene});
 for(const selected of ["","camera:main","prop:missing","subject:missing"])assert.equal(placeSpatialObject(grey,scene,selected,0,0,0),undefined);
 for(const [x,z,t] of [[4,0,0],[0,-4,0],[NaN,0,0],[0,Infinity,0],[0,0,-1],[0,0,7]])assert.equal(placeSpatialObject(grey,scene,`prop:${scene.props![0]!.id}`,x!,z!,t!),undefined);
 assert.equal(JSON.stringify({grey,scene}),before);
});

test("precise placement at an imported close key updates that moment without overwriting its neighbour",async()=>{
 const {placeSpatialObject}=await import("./grey-space");const grey=defaultGrey(),scene=addStandInProp({}),p=scene.props![0]!;p.keys=[{t:0,x:.2},{t:.0004,x:.8}];
 const moved=placeSpatialObject(grey,scene,`prop:${p.id}`,0,0,.0004);assert.equal(moved?.kind,"prop");if(moved?.kind!=="prop")return;
 assert.equal(resolveScene(moved.scene,0).props![0]!.x,.2);assert.equal(resolveScene(moved.scene,.0004).props![0]!.x,.5);assert.equal(moved.scene.props![0]!.keys!.length,2);
});

test("placement leaves unanimated position channels static while retaining other animated channels",async()=>{
 const {placeSpatialObject}=await import("./grey-space");const grey=defaultGrey(),scene=addStandInProp({}),p=scene.props![0]!;p.keys=[{t:0,w:.2},{t:6,w:.8}];
 const moved=placeSpatialObject(grey,scene,`prop:${p.id}`,1.5,-1.5,3);assert.equal(moved?.kind,"prop");if(moved?.kind!=="prop")return;
 assert.deepEqual(moved.scene.props![0]!.keys,p.keys);for(const t of [0,3,6])assert.deepEqual(propPosition(resolveScene(moved.scene,t).props![0]!),{x:1.5,z:-1.5});
 assert.equal(resolveScene(moved.scene,0).props![0]!.w,.2);assert.equal(resolveScene(moved.scene,6).props![0]!.w,.8);
});
