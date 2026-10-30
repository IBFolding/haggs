import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createComfyManaged} from '../../../providers/comfy-managed';import {submitJournaled,type Journal,type JournalEntry} from '../../../server/managed-job-journal';import {saveManagedArtifact,type Artifact,type ArtifactJournal,type ArtifactRole} from '../../../server/managed-artifact-save';import {recoverGameBundle} from '../../../server/game-bundle-recovery';
const enabled=()=>process.env.NODE_ENV!=='production'&&process.env.HAGGS_GAME_FIXTURE==='1';
const owner='11111111-1111-4111-8111-111111111111',deployment='https://fixture.run.comfy.app',dir=join(tmpdir(),'haggs-game-bundle-fixture');
const valid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const roles=['video','atlas','manifest','branch0','branch1','branch2','branches'] as const;
const json=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function factory(ref:string){
 await mkdir(dir,{recursive:true,mode:0o700});const db=new DatabaseSync(join(dir,'journal.sqlite'));db.exec('CREATE TABLE IF NOT EXISTS jobs(k TEXT PRIMARY KEY,body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS artifacts(k TEXT PRIMARY KEY,body TEXT NOT NULL)');
 const read=(table:string,key:string)=>{const r=db.prepare(`SELECT body FROM ${table} WHERE k=?`).get(key);return r?JSON.parse(String(r.body)):null;};
 const begin=(table:string,key:string,value:object)=>db.prepare(`INSERT OR IGNORE INTO ${table}(k,body) VALUES(?,?)`).run(key,JSON.stringify(value)).changes===1;
 const update=(table:string,key:string,value:object)=>db.prepare(`UPDATE ${table} SET body=? WHERE k=?`).run(JSON.stringify(value),key).changes===1;
 const journal:Journal={begin:async e=>begin('jobs',e.submissionId,e),read:async(u,r)=>{const e=read('jobs',r) as JournalEntry|null;return e?.userId===u?e:null;},accept:async(u,r,id,url)=>{const e=read('jobs',r) as JournalEntry|null;if(!e||e.userId!==u||e.state!=='dispatching')return false;return update('jobs',r,{...e,state:'accepted',jobId:id,jobUrl:url});}};
 const artifactJournal:ArtifactJournal={read:async(u,r,role)=>{const e=read('artifacts',`${r}/${role}`) as Artifact|null;return e?.userId===u?e:null;},claim:async e=>begin('artifacts',`${e.submissionId}/${e.role}`,e)?'created':'existing',verifyAndCommit:async e=>{const bytes=await readFile(join(dir,`${e.submissionId}-${e.role}.${e.extension}`));if(bytes.length!==e.bytes||createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error('Output verification failed.');return `/api/game-bundle-fixture?ref=${e.submissionId}&role=${e.role}`;}};
 const provider=createComfyManaged({base:'http://127.0.0.1:8199',localTest:true,keep:async()=>{throw Error('Use bundle storage.');}});
 const save=async(role:ArtifactRole,bytes:Uint8Array)=>{const result=await saveManagedArtifact({userId:owner,submissionId:ref,role,bytes,allowance:100_000_000,existing:[]},artifactJournal,async(item,data)=>{await writeFile(join(dir,`${item.submissionId}-${item.role}.${item.extension}`),data,{flag:'wx',mode:0o600});});if(process.env.HAGGS_GAME_FIXTURE_FAIL_ONCE==='1'&&role==='branch1'){let first=false;try{await writeFile(join(dir,`${ref}-simulated-failure`),'test',{flag:'wx',mode:0o600});first=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}if(first)throw Error('Simulated lost response after saving.');}return result;};
 return {db,journal,provider,save};
}
export async function POST(request:Request){
 if(!enabled())return json({error:'Unavailable'},404);let body:{ref?:unknown;action?:unknown;kind?:unknown};try{body=await request.json();}catch{return json({error:'Invalid'},400);}
 if(!valid(body.ref)||!['start','status','recover'].includes(String(body.action))||!['atlas','branches'].includes(String(body.kind)))return json({error:'Invalid'},400);
 const ref=body.ref,kind=body.kind as 'atlas'|'branches',ctx=await factory(ref);
 try{
  if(body.action==='start'){
   const outputNode=kind==='atlas'?'950':'9000';
   const job=await submitJournaled({userId:owner,submissionId:ref,deployment,outputNode,state:'dispatching'},ctx.journal,id=>ctx.provider.submit({fixture:{class_type:'Fixture',inputs:{kind}}},id));
   return json({status:'submitted',jobId:job.id});
  }
  const entry=await ctx.journal.read(owner,ref);if(!entry||entry.deployment!==deployment||entry.outputNode!==(kind==='atlas'?'950':'9000')||!entry.jobId||!entry.jobUrl)return json({error:'Fixture job not found'},404);
  const job={id:entry.jobId,urls:{self:entry.jobUrl},outputNode:entry.outputNode};
  if(body.action==='status')return json(await ctx.provider.status(job,job.outputNode));
  const result=await recoverGameBundle(owner,ref,deployment,kind,ctx.journal,ctx.provider,ctx.save);return json({status:'saved',outputs:result});
 }catch{return json({error:'Fixture could not complete. Recover before retrying.'},503);}finally{ctx.db.close();}
}
export async function GET(request:Request){
 if(!enabled())return json({error:'Unavailable'},404);const url=new URL(request.url),ref=url.searchParams.get('ref'),role=url.searchParams.get('role');if(!valid(ref)||!role||!roles.includes(role as ArtifactRole))return json({error:'Invalid'},400);
 const ext=role==='atlas'?'png':role==='manifest'||role==='branches'?'json':'mp4';try{return new Response(await readFile(join(dir,`${ref}-${role}.${ext}`)),{headers:{'Content-Type':ext==='png'?'image/png':ext==='json'?'application/json':'video/mp4','Cache-Control':'no-store'}});}catch{return json({error:'Not found'},404);}
}
