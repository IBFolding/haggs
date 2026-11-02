import assert from "node:assert/strict";
import test from "node:test";
import {keepProviderShots,TEMPORARY_OUTPUT_WARNING} from "./provider-output-saving";
test("failed saving preserves the paid output with a durable warning and never retries generation",async()=>{
 const original={url:"https://provider.example/result.mp4",kind:"video" as const};let reads=0,saves=0;
 const result=await keepProviderShots([original],async()=>{saves++;throw Error("store unavailable");},async()=>{reads++;return new Response("synthetic",{headers:{"content-type":"video/mp4"}});});
 assert.deepEqual(result,[{...original,storageWarning:TEMPORARY_OUTPUT_WARNING}]);assert.equal(reads,1);assert.equal(saves,1);assert.deepEqual(original,{url:"https://provider.example/result.mp4",kind:"video"});
 const reopened=JSON.parse(JSON.stringify(result));assert.equal(reopened[0].storageWarning,TEMPORARY_OUTPUT_WARNING);
});
test("successful saving replaces the temporary link and clears the warning",async()=>{
 const result=await keepProviderShots([{url:"https://provider.example/result.mp4",kind:"video",storageWarning:TEMPORARY_OUTPUT_WARNING}],async()=>"/api/media/haggs/fixture.mp4",async()=>new Response("synthetic",{headers:{"content-type":"video/mp4"}}));
 assert.deepEqual(result,[{url:"/api/media/haggs/fixture.mp4",kind:"video"}]);
});
