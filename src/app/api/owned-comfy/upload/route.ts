import {requestToken,verifyUser} from '../../../../server/auth';
import {ownedComfyOrigin} from '../../../../server/comfy-owned-connection';
import {createOwnedInputJournal} from '../../../../server/owned-input-journal';
import {ownedUploadRequest} from '../../../../server/owned-upload-request';
import {probeOwnedInput} from '../../../../server/owned-comfy-input';
import {createComfyManaged} from '../../../../providers/comfy-managed';
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(process.env.NODE_ENV!=='production'&&process.env.HAGGS_PORTAL_FIXTURE==='1')return (await import('../../portal-fixture/route')).POST(request);
 if(process.env.NODE_ENV==='production'||process.env.HAGGS_OWN_COMFY_PORTAL_PREVIEW!=='1')return reply('Owned deployment uploads are unavailable.',503);
 const user=await verifyUser(request),token=requestToken(request);if(!user||!token)return reply('Sign in first.',401);
 // The key is transient, never returned or stored. This endpoint remains unavailable in production.
 const deployment=request.headers.get('x-comfy-deployment'),key=request.headers.get('x-comfy-key');
 if(!deployment||!key||key.length>1000)return reply('Deployment credentials are required.',400);
 try{
  const origin=ownedComfyOrigin(deployment),env=process.env,url=env.NEXT_PUBLIC_SUPABASE_URL,pub=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=env.HAGGS_WEBHOOK_SECRET;
  if(!url||!pub||!secret)return reply('Upload dependencies are unavailable.',503);
  const journal=createOwnedInputJournal({url,key:pub,secret,userToken:token});
  const provider=createComfyManaged({base:origin,apiKey:key,keep:async()=>{throw Error('Not available');}});
  return await ownedUploadRequest(request,origin,{authenticate:async()=>user.id,journal,probe:(field,mime,bytes)=>probeOwnedInput(field,mime,bytes,{localTest:true}),upload:provider.upload});
 }catch{return reply('Upload is unavailable. Check before retrying.',503);}
}
