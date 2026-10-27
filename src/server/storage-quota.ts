import {createClient} from '@supabase/supabase-js';
import {list} from '@vercel/blob';
import {PLANS,status,type User} from './billing';
import {stripeFromEnv} from './stripe';
/** Decimal GB: the advertised 5/15/30 GB means billions of bytes. */
export const bytesForPlan=(id:string|null)=> (PLANS.find(p=>p.id===id)?.storageGB??0)*1_000_000_000;
export const storageFull='Cloud storage is full. Download and remove files from Account → Files, or choose a larger storage plan. Your existing files are unchanged.';
function db(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.HAGGS_WEBHOOK_SECRET;
 if(!url||!key||!secret)throw Error('Cloud storage accounting is not configured. No upload was started.');
 return {client:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),secret};
}
export async function storageAllowance(user:User):Promise<number>{
 const stripe=stripeFromEnv();if(!stripe)return 0;
 const plan=await status(stripe,process.env,user);
 return ['active','trialing'].includes(plan.status)?bytesForPlan(plan.plan):0;
}
/** A hold older than this belongs to an upload token (15 minutes) or a run that has long ended. */
export const STALE_HOLD_MS=60*60*1000;
export const uploadFolder=(userId:string,reservation:string)=>`haggs/u-${userId}/uploads/${reservation}/`;
export type Reconcile={pending:(before:string)=>Promise<string[]>;found:(reservation:string)=>Promise<{url:string;size:number}|null>;finish:(id:string,url:string|null,bytes?:number)=>Promise<void>};
/**
 * Settles a person's holds that were never finished: an upload whose browser closed, or whose completion
 * callback never arrived. An upload that did land in the store is counted; anything else is released.
 */
export async function reconcileHolds(io:Reconcile,now=Date.now()):Promise<void>{
 for(const id of await io.pending(new Date(now-STALE_HOLD_MS).toISOString())){
  const blob=await io.found(id);
  await io.finish(id,blob?.url??null,blob?.size);
 }
}
/** Best effort, before a new hold: reads the person's own pending holds with their token, so nothing here can touch another account. */
export async function reconcileStorage(user:User,token:string|undefined):Promise<void>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,blobToken=process.env.BLOB_READ_WRITE_TOKEN??process.env.HAGGS_SYNC_BLOB_TOKEN;
 if(!token||!url||!key||!blobToken)return;
 const mine=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 await reconcileHolds({
  pending:async before=>{const {data,error}=await mine.from('storage_reservations').select('id').eq('user_id',user.id).eq('state','pending').lt('created_at',before).limit(50);if(error)throw error;return (data??[]).map(r=>String(r.id));},
  found:async id=>{const page=await list({prefix:uploadFolder(user.id,id),limit:1,token:blobToken});const b=page.blobs[0];return b?{url:b.url,size:b.size}:null;},
  finish:(id,location,bytes)=>finishStorage(user.id,id,location,bytes),
 }).catch(()=>undefined);
}
export async function reserveStorage(user:User,bytes:number,id:string=crypto.randomUUID()):Promise<string>{
 if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error('The file size is invalid.');
 const allowance=await storageAllowance(user);
 if(!allowance)throw Error('This plan keeps media on your computer. Use the local Haggs app, or choose a plan with cloud storage.');
 const {client,secret}=db();
 // Snapshot legacy bytes for first use only; the database serializes reservations.
 const existing:{url:string;size:number}[]=[];let cursor:string|undefined;
 do {const page=await list({prefix:`haggs/u-${user.id}/`,limit:1000,...(cursor?{cursor}:{}),...(process.env.BLOB_READ_WRITE_TOKEN??process.env.HAGGS_SYNC_BLOB_TOKEN?{token:(process.env.BLOB_READ_WRITE_TOKEN??process.env.HAGGS_SYNC_BLOB_TOKEN)!}:{})});existing.push(...page.blobs.map(b=>({url:b.url,size:b.size})));cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 const {data,error}=await client.rpc('storage_reserve',{target:user.id,reservation:id,amount:bytes,allowance,existing_files:existing,secret});
 if(error)throw Error('Cloud storage accounting is unavailable. No upload was started.');
 if(data!==true)throw Error(storageFull);
 return id;
}
export async function finishStorage(userId:string,id:string,url:string|null,actualBytes?:number){
 const {client,secret}=db(); const {error}=await client.rpc('storage_finish',{target:userId,reservation:id,location:url,secret,actual_bytes:actualBytes??null});
 if(error)throw Error('The file may be saved, but storage confirmation is pending. Do not upload it again.');
}
export async function removedStorage(userId:string,url:string){const {client,secret}=db();const {error}=await client.rpc('storage_removed',{target:userId,location:url,secret});if(error)throw Error('File removed; storage accounting needs reconciliation.');}
