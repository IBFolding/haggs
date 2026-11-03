import {test} from "node:test";
import assert from "node:assert/strict";
import {greyGenerationEnabled,greyStillEnabled,greyVideoEnabled,greyMatteEnabled,greyMatteEstimateUsd,GREY_GENERATION_HOLD} from "./grey-generation-policy";
import {makeGreyFirstFrame,makeGreyShot,greyGenerationAvailability} from "../app/grey-shot-actions";
test("paid Grey generation is strictly opt-in",()=>{
 for(const value of [undefined,"0","false","true",""]){assert.equal(greyGenerationEnabled({HAGGS_GREY_AI_ENABLED:value}),false);}
 assert.equal(greyGenerationEnabled({HAGGS_GREY_AI_ENABLED:"1"}),false);
 assert.equal(greyStillEnabled({HAGGS_GREY_STILL_ENABLED:"1"}),true);
 assert.equal(greyVideoEnabled({HAGGS_GREY_STILL_ENABLED:"1"}),false);
 assert.equal(greyVideoEnabled({HAGGS_GREY_VIDEO_ENABLED:"1"}),true);
 assert.equal(greyStillEnabled({HAGGS_GREY_VIDEO_ENABLED:"1"}),false);
});
test("disabled server actions reject before reading inputs or touching provider/auth",async()=>{
 const before=process.env.HAGGS_GREY_AI_ENABLED;
 try{for(const value of [undefined,"0"]){if(value===undefined)delete process.env.HAGGS_GREY_AI_ENABLED;else process.env.HAGGS_GREY_AI_ENABLED=value;
 assert.equal((await greyGenerationAvailability()).enabled,false);
 assert.deepEqual(await makeGreyFirstFrame(undefined as never),{ok:false,reason:GREY_GENERATION_HOLD});
 assert.deepEqual(await makeGreyShot(undefined as never),{ok:false,reason:GREY_GENERATION_HOLD});
 }}finally{if(before===undefined)delete process.env.HAGGS_GREY_AI_ENABLED;else process.env.HAGGS_GREY_AI_ENABLED=before;}
});

test("enabled paid actions still reject missing consent before provider/auth access",async()=>{
 const still=process.env.HAGGS_GREY_STILL_ENABLED,video=process.env.HAGGS_GREY_VIDEO_ENABLED;
 try{process.env.HAGGS_GREY_STILL_ENABLED='1';process.env.HAGGS_GREY_VIDEO_ENABLED='1';
 assert.equal((await makeGreyFirstFrame(undefined as never)).ok,false);
 assert.equal((await makeGreyShot(undefined as never)).ok,false);
 }finally{if(still===undefined)delete process.env.HAGGS_GREY_STILL_ENABLED;else process.env.HAGGS_GREY_STILL_ENABLED=still;if(video===undefined)delete process.env.HAGGS_GREY_VIDEO_ENABLED;else process.env.HAGGS_GREY_VIDEO_ENABLED=video;}
});
test('cloud cut-out needs both its switch and an owner-set estimate',()=>{
 assert.equal(greyMatteEnabled({}),false);
 assert.equal(greyMatteEnabled({HAGGS_GREY_MATTE_ENABLED:'1'}),false);
 assert.equal(greyMatteEnabled({HAGGS_GREY_MATTE_ESTIMATE_USD:'0.5'}),false);
 assert.equal(greyMatteEnabled({HAGGS_GREY_MATTE_ENABLED:'1',HAGGS_GREY_MATTE_ESTIMATE_USD:'abc'}),false);
 assert.equal(greyMatteEnabled({HAGGS_GREY_MATTE_ENABLED:'1',HAGGS_GREY_MATTE_ESTIMATE_USD:'0.5'}),true);
 assert.equal(greyMatteEstimateUsd({HAGGS_GREY_MATTE_ESTIMATE_USD:'0.5'}),0.5);
});
