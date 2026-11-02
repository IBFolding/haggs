import {test} from "node:test";
import assert from "node:assert/strict";
import {bakeFigureMotion} from "./grey-blender-motion";
import {defaultGrey,subjectFacing} from "./grey";
import {figureSegments} from "./grey-figure";
import {camAt,presetKeys} from "./grey-camera";

test("walking export samples exactly the shared guide geometry with camera motion and facing",()=>{
 const grey={...defaultGrey(),pose:"walk" as const};grey.subjects[0]={...grey.subjects[0]!,facing:90};grey.camKeys=presetKeys("Orbit",grey.cam);
 const subject=grey.subjects[0]!,before=JSON.stringify(grey),samples=bakeFigureMotion(grey,subject,48,12);
 assert.equal(samples.length,48);assert.equal(samples[0]!.frame,1);assert.equal(samples.at(-1)!.frame,48);
 for(const i of [0,12,24,47]){const t=i/12,cam=camAt(grey.cam,grey.camKeys,t),a=cam.angle*Math.PI/180;
  assert.deepEqual(samples[i]!.segments,figureSegments(subject,t,"walk",subjectFacing(subject),{x:Math.sin(a)*cam.distance,z:-Math.cos(a)*cam.distance,min:3.2}));}
 assert.equal(JSON.stringify(grey),before);
});
test("walking export keeps the guide's camera stop and rejects unbounded bake requests",()=>{
 const grey={...defaultGrey(),pose:"walk" as const},subject=grey.subjects[0]!;
 const samples=bakeFigureMotion(grey,subject,144,24);
 for(const sample of samples){const hip=sample.segments[0]!.a;assert.ok(Math.hypot(hip.x,hip.z+5)>=3.19);}
 for(const [frames,fps] of [[0,24],[2881,24],[1,0],[1,61],[1,NaN],[1.5,24]])assert.throws(()=>bakeFigureMotion(grey,subject,frames!,fps!));
});
