import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openWorkflowSafely} from './open-workflow-safe';

test('a rejected open returns a retryable error without exposing server details',async()=>{
 const result=await openWorkflowSafely(async()=>{throw Error('private server details');});
 assert.deepEqual(result,{ok:false,reason:"Couldn't open this workflow. Check your connection and try again."});
});
test('ordinary workflow errors are preserved for the existing recovery actions',async()=>{
 const result={ok:false as const,reason:'Connect first',needsKey:true};
 assert.deepEqual(await openWorkflowSafely(async()=>result),result);
});
