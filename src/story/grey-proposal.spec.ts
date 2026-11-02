import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultGrey } from "./grey";
import { presetKeys } from "./grey-camera";
import { addStandInProp, requestSceneProposal } from "./grey-space";
import { applySceneProposal, createSceneProposalProvider, manualProposalRequest, readSceneProposal } from "./grey-proposal";

const proposal = { version:1 as const, summary:"Quiet kitchen", room:{floor:"wood" as const,wall:"plaster" as const},people:[{label:"Rowan",x:2,z:1},{label:"Avery",x:-1,z:0}],props:[{name:"Table",x:1,z:1}],camera:{angle:30,distance:4,height:1.2,lens:50},light:{az:300,el:30} };
test("manual AI request/reply supports full review without a network provider",()=>{
 const grey=defaultGrey(["Rowan"]), scene={direction:"Kitchen at dawn",references:[{id:"r",name:"Kitchen reference",url:"https://private.example/image?secret=123"}]};
 const request=manualProposalRequest({description:scene.direction,references:scene.references,grey,scene});
 assert.match(request,/Kitchen at dawn/);assert.match(request,/Kitchen reference/);assert.doesNotMatch(request,/secret=123/);
 assert.deepEqual(readSceneProposal('```json\n'+JSON.stringify(proposal)+'\n```'),proposal);
 assert.throws(()=>readSceneProposal(JSON.stringify({...proposal,camera:{...proposal.camera,lens:-1}})));
 assert.throws(()=>readSceneProposal("a".repeat(50001)));
});
test("mocked provider receives bounded schema/context and returns a validated proposal without applying it",async()=>{
 let calls=0;const grey=defaultGrey(),scene={};const before=JSON.stringify(grey);
 const provider=createSceneProposalProvider(async(request,schema,signal)=>{calls++;assert.equal(signal.aborted,false);assert.ok(schema.properties);assert.match(request.user,/Kitchen/);return proposal});
 const result=await requestSceneProposal(provider,{description:"Kitchen",references:[],grey,scene},new AbortController().signal);
 assert.equal(calls,1);assert.deepEqual(result,proposal);assert.equal(JSON.stringify(grey),before);
 await assert.rejects(requestSceneProposal(provider,{description:"",references:[],grey,scene},new AbortController().signal));assert.equal(calls,1);
});
test("applying a proposal preserves existing props, locks, references, footage and camera paths by default",()=>{
 const grey={...defaultGrey(["Rowan"]),camKeys:presetKeys("Push in",defaultGrey().cam)};
 const scene=addStandInProp({source:{url:"original.mp4",kind:"video"},references:[{id:"r",url:"ref.png",name:"Reference"}],surfaces:[{id:"wall",label:"Wall",strength:.8}]});
 scene.props![0]!.locked=true;const before=JSON.stringify({grey,scene});
 const result=applySceneProposal(grey,scene,proposal);
 assert.equal(JSON.stringify({grey,scene}),before);assert.deepEqual(result.grey.camKeys,grey.camKeys);assert.deepEqual(result.grey.cam,grey.cam);
 assert.equal(result.grey.subjects[0]!.x,0);assert.equal(result.grey.subjects.length,2);assert.equal(result.grey.subjects[1]!.label,"Avery");
 assert.deepEqual(result.scene.props![0],scene.props![0]);assert.deepEqual(result.scene.source,scene.source);assert.deepEqual(result.scene.references,scene.references);assert.deepEqual(result.scene.surfaces,scene.surfaces);
 assert.equal(result.scene.props![1]!.primitive,"box");assert.equal(result.scene.props![1]!.name,"Table");
 const again=applySceneProposal(result.grey,result.scene,proposal);assert.equal(again.scene.props!.length,2);assert.equal(again.grey.subjects.length,2);
 const camera=applySceneProposal(grey,scene,proposal,true);assert.equal(camera.grey.camKeys,undefined);assert.deepEqual(camera.grey.cam,proposal.camera);assert.deepEqual(camera.grey.light,proposal.light);
});
test("capacity refusal never truncates existing people or partially mutates a scene",()=>{
 const grey=defaultGrey(["1","2","3","4"]);grey.subjects.push({id:"5",label:"5",x:0,z:0},{id:"6",label:"6",x:0,z:0});
 const before=JSON.stringify(grey);assert.throws(()=>applySceneProposal(grey,{},proposal),/six figures/);assert.equal(JSON.stringify(grey),before);
});


test("reviewed AI materials apply only to added props and remain in bounded provider context",async()=>{
 const {proposalContext}=await import("./grey-proposal-context");
 const grey=defaultGrey(),scene=addStandInProp({});scene.props![0]!.material="metal";
 const planned={...proposal,props:[{name:"Box stand-in",x:1,z:1,material:"wood" as const},{name:"Table",x:0,z:0,material:"wood" as const}]};
 const result=applySceneProposal(grey,scene,readSceneProposal(JSON.stringify(planned)));
 assert.equal(result.scene.props![0]!.material,"metal");assert.equal(result.scene.props![1]!.material,"wood");
 const input={description:"Kitchen",references:[],grey,scene:result.scene};
 assert.equal(proposalContext(input).props[1]!.material,"wood");assert.match(manualProposalRequest(input),/"material":"wood"/);
 assert.throws(()=>readSceneProposal(JSON.stringify({...planned,props:[{name:"Bad",x:0,z:0,material:"invalid"}]})));
});


test("AI camera moves remain optional and replace existing motion only after camera consent",()=>{
 const grey={...defaultGrey(),camKeys:presetKeys("Orbit",defaultGrey().cam)};
 const cameraPath=[{t:0,...proposal.camera},{t:6,...proposal.camera,angle:390,distance:2}];
 const moving={...proposal,cameraPath};
 const parsed=readSceneProposal(JSON.stringify(moving));
 assert.deepEqual(parsed.cameraPath,cameraPath);
 const kept=applySceneProposal(grey,{},moving);assert.deepEqual(kept.grey.camKeys,grey.camKeys);
 const applied=applySceneProposal(grey,{},moving,true);assert.deepEqual(applied.grey.camKeys,cameraPath);
 assert.notEqual(applied.grey.camKeys,cameraPath);assert.deepEqual(grey.camKeys,presetKeys("Orbit",defaultGrey().cam));
});
test("AI camera paths reject malformed, unordered, oversized and incomplete motion",()=>{
 const key={...proposal.camera,t:0},end={...proposal.camera,t:6};
 for(const cameraPath of [[],[key],[end,key],[key,key,end],[{...key,t:1},end],[key,{...end,t:5}],[key,{...key,t:.01},end],[key,{...end,angle:900}],Array.from({length:13},(_,i)=>({...key,t:i/2}))]) {
  assert.throws(()=>readSceneProposal(JSON.stringify({...proposal,cameraPath})));
 }
 assert.equal(readSceneProposal(JSON.stringify({...proposal,cameraPath:[key,{...key,t:.1},{...key,t:.15},end]})).cameraPath!.length,4);
 assert.equal(readSceneProposal(JSON.stringify(proposal)).cameraPath,undefined);
});


test("AI people can propose facing without changing an existing person's orientation",()=>{
 const grey=defaultGrey(["Rowan"]);grey.subjects[0]={...grey.subjects[0]!,facing:270};
 const parsed=readSceneProposal(JSON.stringify({...proposal,people:[{label:"Rowan",x:1,z:1,facing:0},{label:"Avery",x:0,z:0,facing:90}]}));
 const next=applySceneProposal(grey,{},parsed);
 assert.equal(next.grey.subjects[0]!.facing,270);assert.equal(next.grey.subjects[1]!.facing,90);
 assert.throws(()=>readSceneProposal(JSON.stringify({...proposal,people:[{label:"Avery",x:0,z:0,facing:Infinity}]})));
});
