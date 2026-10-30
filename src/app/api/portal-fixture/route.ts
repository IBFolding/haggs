import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createComfyManaged} from '../../../providers/comfy-managed';
import {ownedPortalRequest} from '../../../server/owned-portal-request';
import {uploadOwnedInput,resolveOwnedPortalInputs,type Entry} from '../../../server/owned-input-upload';
import {probeOwnedInput} from '../../../server/owned-comfy-input';
import {saveManagedOutput} from '../../../server/managed-output-save';
import type {ManagedOutput} from '../../../server/managed-output-journal';
import type {Journal,JournalEntry} from '../../../server/managed-job-journal';

// Disposable test fixture, never enabled in production. Fake identity and provider.
const enabled=()=>process.env.NODE_ENV!=='production'&&process.env.HAGGS_PORTAL_FIXTURE==='1';
const owner='11111111-1111-4111-8111-111111111111',deployment='https://fixture.run.comfy.app';
const dir=join(tmpdir(),'haggs-portal-fixture-v1');
const valid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function factory(ref:string){
 await mkdir(dir,{recursive:true,mode:0o700});const db=new DatabaseSync(join(dir,'fixture.sqlite'));
 db.exec('CREATE TABLE IF NOT EXISTS input (k TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS job (k TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS output (k TEXT PRIMARY KEY, body TEXT NOT NULL)');
 const read=(table:string,key:string)=>{const row=db.prepare(`SELECT body FROM ${table} WHERE k=?`).get(key);return row?JSON.parse(String(row.body)):null;};
 const begin=(table:string,key:string,entry:object)=>db.prepare(`INSERT OR IGNORE INTO ${table}(k,body) VALUES(?,?)`).run(key,JSON.stringify(entry)).changes===1;
 const update=(table:string,key:string,entry:object)=>db.prepare(`UPDATE ${table} SET body=? WHERE k=?`).run(JSON.stringify(entry),key).changes===1;
 const inputJournal={read:async(u:string,r:string,f:string)=>{const e=read('input',`${r}/${f}`) as Entry|null;return e?.userId===u?e:null;},begin:async(e:Entry)=>begin('input',`${e.submissionId}/${e.field}`,e),accept:async(e:Entry,id:string)=>{const k=`${e.submissionId}/${e.field}`,old=read('input',k) as Entry|null;if(!old||old.userId!==e.userId||old.state!=='uploading')return false;return update('input',k,{...old,state:'ready',assetId:id});}};
 const journal:Journal={begin:async(e)=>begin('job',e.submissionId,e),read:async(u,r)=>{const e=read('job',r) as JournalEntry|null;return e?.userId===u?e:null;},accept:async(u,r,id,url)=>{const e=read('job',r) as JournalEntry|null;if(!e||e.userId!==u||e.state!=='dispatching')return false;return update('job',r,{...e,state:'accepted',jobId:id,jobUrl:url});}};
 const outputJournal={read:async(u:string,r:string)=>{const e=read('output',r) as ManagedOutput|null;return e?.userId===u?e:null;},claim:async(e:ManagedOutput)=>begin('output',e.submissionId,e)?'created' as const:'existing' as const,verifyAndCommit:async(e:ManagedOutput)=>{const b=await readFile(join(dir,`${e.submissionId}.mp4`));if(b.length!==e.bytes||createHash('sha256').update(b).digest('hex')!==e.sha256)throw Error('Output mismatch');return `/api/portal-fixture?output=${e.submissionId}`;}};
 const api=createComfyManaged({base:'http://127.0.0.1:8198',localTest:true,pollMs:500,keep:async(bytes,extension)=>saveManagedOutput({userId:owner,submissionId:ref,bytes,extension,allowance:10000000,existingFiles:[]},outputJournal,async(_path,data)=>{await writeFile(join(dir,`${ref}.mp4`),data,{flag:'wx',mode:0o600});})});
 return {db,inputJournal,journal,api};
}
export async function POST(request:Request){
 if(!enabled())return reply({error:'Unavailable'},404);
 if(Number(request.headers.get('content-length')??0)>2000000)return reply({error:'File too large'},413);
 const form=await request.formData(),ref=form.get('ref'),field=form.get('field'),file=form.get('file');
 if(!valid(ref)||typeof field!=='string'||!(file instanceof File)||file.size>500000)return reply({error:'Invalid fixture input'},400);
 const mime=field==='10002/audio'?'audio/wav':'video/mp4';const ctx=await factory(ref);
 try{await uploadOwnedInput(owner,ref,field,mime,new Uint8Array(await file.arrayBuffer()),{deployment,journal:ctx.inputJournal,upload:ctx.api.upload,probe:(f,m,b)=>probeOwnedInput(f,m,b,{localTest:true})});return reply({ok:true});}catch{return reply({error:'Fixture upload failed; check before retrying.'},400);}finally{ctx.db.close();}
}
export async function PUT(request:Request){
 if(!enabled())return reply({error:'Unavailable'},404);let body:{ref?:unknown;action?:unknown;values?:unknown};try{body=await request.json();}catch{return reply({error:'Invalid'},400);}
 if(!valid(body.ref)||(body.action!=='start'&&body.action!=='recover'))return reply({error:'Invalid'},400);const ref=body.ref,ctx=await factory(ref);
 try{return await ownedPortalRequest(new Request('http://fixture.local',{method:'POST',body:JSON.stringify({reference:ref,action:body.action,values:body.values && typeof body.values==='object' && !Array.isArray(body.values) ? body.values : {}})}),{authenticate:async()=>owner,connection:async()=>({ownerId:owner,origin:deployment}),journal:ctx.journal,assets:(u,r)=>resolveOwnedPortalInputs(u,r,deployment,ctx.inputJournal),submit:async(_origin,prompt,id)=>ctx.api.submit(prompt,id),find:async()=>null,save:async(_origin,job,node)=>(await ctx.api.result(job,node)).url});}finally{ctx.db.close();}
}
export async function GET(request:Request){
 if(!enabled())return reply({error:'Unavailable'},404);const url=new URL(request.url),output=url.searchParams.get('output');if(!valid(output))return reply({error:'Invalid'},400);
 try{const bytes=await readFile(join(dir,`${output}.mp4`));return new Response(bytes,{headers:{'Content-Type':'video/mp4','Cache-Control':'no-store'}});}catch{return reply({error:'Not found'},404);}
}
