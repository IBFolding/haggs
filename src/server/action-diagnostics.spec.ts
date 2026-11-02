import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAction} from './action-diagnostics';

test('diagnostics preserve results and contain only fixed metadata',async()=>{
 const events:unknown[]=[];const result={ok:false,reason:'private prompt and secret'};
 assert.equal(await diagnoseAction('media_generation',async()=>result,event=>events.push(event)),result);
 assert.equal(events.length,2);assert.deepEqual(events[0],{event:'action_started',action:'media_generation'});
 const finish=events[1] as Record<string,unknown>;assert.deepEqual(Object.keys(finish).sort(),['action','durationMs','event','outcome']);assert.equal(finish.outcome,'returned');assert.equal(typeof finish.durationMs,'number');assert.doesNotMatch(JSON.stringify(events),/private|secret/);
});
test('diagnostics rethrow unchanged and logging failure cannot affect a run',async()=>{
 const error=new Error('private provider error'),events:unknown[]=[];
 await assert.rejects(diagnoseAction('video_edit',async()=>{throw error;},event=>events.push(event)),caught=>caught===error);
 assert.equal((events[1] as {outcome:string}).outcome,'threw');assert.doesNotMatch(JSON.stringify(events),/private|provider/);
 assert.equal(await diagnoseAction('video_edit',async()=>42,()=>{throw Error('log failed');}),42);
});
