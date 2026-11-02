import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedGreyMaximum} from './grey-spending';
import {askClaude} from '../writer/draft';
import {greyClaudeCharge} from './grey-claude-billing';
const env={HAGGS_GREY_AI_PRICING_MODEL:'claude-sonnet-5-5',HAGGS_GREY_AI_INPUT_USD_PER_MILLION:'2',HAGGS_GREY_AI_OUTPUT_USD_PER_MILLION:'10'};
test('full-context reservation bounds planning and never unlocks media or changed tariffs',()=>{
 assert.equal(verifiedGreyMaximum('proposal',env),2.03);
 assert.ok(2.03>=(1_000_000*2+2500*10)/1_000_000);
 assert.equal(verifiedGreyMaximum('still',env),undefined);assert.equal(verifiedGreyMaximum('video',env),undefined);
 assert.equal(verifiedGreyMaximum('proposal',{...env,HAGGS_GREY_AI_INPUT_USD_PER_MILLION:'3'}),undefined);
});
test('bounded transport forces standard/global routing, one call, exact output ceiling, no tools/cache',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async(_url,init)=>{calls++;const b=JSON.parse(String(init?.body));assert.equal(b.model,'claude-sonnet-5-5');assert.equal(b.max_tokens,2500);assert.equal(b.service_tier,'standard_only');assert.equal(b.inference_geo,'global');assert.equal(b.speed,'standard');assert.equal(b.tools,undefined);assert.equal(b.cache_control,undefined);return Response.json({}, {status:503});};
 await askClaude({key:'fixture',request:{system:'test',user:'test',maxTokens:2500},boundedGreyPlanning:true,fetch:fetcher});assert.equal(calls,1);
 await askClaude({key:'fixture',request:{system:'test',user:'test',maxTokens:2501},boundedGreyPlanning:true,fetch:fetcher});assert.equal(calls,1);
});
test('documented zero ancillary fields and included thinking settle; actual extras retain reservation',()=>{
 const usage={input_tokens:1000,output_tokens:100,cache_creation_input_tokens:0,cache_read_input_tokens:0,service_tier:'standard',inference_geo:'global',speed:'standard',cache_creation:{ephemeral_1h_input_tokens:0,ephemeral_5m_input_tokens:0},server_tool_use:{web_search_requests:0,web_fetch_requests:0},output_tokens_details:{thinking_tokens:50}};
 assert.equal(greyClaudeCharge({model:env.HAGGS_GREY_AI_PRICING_MODEL,usage},env),.003);
 for(const patch of [{speed:'fast'},{output_tokens_details:{thinking_tokens:101}},{cache_creation:{ephemeral_1h_input_tokens:1}},{server_tool_use:{web_search_requests:1}}])assert.equal(greyClaudeCharge({model:env.HAGGS_GREY_AI_PRICING_MODEL,usage:{...usage,...patch}},env),null);
});
