import {test} from "node:test";
import assert from "node:assert/strict";
import {greyProposalAvailability,quoteGreyProposal,generateGreyProposal} from "../app/grey-proposal-actions";
test("actual actions keep image proposals disabled when the main rollout is off, even with the vision flag set",async()=>{
 const before=process.env.HAGGS_GREY_AI_ENABLED,vision=process.env.HAGGS_GREY_AI_VISION_ENABLED;
 try{process.env.HAGGS_GREY_AI_ENABLED="0";process.env.HAGGS_GREY_AI_VISION_ENABLED="1";
  assert.equal((await greyProposalAvailability()).visionEnabled,false);
  assert.equal((await quoteGreyProposal(undefined)).ok,false);
  assert.equal((await generateGreyProposal(undefined,"not-a-quote",true)).ok,false);
 }finally{if(before===undefined)delete process.env.HAGGS_GREY_AI_ENABLED;else process.env.HAGGS_GREY_AI_ENABLED=before;if(vision===undefined)delete process.env.HAGGS_GREY_AI_VISION_ENABLED;else process.env.HAGGS_GREY_AI_VISION_ENABLED=vision;}
});
