import {test} from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {primitivePng} from "./grey-primitive";
import {addStandInProp} from "../story/grey-space";
import {greyPlan} from "../story/grey-render";
test("box renders owned geometry regardless of untrusted URL and material",async()=>{
 const box=addStandInProp({}).props![0]!;
 const {primitive:_primitive,...image}=box;
 const safe=await primitivePng(box);
 assert.deepEqual(await primitivePng({...box,url:"file:///etc/passwd",material:"<script>" as never}),safe);
 assert.equal((await sharp(safe).metadata()).width,160);
 assert.notDeepEqual(await primitivePng({...box,material:"wood"}),safe);
 await assert.rejects(primitivePng({...box,hidden:true}));
 await assert.rejects(primitivePng(image));
 const plan=greyPlan({props:[box,{...box,id:"hidden",hidden:true}]},{w:320,h:180},.5,"source.mp4");
 assert.equal(plan.inputs.filter(i=>i.role==="primitive").length,1);
 assert.ok(!plan.inputs.some(i=>i.ref===box.url||i.ref==="hidden"));
});
