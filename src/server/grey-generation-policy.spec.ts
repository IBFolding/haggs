import {test} from "node:test";
import assert from "node:assert/strict";
import {greyGenerationEnabled,GREY_GENERATION_HOLD} from "./grey-generation-policy";
import {makeGreyFirstFrame,makeGreyShot,greyGenerationAvailability} from "../app/grey-shot-actions";
test("paid Grey generation is strictly opt-in",()=>{
 for(const value of [undefined,"0","false","true",""]){assert.equal(greyGenerationEnabled({HAGGS_GREY_AI_ENABLED:value}),false);}
 assert.equal(greyGenerationEnabled({HAGGS_GREY_AI_ENABLED:"1"}),true);
});
test("disabled server actions reject before reading inputs or touching provider/auth",async()=>{
 const before=process.env.HAGGS_GREY_AI_ENABLED;
 try{for(const value of [undefined,"0"]){if(value===undefined)delete process.env.HAGGS_GREY_AI_ENABLED;else process.env.HAGGS_GREY_AI_ENABLED=value;
 assert.equal((await greyGenerationAvailability()).enabled,false);
 assert.deepEqual(await makeGreyFirstFrame(undefined as never),{ok:false,reason:GREY_GENERATION_HOLD});
 assert.deepEqual(await makeGreyShot(undefined as never),{ok:false,reason:GREY_GENERATION_HOLD});
 }}finally{if(before===undefined)delete process.env.HAGGS_GREY_AI_ENABLED;else process.env.HAGGS_GREY_AI_ENABLED=before;}
});
