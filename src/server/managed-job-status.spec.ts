import test from 'node:test';
import assert from 'node:assert/strict';
import {managedJobStatus} from './managed-job-status';
import type {Journal,JournalEntry} from './managed-job-journal';

const ref='a5a9b26a-2063-4548-994d-0c7eb076b766';
const entry:JournalEntry={submissionId:ref,userId:'owner',deployment:'https://example.run.comfy.app',outputNode:'5',state:'accepted',jobId:'job-1',jobUrl:'/api/v2/jobs/job-1'};
const journal:Journal={begin:async()=>false,accept:async()=>false,read:async(user,id)=>user===entry.userId && id===ref?entry:null};

test('status checks ownership and configured deployment before calling provider',async()=>{
  let calls=0;
  const provider={findByReference:async()=>{calls++;return null;},status:async()=>{calls++;return {status:'running',providerOutputAvailable:false};}};
  await assert.rejects(managedJobStatus('other',ref,entry.deployment,journal,provider),/not found/);
  await assert.rejects(managedJobStatus('owner',ref,'https://other.run.comfy.app',journal,provider),/deployment/);
  assert.equal(calls,0);
  assert.deepEqual(await managedJobStatus('owner',ref,entry.deployment,journal,provider),{status:'running',providerOutputAvailable:false});
  assert.equal(calls,1);
});

test('status reconciles a previously uncertain job without resubmitting it',async()=>{
  let row:JournalEntry={...entry,state:'dispatching',jobId:undefined,jobUrl:undefined};
  let finds=0, accepts=0;
  const pending:Journal={begin:async()=>false,read:async(user,id)=>user==='owner' && id===ref?row:null,accept:async(user,id,jobId,jobUrl)=>{
    assert.equal(user,'owner'); assert.equal(id,ref); accepts++;
    row={...row,state:'accepted',jobId,jobUrl}; return true;
  }};
  const provider={findByReference:async(id:string)=>{finds++;assert.equal(id,ref);return {id:'job-1',urls:{self:'/api/v2/jobs/job-1'}};},status:async()=>({status:'running',providerOutputAvailable:false})};
  assert.deepEqual(await managedJobStatus('owner',ref,entry.deployment,pending,provider),{status:'running',providerOutputAvailable:false});
  assert.equal(finds,1); assert.equal(accepts,1); assert.equal(row.state,'accepted');
});
