import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownedComfyExecution} from './owned-comfy-execution';
import {saveManagedOutput} from './managed-output-save';
import type {Journal,JournalEntry} from './managed-job-journal';
import type {ManagedOutput} from './managed-output-journal';

test('fake customer job recovers an output after an uncertain upload without another job or upload',async()=>{
 const jobs=new Map<string,JournalEntry>(), outputs=new Map<string,ManagedOutput>(), blobs=new Map<string,Uint8Array>();
 let submissions=0, uploads=0, lostResponse=true;
 const journal:Journal={
  begin:async e=>{if(jobs.has(e.submissionId))return false;jobs.set(e.submissionId,e);return true;},
  accept:async(u,r,id,url)=>{const e=jobs.get(r);if(!e||e.userId!==u||e.state!=='dispatching')return false;jobs.set(r,{...e,state:'accepted',jobId:id,jobUrl:url});return true;},
  read:async(u,r)=>{const e=jobs.get(r);return e?.userId===u?e:null;},
 };
 const outputJournal={
  read:async(u:string,r:string)=>{const e=outputs.get(r);return e?.userId===u?e:null;},
  claim:async(e:ManagedOutput)=>{if(outputs.has(e.submissionId))return 'existing' as const;outputs.set(e.submissionId,e);return 'created' as const;},
  verifyAndCommit:async(e:ManagedOutput)=>{const data=blobs.get(e.pathname);assert.deepEqual(data,new Uint8Array([1,2,3]));return `saved:${e.pathname}`;},
 };
 const owner='11111111-1111-4111-8111-111111111111', id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const deps={connection:async(userId:string)=>({ownerId:userId,origin:'https://mine.run.comfy.app'}),workflow:async()=>({outputNode:'5'}),journal,
  submit:async()=>{submissions++;return {id:'job-1',urls:{self:'/api/v2/jobs/job-1'}};},find:async()=>null,
  save:async(_origin:string,_job:unknown,_node:string,userId:string,submissionId:string)=>saveManagedOutput({userId,submissionId,extension:'png',bytes:new Uint8Array([1,2,3]),allowance:100,existingFiles:[]},outputJournal,async(path,bytes)=>{uploads++;blobs.set(path,bytes);if(lostResponse){lostResponse=false;throw Error('lost response');}}),
 };
 await assert.rejects(ownedComfyExecution(owner,id,'sample','start',deps),/may have succeeded/);
 await assert.rejects(ownedComfyExecution(owner,id,'sample','start',deps),/recover/);
 await assert.rejects(ownedComfyExecution('22222222-2222-4222-8222-222222222222',id,'sample','recover',deps),/not found/);
 const recovered=await ownedComfyExecution(owner,id,'sample','recover',deps);
 assert.match(recovered,/^saved:/);assert.equal(submissions,1);assert.equal(uploads,1);assert.equal(blobs.size,1);
});
