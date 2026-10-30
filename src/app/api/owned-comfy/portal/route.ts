import {requestToken,verifyUser} from '../../../../server/auth';
import {ownedComfyOrigin} from '../../../../server/comfy-owned-connection';
import {createOwnedInputJournal} from '../../../../server/owned-input-journal';
import {resolveOwnedPortalInputs} from '../../../../server/owned-input-upload';
import {createManagedJobJournal} from '../../../../server/managed-job-journal';
import {saveOwnedComfyOutput} from '../../../../server/owned-comfy-storage';
import {ownedPortalRequest} from '../../../../server/owned-portal-request';
import {createComfyManaged} from '../../../../providers/comfy-managed';
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
/** Experimental wiring. Production and managed paid submissions remain blocked. */
export async function POST(request:Request){
 if(process.env.NODE_ENV!=='production'&&process.env.HAGGS_PORTAL_FIXTURE==='1')return (await import('../../portal-fixture/route')).PUT(request);
 if(process.env.NODE_ENV==='production'||process.env.HAGGS_OWN_COMFY_PORTAL_PREVIEW!=='1')return reply('Owned deployment execution is unavailable.',503);
 const user=await verifyUser(request),token=requestToken(request);if(!user||!token)return reply('Sign in first.',401);
 if(Number(request.headers.get('content-length')??0)>8192)return reply('Invalid request.',400);
 let body:unknown;
 try{const reader=request.body?.getReader();if(!reader)return reply('Invalid request.',400);const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply('Invalid request.',400);}chunks.push(value);}}finally{reader.releaseLock();}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply('Invalid request.',400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply('Invalid request.',400);
 const {deployment,key,reference,action,values,name}=body as Record<string,unknown>;
 if(name!==undefined&&name!=='haggs_fx_reuse_03-portal-paint')return reply('This workflow is not available yet.',503);
 if(typeof deployment!=='string'||typeof key!=='string'||!key.trim()||key.length>1000||typeof reference!=='string'||(action!=='start'&&action!=='recover')||!values||typeof values!=='object'||Array.isArray(values))return reply('Invalid request.',400);
 try{
  const origin=ownedComfyOrigin(deployment),env=process.env,url=env.NEXT_PUBLIC_SUPABASE_URL,pub=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=env.HAGGS_WEBHOOK_SECRET;
  if(!url||!pub||!secret)return reply('Execution dependencies are unavailable.',503);
  const inputs=createOwnedInputJournal({url,key:pub,secret,userToken:token});
  const journal=createManagedJobJournal(env,token);
  const outputHosts=(env.HAGGS_MANAGED_OUTPUT_HOSTS??'').split(',').map(s=>s.trim()).filter(Boolean);
  const provider=createComfyManaged({base:origin,apiKey:key,outputHosts,keep:(bytes,extension)=>saveOwnedComfyOutput(token,reference,bytes,extension)});
  const internal=new Request('http://local.invalid',{method:'POST',body:JSON.stringify({reference,action,values,name})});
  return await ownedPortalRequest(internal,{authenticate:async()=>user.id,connection:async()=>({ownerId:user.id,origin}),journal,assets:(id,ref)=>resolveOwnedPortalInputs(id,ref,origin,inputs),submit:async(_origin,prompt,id)=>provider.submit(prompt,id),find:async(_origin,ref)=>provider.findByReference(ref),save:async(_origin,job,node)=>(await provider.result(job,node)).url});
 }catch{return reply('Execution is unavailable. If you already started a job, recover it before retrying.',503);}
}
