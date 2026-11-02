import {createClient} from "@supabase/supabase-js";
import {get,put} from "@vercel/blob";
import {createHash} from "node:crypto";
import {cookies} from "next/headers";
import {TOKEN_COOKIE,requestToken,userNow,verifyUser} from "./auth";
import {COMFY_COOKIE,keyIn} from "./keys";
import {privateBlobToken} from "./private-media";
import {privateMediaUrl} from "./private-media-url";
import {privateMediaWrites} from "./media-storage-config";
import {reserveStorage,finishStorage,removedStorage} from "./storage-quota";
import {jobOutcome} from "../providers/job-outcome";
import {createCloudRunner} from "../providers/cloud";
import {recoveredOutputResult,credentialFingerprint,OriginalUnavailable,recoverHostedOutput,saveHostedOutput,outputPath,type HostedOutput,type HostedStore,type HostedFile,type HostedIO} from "./hosted-output-recovery";
export const hostedRecoveryEnabled=()=>process.env.HAGGS_HOSTED_OUTPUT_RECOVERY==="1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MIME:Record<string,string>={png:"image/png",jpg:"image/jpeg",webp:"image/webp",mp4:"video/mp4",webm:"video/webm",mp3:"audio/mpeg",wav:"audio/wav",flac:"audio/flac"};
export async function hostedContext(request?:Request){
 if(!hostedRecoveryEnabled())throw Error("Hosted recovery is not enabled.");
 const user=request?await verifyUser(request):await userNow();
 if(!user)throw Error("Sign in to recover your outputs.");
 const token=request?requestToken(request):(await cookies()).get(TOKEN_COOKIE)?.value;
 const endpoint=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.HAGGS_WEBHOOK_SECRET,blobToken=privateBlobToken();
 if(!endpoint||!key||!secret||!token||!blobToken)throw Error("Hosted recovery storage is not configured.");
 const db=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const store:HostedStore={
  get:async id=>{if(!UUID.test(id))return null;const {data,error}=await db.from("hosted_output_recovery").select("*").eq("id",id).eq("user_id",user.id).maybeSingle();if(error)throw Error("Recovery journal could not be read.");return data as HostedOutput|null;},
  act:async(id,action,value={})=>{if(!UUID.test(id))throw Error("Invalid recovery identifier.");const {data,error}=await db.rpc("hosted_output_act",{p_id:id,p_action:action,p_value:value,p_secret:secret});if(error)throw Error("Recovery journal update is unconfirmed. Check status before retrying.");return data;},
 };
 return {user,token,secret,blobToken,db,store};
}
async function verifyObject(token:string,path:string,bytes:number,digest:string){
 let object;try{object=await get(path,{access:"private",token,useCache:false});}catch{throw Error("Private storage could not be read. Check recovery status before retrying.");}if(!object||object.statusCode!==200)return false;
 const hash=createHash("sha256"),reader=object.stream.getReader();let count=0;
 try{for(;;){const part=await reader.read();if(part.done)break;count+=part.value.length;if(count>bytes||count>100*1024*1024)return false;hash.update(part.value);}}finally{await reader.cancel();}
 return count===bytes&&hash.digest("hex")===digest;
}
export function hostedIO(context:Awaited<ReturnType<typeof hostedContext>>,apiKey:string):HostedIO{
 const cloud=createCloudRunner({apiKey,keep:async()=>{throw Error("Recovery never submits a new generation.");}});
 return {store:context.store,owner:context.user.id,credentialHash:credentialFingerprint(apiKey,context.secret),writes:privateMediaWrites,
  inspect:async(job,node)=>{try{return await cloud.inspectOutput(job,node);}catch(error){if((error as {status?:number}).status===404)throw new OriginalUnavailable("Provider original unavailable.");throw error;}},
  read:async(job,file)=>{try{return await cloud.fetchJobOutput({job,...file});}catch(error){if((error as {status?:number}).status===404)throw new OriginalUnavailable("Provider original unavailable.");throw error;}},
  reserve:async bytes=>{const hold=jobOutcome.getStore()?.storage;if(hold&&hold.userId===context.user.id&&!hold.saved&&bytes<=hold.maxBytes){hold.saved=true;return hold.id;}try{return await reserveStorage(context.user,bytes);}catch{throw Error("Storage quota could not be reserved. No recovery output was uploaded.");}},
  release:id=>finishStorage(context.user.id,id,null),
  verify:(path,bytes,digest)=>verifyObject(context.blobToken,path,bytes,digest),
  put:async(path,bytes,ext)=>{try{await put(path,Buffer.from(bytes),{access:"private",token:context.blobToken,addRandomSuffix:false,allowOverwrite:false,contentType:MIME[ext]!});}catch{throw Error("Private save outcome is unconfirmed. Check recovery status before retrying; do not generate again.");}},
  finish:(reservation,url,bytes)=>finishStorage(context.user.id,reservation,url,bytes),
 };
}
/** Called only for media dispatch, before any paid provider request. */
export async function beginHostedOutput(apiKey:string,outputNode:string){
 if(!hostedRecoveryEnabled())return null;
 if(!privateMediaWrites())throw Error("Private output writes are paused. No generation was started.");
 const context=await hostedContext(),io=hostedIO(context,apiKey),id=crypto.randomUUID();
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(outputNode))throw Error("Invalid output node.");
 await context.store.act(id,"begin",{scope:apiKey===process.env.COMFY_PLATFORM_KEY?.trim()?"platform":"own",credential_hash:io.credentialHash,output_node:outputNode});
 return {id,accepted:async(job:string)=>{await context.store.act(id,"accepted",{job});},ready:async(file:HostedFile)=>{await context.store.act(id,"ready",file);},save:(bytes:Uint8Array)=>saveHostedOutput(io,id,bytes)};
}
export async function recoverHostedForRequest(request:Request,id:string){
 const context=await hostedContext(request),record=await context.store.get(id);if(!record)throw Error("Recovery record not found.");
 const key=record.scope==="platform"?process.env.COMFY_PLATFORM_KEY?.trim():keyIn(await cookies(),COMFY_COOKIE);
 if(!key)throw Error("The matching provider connection is not available.");
 const url=await recoverHostedOutput(hostedIO(context,key),id);
 return recoveredOutputResult(await context.store.get(id),url);
}
export async function cancelDeletedHostedOutput(url:string){
 if(!hostedRecoveryEnabled())return;
 const match=/^\/api\/media\/haggs\/u-([0-9a-f-]{36})\/recovered\/([0-9a-f-]{36})\.[a-z0-9]+$/.exec(url);if(!match)return;
 const context=await hostedContext();if(context.user.id!==match[1])throw Error("Recovery record not found.");await context.store.act(match[2]!,"cancel");
}

/** Explicit reconciliation after a confirmed deletion; never clears an in-flight saving claim. */
export async function confirmDeletedHostedForRequest(request:Request,id:string){
 const context=await hostedContext(request),record=await context.store.get(id);
 if(!record||record.user_id!==context.user.id||record.state!=="saved")throw Error("Only a previously confirmed saved output can be reconciled as deleted.");
 const path=outputPath(record);let object;try{object=await get(path,{access:"private",token:context.blobToken,useCache:false});}catch{throw Error("Storage absence could not be confirmed. Quota was not released.");}
 if(object){if(object.statusCode===200)await object.stream.cancel();throw Error("The private object still exists. Delete it from Account Files first.");}
 await context.store.act(id,"cancel");await removedStorage(context.user.id,privateMediaUrl(path));
}
