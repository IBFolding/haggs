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
export async function reserveStorage(user:User,bytes:number):Promise<string>{
 if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error('The file size is invalid.');
 const allowance=await storageAllowance(user);
 if(!allowance)throw Error('This plan keeps media on your computer. Use the local Haggs app, or choose a plan with cloud storage.');
 const {client,secret}=db();
 // Snapshot legacy bytes for first use only; the database serializes reservations.
 const existing:{url:string;size:number}[]=[];let cursor:string|undefined;
 do {const page=await list({prefix:`haggs/u-${user.id}/`,limit:1000,...(cursor?{cursor}:{}),...(process.env.BLOB_READ_WRITE_TOKEN??process.env.HAGGS_SYNC_BLOB_TOKEN?{token:(process.env.BLOB_READ_WRITE_TOKEN??process.env.HAGGS_SYNC_BLOB_TOKEN)!}:{})});existing.push(...page.blobs.map(b=>({url:b.url,size:b.size})));cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 const id=crypto.randomUUID();
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
