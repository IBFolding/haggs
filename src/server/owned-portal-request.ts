import {ownedComfyExecution} from './owned-comfy-execution';
import {prepareOwnedPortalPaint} from './owned-comfy-reuse';
import type {Values} from '../comfy/apps';
import type {ComfyAsset} from '../providers/comfy-managed';
import type {Journal} from './managed-job-journal';
import type {ApiPrompt} from '../comfy/convert';
type Deps={authenticate(r:Request):Promise<string|null>;connection(user:string):Promise<{ownerId:string;origin:string}|null>;journal:Journal;assets(user:string,ref:string):Promise<Record<string,ComfyAsset>>;submit(origin:string,prompt:ApiPrompt,ref:string):Promise<{id?:string;urls?:{self?:string}}>;find(origin:string,ref:string):Promise<{id?:string;urls?:{self?:string}}|null>;save(origin:string,job:{id:string;urls:{self:string}},node:string,user:string,ref:string):Promise<string>};
/** Route core for testing only. Asset ownership and real provider capabilities remain unverified. */
export async function ownedPortalRequest(request:Request,deps:Deps):Promise<Response>{
 const user=await deps.authenticate(request);if(!user)return Response.json({error:'Sign in first.'},{status:401});
 let payload:unknown;try{payload=await request.json();}catch{return Response.json({error:'Invalid request.'},{status:400});}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return Response.json({error:'Invalid request.'},{status:400});
 const {reference,action,values}=payload as Record<string,unknown>;
 if(typeof reference!=='string'||(action!=='start'&&action!=='recover')||!values||typeof values!=='object'||Array.isArray(values))return Response.json({error:'Invalid request.'},{status:400});
 try{let prompt:ApiPrompt|undefined;if(action==='start')prompt=prepareOwnedPortalPaint(values as Values,await deps.assets(user,reference)).prompt;
 const url=await ownedComfyExecution(user,reference,'haggs_fx_reuse_03-portal-paint',action,{connection:deps.connection,journal:deps.journal,workflow:async()=>({outputNode:'10004'}),find:deps.find,save:deps.save,submit:async(origin,_name,ref)=>{if(!prompt)throw Error('Workflow unavailable.');return deps.submit(origin,prompt,ref);}});
 return Response.json({url},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Could not complete or recover this job. Check its status before trying again.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
