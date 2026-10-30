import {test} from "node:test";
import assert from "node:assert/strict";
import {sceneForShot} from "./grey-source";
import {replaceRoomSource} from "./grey-scene";
const render = (url:string) => ({url,kind:"image" as const,usd:0,promptHash:"",at:1});
test("distinct cuts use their own media; missing media never substitutes a sample",()=>{
 assert.equal(sceneForShot({render:render("/robot.png")}).source?.url,"/robot.png");
 assert.equal(sceneForShot({render:render("/forest.png")}).source?.url,"/forest.png");
 assert.equal(sceneForShot(undefined).source,undefined);
});
test("saved source survives reopen and new rendered take; explicit replacement stays local to its shot",()=>{
 const first=sceneForShot({render:render("/robot.png")});
 const saved=JSON.parse(JSON.stringify({...first,look:{warmth:.4}}));
 assert.equal(sceneForShot({greyScene:saved,render:render("/finished.png")}).source?.url,"/robot.png");
 const changed=replaceRoomSource(first,{url:"/upload.png",kind:"image"});
 assert.equal(sceneForShot({greyScene:changed,render:render("/robot.png")}).source?.url,"/upload.png");
 assert.equal(first.source?.url,"/robot.png");
});
test("trimmed video preserves the selected source start across save/reopen",()=>{
 const shot={render:{...render('/clip.mp4'),kind:'video' as const},trimIn:2};
 const scene=sceneForShot(shot);
 assert.equal(scene.source?.trimIn,2);
 assert.equal(sceneForShot({...shot,greyScene:JSON.parse(JSON.stringify(scene))}).source?.trimIn,2);
 assert.equal(sceneForShot({render:render('/still.png'),trimIn:2}).source?.trimIn,undefined);
});
