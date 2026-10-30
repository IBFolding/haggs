import {test} from 'node:test';import assert from 'node:assert/strict';import {recoverGameBundle} from './game-bundle-recovery';import type {Journal,JournalEntry} from './managed-job-journal';
const user='11111111-1111-4111-8111-111111111111',ref='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',origin='https://example.run.comfy.app';
test('recover complete branches without resubmitting, across partial save and wrong owner',async()=>{
 const entry:JournalEntry={userId:user,submissionId:ref,deployment:origin,outputNode:'9000',state:'accepted',jobId:'job1',jobUrl:'/api/v2/jobs/job1'};
 const journal:Journal={read:async(u,r)=>u===user&&r===ref?entry:null,begin:async()=>{throw Error('must not submit');},accept:async()=>false};
 const index=[0,1,2].map(i=>({node:'9000',name:`branch-${i}.mp4`,mime:'video/mp4'})).concat({node:'9000',name:'branches.json',mime:'application/json'});
 const provider={findByReference:async()=>{throw Error('accepted job needs no lookup');},artifactIndex:async()=>index,artifacts:async()=>index.map(x=>({...x,bytes:new Uint8Array(Buffer.from(x.mime==='application/json'?JSON.stringify({choices:['Walk','Dodge','Attack']}):'0000ftypisom0000'))}))};
 let writes=0,failed=false;const saved=new Map<string,string>();const save=async(role:string)=>{if(!saved.has(role)){writes++;saved.set(role,`saved:${role}`);}if(role==='branch1'&&!failed){failed=true;throw Error('lost response');}return saved.get(role)!;};
 await assert.rejects(recoverGameBundle('other',ref,origin,'branches',journal,provider,save),/not found/);
 await assert.rejects(recoverGameBundle(user,ref,'https://other.run.comfy.app','branches',journal,provider,save),/not found/);
 await assert.rejects(recoverGameBundle(user,ref,origin,'branches',journal,provider,save),/lost response/);
 const result=await recoverGameBundle(user,ref,origin,'branches',journal,provider,save);assert.equal(result.branches,'saved:branches');assert.equal(writes,4);assert.ok(Object.values(result).every(x=>x.startsWith('saved:')));
});
