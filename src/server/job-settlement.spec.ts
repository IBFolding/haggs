import test from 'node:test';
import assert from 'node:assert/strict';
import {charged} from './platform';
import {markJob} from '../providers/job-outcome';
test('unknown submission and completed-provider save failure retain reservation; confirmed rejection refunds',async()=>{
 for(const state of ['uncertain','completed','rejected'] as const){const settled:boolean[]=[];const result=await charged({ok:true,key:'fixture',platform:true,settle:async done=>{settled.push(done);}},async()=>{markJob(state,'job-fixture');return {ok:false,reason:'Save failed'};});assert.deepEqual(settled,[state!=='rejected']);assert.equal(result.reason.includes('remain reserved'),state!=='rejected');}
});
test('concurrent run outcome state does not leak into another run',async()=>{
 const results=await Promise.all(['uncertain','rejected'].map(async state=>{let settled=false;await charged({ok:true,key:'fixture',platform:true,settle:async done=>{settled=done;}},async()=>{markJob(state as 'uncertain'|'rejected');await Promise.resolve();return{ok:false};});return settled;}));assert.deepEqual(results,[true,false]);
});
