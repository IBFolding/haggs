import {test} from "node:test";
import assert from "node:assert/strict";
import {defaultGrey} from "./grey";
import {presetKeys} from "./grey-camera";
import {addStandInProp,type SceneProposal} from "./grey-space";
import {ALL_PROPOSAL_PARTS} from "./grey-proposal";
import {previewSceneProposal} from "./grey-proposal-preview";
const proposal:SceneProposal={version:1,summary:"Kitchen",room:{floor:"wood",wall:"plaster"},people:[{label:"Avery",x:1,z:1}],props:[{name:"Table",material:"wood",x:0,z:1}],camera:{angle:30,distance:4,height:1.2,lens:50},light:{az:300,el:30}};

test("visual proposal review is local, preserves existing records and previews the selected camera behavior",()=>{
 const grey={...defaultGrey(),camKeys:presetKeys("Push in",defaultGrey().cam)};
 const scene=addStandInProp({source:{url:"https://private.example/source",kind:"video"},references:[{id:"r",name:"Reference",url:"https://private.example/ref"}],space:{floor:"metal",wall:"concrete"}});
 const original=JSON.stringify({grey,scene});
 const review=previewSceneProposal(grey,scene,proposal,false,ALL_PROPOSAL_PARTS,true,0);
 assert.equal(JSON.stringify({grey,scene}),original);assert.equal(review.peopleAdded,1);assert.equal(review.propsAdded,1);
 assert.deepEqual(review.candidate.scene.props![0],scene.props![0]);assert.deepEqual(review.candidate.scene.source,scene.source);assert.deepEqual(review.candidate.grey.camKeys,grey.camKeys);
 assert.match(review.after,/viewBox="0 0 360 640"/);assert.doesNotMatch(review.after,/private.example|<image|<script/);
 const later=previewSceneProposal(grey,scene,proposal,false,ALL_PROPOSAL_PARTS,true,6);assert.notEqual(later.after,review.after);
 const camera=previewSceneProposal(grey,scene,proposal,true,ALL_PROPOSAL_PARTS,true,0);assert.equal(camera.candidate.grey.camKeys,undefined);assert.deepEqual(camera.candidate.grey.cam,proposal.camera);assert.notEqual(camera.after,review.after);
});
test("selective proposal review keeps opted-out room, people and props and resolves capacity before apply",()=>{
 const grey=defaultGrey(["1","2","3","4"]);grey.subjects.push({id:"5",label:"5",x:0,z:0},{id:"6",label:"6",x:1,z:0});
 const scene=addStandInProp({space:{floor:"metal",wall:"concrete"}});
 assert.throws(()=>previewSceneProposal(grey,scene,proposal,false,ALL_PROPOSAL_PARTS,false,0),/six figures/);
 const review=previewSceneProposal(grey,scene,proposal,false,{people:false,props:false,room:false},false,0);
 assert.equal(review.peopleAdded,0);assert.equal(review.propsAdded,0);assert.deepEqual(review.candidate.scene,scene);assert.deepEqual(review.candidate.grey,grey);assert.equal(review.after,review.before);
 const onlyProps=previewSceneProposal(grey,scene,proposal,false,{people:false,props:true,room:false},false,NaN);
 assert.equal(onlyProps.propsAdded,1);assert.deepEqual(onlyProps.candidate.scene.space,scene.space);assert.deepEqual(onlyProps.candidate.grey.subjects,grey.subjects);
});


test("review scrubs the proposed AI move without changing the saved scene or camera",()=>{
 const grey=defaultGrey(),scene=addStandInProp({});
 const before=JSON.stringify({grey,scene});
 const moving={...proposal,cameraPath:[{t:0,...proposal.camera},{t:6,...proposal.camera,angle:90,distance:2}]};
 const start=previewSceneProposal(grey,scene,moving,true,ALL_PROPOSAL_PARTS,false,0);
 const end=previewSceneProposal(grey,scene,moving,true,ALL_PROPOSAL_PARTS,false,6);
 assert.notEqual(start.after,end.after);assert.deepEqual(start.candidate.grey.camKeys,moving.cameraPath);
 assert.equal(JSON.stringify({grey,scene}),before);
 const kept=previewSceneProposal(grey,scene,moving,false,ALL_PROPOSAL_PARTS,false,6);
 assert.equal(kept.candidate.grey.camKeys,undefined);
});
