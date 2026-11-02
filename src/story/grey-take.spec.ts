import {test} from "node:test";
import assert from "node:assert/strict";
import {addGreyTake,restoreGreyTakeSetup} from "./grey-take";
import {chooseTake} from "./takes";
import {newShot} from "./model";
import {defaultGrey} from "./grey";
import {addStandInProp} from "./grey-space";
test("generated input A survives concurrent edit B, take switching and saved project round trip",()=>{
 const a=addStandInProp({space:{floor:"wood",wall:"plaster"}}),b={...a,space:{floor:"metal" as const,wall:"concrete" as const}};
 const frame=defaultGrey(),render={url:"original.mp4",kind:"video" as const,usd:0,at:1,promptHash:"x"};
 const original={...newShot(),grey:frame,greyScene:a,render,trimIn:2};
 let result=addGreyTake({...original,greyScene:b},{...render,url:"generated.mp4"},"Grey Room",a,b,frame,2);
 const first=result.takes![0]!.id,last=result.takes!.at(-1)!.id;
 result=chooseTake(chooseTake(result,first),last);
 result=JSON.parse(JSON.stringify(result));
 assert.deepEqual(result.greyScene,b);
 assert.deepEqual(result.takes!.at(-1)!.greySetup,{scene:a,frame,time:2});
 const restored=restoreGreyTakeSetup(result,last);
 assert.deepEqual(restored.greyScene,a);assert.deepEqual(restored.render,result.render);assert.deepEqual(restored.takes,result.takes);
 restored.greyScene!.props![0]!.name="edited";
 assert.equal(result.takes!.at(-1)!.greySetup!.scene.props![0]!.name,"Box stand-in");
});
test("legacy scene-only callers also retain inputs and legacy takes restore unchanged",()=>{
 const shot=newShot(),scene=addStandInProp({});
 assert.equal(restoreGreyTakeSetup(shot,"missing"),shot);
 const result=addGreyTake(shot,{url:"draft.mp4",kind:"video",usd:0,at:1,promptHash:"x"},"draft",scene,{});
 assert.deepEqual(result.takes![0]!.greySetup!.scene,scene);
 assert.equal(result.takes![0]!.greySetup!.frame,undefined);
});
