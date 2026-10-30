import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createComfyManaged} from '../providers/comfy-managed';
import {ownedPortalRequest} from './owned-portal-request';
import {saveManagedOutput} from './managed-output-save';
import {uploadOwnedInput,resolveOwnedPortalInputs,type Entry} from './owned-input-upload';
import type {Journal,JournalEntry} from './managed-job-journal';
import type {ManagedOutput} from './managed-output-journal';
test('portal test route polls a local HTTP provider and recovers a stored output',async()=>{
 let submits=0,uploads=0,polls=0,stored=0,loseResponse=true;const blobs=new Map<string,Uint8Array>();
 const server=createServer((req,res)=>{
  if(req.method==='POST'&&req.url==='/api/v2/jobs'){submits++;res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({id:'job1',urls:{self:'/api/v2/jobs/job1'}}));return;}
  if(req.method==='GET'&&req.url==='/api/v2/jobs/job1'){polls++;res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'job1',status:polls===1?'running':'succeeded',outputs:[{node_id:'10004',content_type:'video/mp4',url:'/api/v2/assets/out/content'}]}));return;}
  if(req.method==='GET'&&req.url==='/api/v2/assets/out/content'){res.writeHead(200,{'content-type':'video/mp4'});res.end(Buffer.from([1,2,3]));return;}
  if(req.method==='POST'&&req.url==='/api/v2/assets'){uploads++;res.setHeader('content-type','application/json');res.end(JSON.stringify({id:`asset${uploads}`}));return;}
  res.writeHead(404);res.end();
 });server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const address=server.address();if(!address||typeof address==='string')throw Error('No test port');
  const jobs=new Map<string,JournalEntry>(),outputs=new Map<string,ManagedOutput>(), inputs=new Map<string,Entry>();
  const journal:Journal={begin:async e=>{if(jobs.has(e.submissionId))return false;jobs.set(e.submissionId,e);return true;},accept:async(u,r,id,url)=>{const e=jobs.get(r);if(!e||e.userId!==u||e.state!=='dispatching')return false;jobs.set(r,{...e,state:'accepted',jobId:id,jobUrl:url});return true;},read:async(u,r)=>{const e=jobs.get(r);return e?.userId===u?e:null;}};
  const outputJournal={read:async(u:string,r:string)=>{const e=outputs.get(r);return e?.userId===u?e:null;},claim:async(e:ManagedOutput)=>{if(outputs.has(e.submissionId))return 'existing' as const;outputs.set(e.submissionId,e);return 'created' as const;},verifyAndCommit:async(e:ManagedOutput)=>{assert.deepEqual(blobs.get(e.pathname),new Uint8Array([1,2,3]));return `saved:${e.pathname}`;}};
  const user='11111111-1111-4111-8111-111111111111',ref='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const api=createComfyManaged({base:`http://127.0.0.1:${address.port}`,localTest:true,pollMs:1,keep:async(bytes,extension)=>saveManagedOutput({userId:user,submissionId:ref,bytes,extension,allowance:100,existingFiles:[]},outputJournal,async(path,data)=>{stored++;blobs.set(path,data);if(loseResponse){loseResponse=false;throw Error('lost response');}})});
  const inputJournal={read:async(u:string,r:string,f:string)=>{const e=inputs.get(`${r}/${f}`);return e?.userId===u?e:null;},begin:async(e:Entry)=>{const k=`${e.submissionId}/${e.field}`;if(inputs.has(k))return false;inputs.set(k,e);return true;},accept:async(e:Entry,id:string)=>{inputs.set(`${e.submissionId}/${e.field}`,{...e,state:'ready',assetId:id});return true;}};
  const input=async(field:string,mime:string,data:Uint8Array)=>uploadOwnedInput(user,ref,field,mime,data,{journal:inputJournal,probe:async()=>({sha256:Buffer.from(data).toString('hex').padEnd(64,'0'),bytes:data.length}),upload:(bytes,type)=>api.upload(bytes,type)});
  const deps={authenticate:async(r:Request)=>r.headers.get('x-user'),connection:async(id:string)=>({ownerId:id,origin:'https://example.run.comfy.app'}),journal,
   assets:async(owner:string,id:string)=>{if(owner!==user||id!==ref)throw Error('Not found');await input('1/file','video/mp4',new Uint8Array([1]));await input('10001/file','video/mp4',new Uint8Array([2]));await input('10002/audio','audio/wav',new Uint8Array([3]));return resolveOwnedPortalInputs(owner,id,inputJournal);},
   submit:async(_origin:string,prompt:Parameters<typeof api.submit>[0],id:string)=>api.submit(prompt,id),find:async()=>null,
   save:async(_origin:string,job:Parameters<typeof api.result>[0],node:string)=> (await api.result(job,node)).url};
  const req=(id:string,action:string)=>new Request('http://local.test',{method:'POST',headers:{'x-user':id},body:JSON.stringify({reference:ref,action,values:{'10000/amount':0.5}})});
  assert.equal((await ownedPortalRequest(req(user,'start'),deps)).status,503);
  assert.equal((await ownedPortalRequest(req(user,'start'),deps)).status,503);
  assert.equal((await ownedPortalRequest(req('22222222-2222-4222-8222-222222222222','recover'),deps)).status,503);
  const recovered=await ownedPortalRequest(req(user,'recover'),deps);assert.equal(recovered.status,200);assert.match((await recovered.json()).url,/^saved:/);
  assert.equal(submits,1);assert.equal(uploads,3);assert.equal(stored,1);assert.ok(polls>=2);
 }finally{server.close();await once(server,'close');}
});
