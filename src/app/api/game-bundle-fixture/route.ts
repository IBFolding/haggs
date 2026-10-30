import {DatabaseSync} from 'node:sqlite';import {createHash} from 'node:crypto';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createComfyManaged} from '../../../providers/comfy-managed';import {submitJournaled,type Journal,type JournalEntry} from '../../../server/managed-job-journal';import {saveManagedArtifact,type Artifact,type ArtifactJournal,type ArtifactRole} from '../../../server/managed-artifact-save';import {ownedGameBundleExecution} from '../../../server/owned-game-bundle-execution';import {bindActionJournal,type ActionJournalStore,type ActionMode} from '../../../server/owned-game-action-journal';import type {Journal as InputJournal} from '../../../server/owned-input-upload';
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
 const jobs:ActionJournalStore={begin:async(e,mode)=>begin('jobs',e.submissionId,{entry:e,mode}),read:async(u,r)=>{const x=read('jobs',r) as {entry:JournalEntry;mode:ActionMode}|null;return x?.entry.userId===u?x:null;},accept:async(u,r,mode,id,url)=>{const x=read('jobs',r) as {entry:JournalEntry;mode:ActionMode}|null;if(!x||x.mode!==mode||x.entry.userId!==u||x.entry.state!=='dispatching')return false;return update('jobs',r,{...x,entry:{...x.entry,state:'accepted',jobId:id,jobUrl:url}});}};const inputs:InputJournal={read:async(u,r,field)=>u===owner&&r===ref?{userId:u,submissionId:r,deployment,field,mime:'video/mp4',size:1,sha256:'a'.repeat(64),state:'ready',assetId:'synthetic-video',expiresAt:Date.now()+60000}:null,begin:async()=>false,accept:async()=>false};
 const artifactJournal:ArtifactJournal={read:async(u,r,role)=>{const e=read('artifacts',`${r}/${role}`) as Artifact|null;return e?.userId===u?e:null;},claim:async e=>begin('artifacts',`${e.submissionId}/${e.role}`,e)?'created':'existing',verifyAndCommit:async e=>{const bytes=await readFile(join(dir,`${e.submissionId}-${e.role}.${e.extension}`));if(bytes.length!==e.bytes||createHash('sha256').update(bytes).digest('hex')!==e.sha256)throw Error('Output verification failed.');return `/api/game-bundle-fixture?ref=${e.submissionId}&role=${e.role}`;}};
 const provider=createComfyManaged({base:'http://127.0.0.1:8199',localTest:true,keep:async()=>{throw Error('Use bundle storage.');}});
 const save=async(role:ArtifactRole,bytes:Uint8Array)=>{const result=await saveManagedArtifact({userId:owner,submissionId:ref,role,bytes,allowance:100_000_000,existing:[]},artifactJournal,async(item,data)=>{await writeFile(join(dir,`${item.submissionId}-${item.role}.${item.extension}`),data,{flag:'wx',mode:0o600});});if(process.env.HAGGS_GAME_FIXTURE_FAIL_ONCE==='1'&&role==='branch1'){let first=false;try{await writeFile(join(dir,`${ref}-simulated-failure`),'test',{flag:'wx',mode:0o600});first=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}if(first)throw Error('Simulated lost response after saving.');}return result;};
 return {db,jobs,inputs,provider,save};
}
export async function POST(request:Request){
 if(!enabled())return json({error:'Unavailable'},404);let body:{ref?:unknown;action?:unknown;kind?:unknown};try{body=await request.json();}catch{return json({error:'Invalid'},400);}
 if(!valid(body.ref)||!['start','status','recover'].includes(String(body.action))||!['moveset','telegraph','reskin','branches'].includes(String(body.kind)))return json({error:'Invalid'},400);
 const ref=body.ref,kind=body.kind as 'moveset'|'telegraph'|'reskin'|'branches',ctx=await factory(ref);
 try{
  const connection=async(u:string)=>({ownerId:u,origin:deployment});const base={width:512,height:320,frames:124};const input=kind==='moveset'?{mode:'moveset' as const,...base,scene:'Synthetic guide',timeline:{actors:[{}]},tileSize:128,columns:8}:kind==='telegraph'?{mode:'telegraph' as const,...base,style:'Synthetic guide',timeline:{telegraphs:[{shape:'circle',start:0,impact:1,end:2}]},tileSize:128,columns:8}:kind==='reskin'?{mode:'reskin' as const,...base,style:'Synthetic guide',threshold:.12}:{mode:'branches' as const,labels:['Walk','Dodge','Attack']};
  const deps={connection,jobs:ctx.jobs,inputs:ctx.inputs,submit:async(_origin:string,prompt:Parameters<typeof ctx.provider.submit>[0],id:string)=>ctx.provider.submit(prompt,id),provider:ctx.provider,save:ctx.save};
  if(body.action==='start'){await ownedGameBundleExecution(owner,ref,kind,'start',input,deps);return json({status:'submitted'});}
  const journal=bindActionJournal(ctx.jobs,kind),entry=await journal.read(owner,ref);if(!entry||entry.deployment!==deployment||!entry.jobId||!entry.jobUrl)return json({error:'Fixture job not found'},404);
  const job={id:entry.jobId,urls:{self:entry.jobUrl},outputNode:entry.outputNode};
  if(body.action==='status')return json(await ctx.provider.status(job,job.outputNode));
  const result=await ownedGameBundleExecution(owner,ref,kind,'recover',null,deps);return json(result);
 }catch{return json({error:'Fixture could not complete. Recover before retrying.'},503);}finally{ctx.db.close();}
}
export async function GET(request:Request){
 if(!enabled())return json({error:'Unavailable'},404);const url=new URL(request.url),ref=url.searchParams.get('ref'),role=url.searchParams.get('role');if(!valid(ref)||!role||!roles.includes(role as ArtifactRole))return json({error:'Invalid'},400);
 const ctx=await factory(ref);try{const record=await ctx.jobs.read(owner,ref);if(!record)return json({error:'Not found'},404);}finally{ctx.db.close();}const ext=role==='atlas'?'png':role==='manifest'||role==='branches'?'json':'mp4';try{return new Response(await readFile(join(dir,`${ref}-${role}.${ext}`)),{headers:{'Content-Type':ext==='png'?'image/png':ext==='json'?'application/json':'video/mp4','Cache-Control':'no-store'}});}catch{return json({error:'Not found'},404);}
}
