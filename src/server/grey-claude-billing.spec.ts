import {test} from 'node:test';import assert from 'node:assert/strict';
import {greyClaudeCharge} from './grey-claude-billing';
import {askClaude} from '../writer/draft';
const env={HAGGS_GREY_AI_PRICING_MODEL:'claude-sonnet-5-5',HAGGS_GREY_AI_INPUT_USD_PER_MILLION:'2',HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION:'10'};
const receipt={model:'claude-sonnet-5-5',usage:{input_tokens:1000,output_tokens:100,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard',inference_geo:'global'}};
test('only complete reviewed Claude billing dimensions settle a charge',()=>{
 assert.equal(greyClaudeCharge(receipt,env),.003);
 for(const patch of [{input_tokens:undefined},{output_tokens:-1},{input_tokens:NaN},{service_tier:'priority'},{inference_geo:'us'},{cache_read_input_tokens:1},{server_tool_use:{web_search_requests:1}}])assert.equal(greyClaudeCharge({...receipt,usage:{...receipt.usage,...patch}},env),null);
 assert.equal(greyClaudeCharge({...receipt,model:'other'},env),null);assert.equal(greyClaudeCharge(receipt,{...env,HAGGS_GREY_AI_INPUT_USD_PER_MILLION:'3'}),null);
 assert.equal(greyClaudeCharge({model:receipt.model},env),null);
});
test('Claude transport reports billed usage even for truncated or malformed output; network failures do not invent zero',async()=>{
 const request={system:'test',user:'test',maxTokens:10};
 for(const stop of ['max_tokens','end_turn']){
  const seen:unknown[]=[];
  const result=await askClaude({key:'mock-only',request,onBilling:r=>seen.push(r),fetch:async()=>Response.json({...receipt,stop_reason:stop,content:[{type:'text',text:'invalid json'}]})});
  assert.equal(result.ok,false);assert.deepEqual(seen,[receipt]);
 }
 let observed=false;await askClaude({key:'mock-only',request,onBilling:()=>{observed=true;},fetch:async()=>{throw Error('network');}});assert.equal(observed,false);
});
