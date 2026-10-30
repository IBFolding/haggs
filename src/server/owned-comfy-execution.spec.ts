import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownedComfyExecution} from './owned-comfy-execution';
import type {Journal,JournalEntry} from './managed-job-journal';
test('authenticated fake execution saves once, recovers, and rejects another user',async()=>{
 const rows=new Map<string,JournalEntry>();let sent=0,saves=0;
 const journal:Journal={begin:async(e)=>{if(rows.has(e.submissionId))return false;rows.set(e.submissionId,e);return true;},accept:async(u,r,id,url)=>{const e=rows.get(r);if(!e||e.userId!==u||e.state!=='dispatching')return false;rows.set(r,{...e,state:'accepted',jobId:id,jobUrl:url});return true;},read:async(u,r)=>{const e=rows.get(r);return e?.userId===u?e:null;}};
 const deps={connection:async(userId:string)=>({ownerId:userId,origin:'https://mine.run.comfy.app'}),workflow:async(name:string)=>name==='sample'?{outputNode:'5'}:null,journal,submit:async()=>{sent++;return {id:'job-1',urls:{self:'/api/v2/jobs/job-1'}};},find:async()=>null,save:async(_origin:string,_job:unknown,_node:string,user:string)=>{saves++;return `saved:${user}`;}};
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await assert.rejects(ownedComfyExecution(null,id,'sample','start',deps),/Sign in/);
 assert.equal(await ownedComfyExecution('alice',id,'sample','start',deps),'saved:alice');
 await assert.rejects(ownedComfyExecution('alice',id,'sample','start',deps),/recover/);
 await assert.rejects(ownedComfyExecution('bob',id,'sample','recover',deps),/not found/);
 assert.equal(await ownedComfyExecution('alice',id,'sample','recover',deps),'saved:alice');
 assert.equal(sent,1);assert.equal(saves,2);
});
