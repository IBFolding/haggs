import {test} from "node:test";
import assert from "node:assert/strict";
import {appendGreySetupShot} from "./grey-setup-shot";
import {defaultGrey} from "./grey";
import {presetKeys} from "./grey-camera";
import {addStandInProp} from "./grey-space";
import {newShot,type Project} from "./model";
import {view} from "./boards";
const source={...newShot(),heading:"Kitchen",beat:"Rowan waits",seconds:5,threadIds:["rowan"],grey:{...defaultGrey(),camKeys:presetKeys("Push in",defaultGrey().cam)},render:{url:"take.mp4",kind:"video" as const,at:1,usd:1,promptHash:"x"},approved:true,takes:[{id:"take",url:"take.mp4",kind:"video" as const,at:1,usd:1,promptHash:"x"}]};
const project={id:"p",name:"Film",createdAt:1,updatedAt:1,shots:[source],notes:[],threads:[],direction:{camera:"",light:"",staging:"",constants:""}} as Project;
const scene=addStandInProp({source:{url:"original.mp4",kind:"video"},matte:{url:"actor.webm",at:1,price:"0"},space:{floor:"wood",wall:"plaster"},references:[{id:"ref",url:"ref.png",name:"Reference"}],surfaces:[{id:"wall",label:"Wall",strength:.8,mask:{url:"wall.png",at:1,price:"0"},texture:{url:"wood.png",name:"Wood",scale:1}}]});

test("a new setup shot preserves the original and its takes, and starts without footage or approval",()=>{
 const before=JSON.stringify({project,scene});const result=appendGreySetupShot(project,undefined,source.id,scene,"Reverse angle","Rowan turns");
 assert.equal(JSON.stringify({project,scene}),before);const shots=view(result.project).shots;assert.equal(shots.length,2);assert.deepEqual(shots[0],source);assert.notEqual(shots[1]!.id,source.id);
 const draft=result.shot;assert.equal(draft.heading,"Reverse angle");assert.equal(draft.beat,"Rowan turns");assert.equal(draft.render,undefined);assert.equal(draft.takes,undefined);assert.equal(draft.approved,undefined);
 assert.equal(draft.greyScene.source,undefined);assert.equal(draft.greyScene.matte,undefined);assert.equal(draft.greyScene.surfaces![0]!.mask,undefined);assert.deepEqual(draft.greyScene.surfaces![0]!.texture,scene.surfaces![0]!.texture);
 assert.deepEqual(draft.grey,source.grey);assert.deepEqual(draft.greyScene.props,scene.props);assert.deepEqual(draft.greyScene.references,scene.references);
 draft.grey.camKeys![0]!.lens=85;draft.greyScene.props![0]!.name="Changed";draft.model.settings.test=true;
 assert.notEqual(source.grey.camKeys![0]!.lens,85);assert.equal(scene.props![0]!.name,"Box stand-in");assert.equal(source.model.settings.test,undefined);
});
test("setup creation is board scoped, inserts after the source and leaves other boards intact",()=>{
 const second={...newShot(),heading:"Other"};const full={...project,shots:[],boards:[{id:"one",name:"One",kind:"board" as const,shots:[source,second],notes:[]},{id:"two",name:"Two",kind:"board" as const,shots:[newShot()],notes:[]}]};
 const result=appendGreySetupShot(full,"one",source.id,scene,"Next","");assert.equal(result.shot.beat,source.beat);
 assert.deepEqual(result.project.boards![1],full.boards[1]);assert.deepEqual(view(result.project,"one").shots.map(s=>s.id),[source.id,result.shot.id,second.id]);
 assert.throws(()=>appendGreySetupShot(full,"two",source.id,scene,"Next",""),/no longer available/);
 assert.throws(()=>appendGreySetupShot(full,"one",source.id,scene," ",""),/name/);
});
