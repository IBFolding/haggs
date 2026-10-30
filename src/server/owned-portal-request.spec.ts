import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownedPortalRequest} from './owned-portal-request';
import type {Journal,JournalEntry} from './managed-job-journal';
test('portal route isolates owners and avoids duplicate submissions',async()=>{
 const rows=new Map<string,JournalEntry>();let sent=0;
 const journal:Journal={begin:async e=>{if(rows.has(e.submissionId))return false;rows.set(e.submissionId,e);return true;},accept:async(u,r,id,url)=>{const e=rows.get(r);if(!e||e.userId!==u||e.state!=='dispatching')return false;rows.set(r,{...e,state:'accepted',jobId:id,jobUrl:url});return true;},read:async(u,r)=>{const e=rows.get(r);return e?.userId===u?e:null;}};
 const asset=(id:string)=>({__type:'core/ASSET' as const,info:{id}});
 const deps={authenticate:async(r:Request)=>r.headers.get('x-user'),connection:async(user:string)=>({ownerId:user,origin:'https://mine.run.comfy.app'}),journal,assets:async()=>({'1/file':asset('layer'),'10001/file':asset('source'),'10002/audio':asset('audio')}),submit:async()=>{sent++;return {id:'job-1',urls:{self:'/api/v2/jobs/job-1'}};},find:async()=>null,save:async()=> 'saved'};
 const req=(user:string|null,action:string)=>new Request('https://example.test',{method:'POST',headers:user?{'x-user':user}:{},body:JSON.stringify({reference:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',action,values:{'10000/amount':0.5}})});
 assert.equal((await ownedPortalRequest(req(null,'start'),deps)).status,401);assert.equal((await ownedPortalRequest(req('alice','start'),deps)).status,200);assert.equal((await ownedPortalRequest(req('alice','start'),deps)).status,503);assert.equal((await ownedPortalRequest(req('bob','recover'),deps)).status,503);assert.equal((await ownedPortalRequest(req('alice','recover'),deps)).status,200);assert.equal(sent,1);
});
