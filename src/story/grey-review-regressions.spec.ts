import {test} from "node:test";
import assert from "node:assert/strict";
import {addStandInProp} from "./grey-space";
import {updateProp,resolveScene} from "./grey-scene";
import {dropAsset} from "./grey-drop";
import {propImage} from "./grey-primitive-image";
import {blenderManifest} from "./grey-blender";
import {greyPlan} from "./grey-render";
import {defaultGrey} from "./grey";
import {controlSeconds,fitControl} from "./grey-control";
import {addGreyTake} from "./grey-take";
import {newShot,createProject} from "./model";
import {clipSeconds,buildCut} from "./cut";
import {chooseTake} from "./takes";

test("replacing a box with an image exports the selected image",()=>{
 const scene=addStandInProp({}),id=scene.props![0]!.id;
 const replaced=updateProp(scene,id,{url:"/api/local/chair.png",name:"Chair"});
 assert.equal(replaced.props![0]!.primitive,undefined);
 const plan=greyPlan(replaced,{w:320,h:180},4,"/api/local/source.mp4");
 assert.ok(plan.inputs.some(i=>i.role==="prop"&&i.ref==="/api/local/chair.png"));
 assert.ok(!plan.inputs.some(i=>i.role==="primitive"));
 assert.equal(propImage(replaced.props![0]!),"/api/local/chair.png");
 const manifest=blenderManifest(replaced,{name:"Review",size:{w:320,h:180},seconds:4,fps:25,footage:{url:"/api/local/source.mp4",kind:"video"},grey:defaultGrey()});
 assert.equal(manifest.props[0]!.primitive,undefined);assert.ok(Object.values(manifest.assets).includes("/api/local/chair.png"));
 const dropped=dropAsset(scene,JSON.stringify({url:"/api/local/chair.png",name:"Chair"}),.1,.1,id)!;
 assert.equal(dropped.scene.props![0]!.primitive,undefined);
 assert.equal(dropped.scene.props![0]!.x,scene.props![0]!.x);
});
test("generated take installs the returned duration",()=>{
 const shot={...newShot(),seconds:9};
 const made=addGreyTake(shot,{url:"made.mp4",kind:"video",usd:0,at:1,promptHash:"x"},"Grey Room",{},{},defaultGrey(),0,3.88);
 assert.equal(clipSeconds(made),3.88);
 const next={...newShot(),render:{url:"next.mp4",kind:"video" as const,usd:0,at:2,promptHash:"x"}};
 const cut=buildCut({...createProject("Timing"),shots:[made,next]});
 assert.equal(cut.clips[1]!.start,3.88);
});
test("longer prop motion determines the control interval with a still camera",()=>{
 const scene=addStandInProp({});scene.props![0]!.keys=[{t:0,x:.2},{t:6,x:.8}];
 assert.equal(controlSeconds(defaultGrey(),scene),4.8);
 const fitted=fitControl(defaultGrey(),scene);
 assert.equal(fitted.seconds,4.84);
 assert.equal(resolveScene(fitted.scene!,fitted.end).props![0]!.x,.8);
 assert.equal(scene.props![0]!.keys![1]!.t,6);
});

test("camera and prop keys preserve their relative timing when either extends farther",()=>{
 const grey=defaultGrey(),scene=addStandInProp({});
 grey.camKeys=[{...grey.cam,t:0},{...grey.cam,t:2,distance:4}];
 scene.props![0]!.keys=[{t:0,x:.1},{t:6,x:.9}];
 let fit=fitControl(grey,scene);
 assert.equal(fit.grey.camKeys![1]!.t,1.6);assert.equal(fit.scene!.props![0]!.keys![1]!.t,4.8);
 grey.camKeys[1]!.t=6;scene.props![0]!.keys![1]!.t=2;
 fit=fitControl(grey,scene);
 assert.equal(fit.grey.camKeys![1]!.t,4.8);assert.equal(fit.scene!.props![0]!.keys![1]!.t,1.6);
 scene.props![0]!.hidden=true;assert.equal(controlSeconds(defaultGrey(),scene),3.84);
});
test("take durations, source trims and legacy defaults survive switching and JSON reopening",()=>{
 const render={url:"original.mp4",kind:"video" as const,usd:0,at:1,promptHash:"x"};
 for(const seconds of [null,9]){
  const shot={...newShot(),seconds,render,trimIn:2};
  let made=addGreyTake(shot,{...render,url:"made.mp4",at:2},"Grey Room",{},{},defaultGrey(),0,3.88);
  const original=made.takes![0]!.id,generated=made.takes![1]!.id;
  made=chooseTake(JSON.parse(JSON.stringify(made)),original);
  assert.equal(made.seconds,seconds);assert.equal(made.trimIn,2);
  made=chooseTake(made,generated);assert.equal(made.seconds,3.88);assert.equal(made.trimIn,0);
  for(const bad of [NaN,Infinity,0,-1])assert.equal(addGreyTake(shot,render,"Grey Room",{},{},undefined,0,bad).seconds,seconds);
 }
});
