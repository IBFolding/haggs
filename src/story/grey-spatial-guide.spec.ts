import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultGrey } from "./grey";
import { greyFrameSvg, shotPrompt } from "./grey-control";
import { guideSignature } from "./grey-spatial-guide";
import { addStandInProp, moveSpatialProp } from "./grey-space";
import { addGreyTake } from "./grey-take";
import { addTake } from "./takes";
import { newShot } from "./model";
const size={w:640,h:360};
test("legacy frames remain unchanged and spatial material/prop edits reach the same guide renderer",()=>{
 const grey=defaultGrey();const legacy=greyFrameSvg(grey,0,size);
 assert.equal(greyFrameSvg(grey,0,size,{}),legacy);
 const scene=addStandInProp({space:{floor:"wood",wall:"metal"},direction:"Kitchen at dawn"});
 const guide=greyFrameSvg(grey,0,size,scene);assert.match(guide,/#976d45/);assert.match(guide,/#8796a5/);assert.match(guide,/<polygon/);
 const moved=moveSpatialProp(scene,scene.props![0]!.id,2,1);assert.notEqual(greyFrameSvg(grey,0,size,moved),guide);
 const prompt=shotPrompt("Waits",grey,scene);assert.match(prompt,/Kitchen at dawn/);assert.match(prompt,/Floor material: wood/);assert.match(prompt,/Box stand-in/);
});
test("guide uses prop animation, hidden state and safe geometry without embedding remote URLs or labels",()=>{
 const grey=defaultGrey();const scene=addStandInProp({});const p=scene.props![0]!;
 p.name='<script>alert(1)</script>';p.url='https://private.example/asset';p.keys=[{t:0,x:.2},{t:1,x:.8}];
 assert.notEqual(greyFrameSvg(grey,0,size,scene),greyFrameSvg(grey,1,size,scene));
 const svg=greyFrameSvg(grey,0,size,scene);assert.doesNotMatch(svg,/<script|private.example|<image|NaN|Infinity/);
 p.hidden=true;assert.notEqual(greyFrameSvg(grey,0,size,scene),svg);
 assert.match(greyFrameSvg(grey,0,{w:360,h:640},scene),/viewBox="0 0 360 640"/);
});
test("first-frame approval is invalidated by inputs, not by recording the generated take",()=>{
 const grey=defaultGrey(),scene=addStandInProp({});const stamp=guideSignature(grey,scene,"Waits",false);
 assert.notEqual(stamp,guideSignature(grey,{...scene,space:{floor:"wood",wall:"metal"}},"Waits",false));
 assert.notEqual(stamp,guideSignature({...grey,cam:{...grey.cam,lens:85}},scene,"Waits",false));
 assert.notEqual(stamp,guideSignature(grey,scene,"New beat",false));assert.notEqual(stamp,guideSignature(grey,scene,"Waits",true));
 const shot=addTake({...newShot(),grey,greyScene:scene},{url:"generated.png",kind:"image",usd:0,at:1,promptHash:"test"},"Grey room",scene);
 assert.deepEqual(shot.greyScene,scene);assert.equal(guideSignature(grey,shot.greyScene,"Waits",false),stamp);
 assert.equal(guideSignature(grey,{...scene,source:{url:"generated.png",kind:"image"}},"Waits",false),stamp);
});

test("a completed generation keeps its input snapshot and does not roll back newer scene edits",()=>{
 const produced=addStandInProp({direction:"Before"});const current={...produced,direction:"Edited while generating"};
 const shot=addGreyTake({...newShot(),greyScene:current},{url:"made.png",kind:"image",at:1,usd:0,promptHash:"x"},"Grey room",produced,current);
 assert.deepEqual(shot.greyScene,current);assert.deepEqual(shot.takes!.at(-1)!.greyScene,produced);
});


test("prop material changes reach the guide and shot prompt and invalidate frame approval",()=>{
 const grey=defaultGrey(),scene=addStandInProp({});const before=greyFrameSvg(grey,0,size,scene);
 const changed={...scene,props:scene.props!.map(p=>({...p,material:"wood" as const}))};
 assert.notEqual(greyFrameSvg(grey,0,size,changed),before);assert.match(greyFrameSvg(grey,0,size,changed),/#976d45/);
 assert.match(shotPrompt("Waits",grey,changed),/Box stand-in \(wood\)/);
 assert.notEqual(guideSignature(grey,scene,"Waits",false),guideSignature(grey,changed,"Waits",false));
});
