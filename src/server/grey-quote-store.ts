import { createClient } from "@supabase/supabase-js";
export type GreyQuoteRecord={contextHash:string;credentialHash:string;policyHash:string;expiresAt:number;estimateUsd:number};
export type GreyQuoteStore={put:(id:string,quote:GreyQuoteRecord)=>Promise<boolean>;get:(id:string)=>Promise<GreyQuoteRecord|null>;claim:(id:string,quote:GreyQuoteRecord)=>Promise<boolean>};
/** Explicit local/test store only. Production wiring never falls back to this store. */
export function memoryGreyQuoteStore(now=Date.now):GreyQuoteStore {
 const entries=new Map<string,GreyQuoteRecord>();
 return {
  async put(id,q){for(const [key,v]of entries)if(v.expiresAt<=now())entries.delete(key);if(entries.size>=200||entries.has(id))return false;entries.set(id,q);return true;},
  async get(id){const q=entries.get(id);return q&&q.expiresAt>now()?q:null;},
  async claim(id,q){const stored=entries.get(id);if(!stored||stored.expiresAt<=now()||JSON.stringify(stored)!==JSON.stringify(q))return false;entries.delete(id);return true;},
 };
}
type Rpc={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type Factory=(url:string,key:string)=>Rpc;
/** Lazy use of existing Supabase configuration and server secret. No scene text or credential values are stored. */
export function sharedGreyQuoteStore(env:Record<string,string|undefined>,factory:Factory=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})):GreyQuoteStore {
 const call=async(name:string,args:Record<string,unknown>)=>{
  const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=env.HAGGS_WEBHOOK_SECRET;
  if(!url||!key||!secret)throw Error("Shared proposal storage is not configured.");
  const {data,error}=await factory(url,key).rpc(name,{...args,secret});
  if(error)throw Error("Shared proposal storage is unavailable.");return data;
 };
 const args=(id:string,q:GreyQuoteRecord)=>({quote_id:id,context_hash:q.contextHash,credential_hash:q.credentialHash,policy_hash:q.policyHash,expires_ms:q.expiresAt,estimate_usd:q.estimateUsd});
 return {
  async put(id,q){return await call("grey_quote_create",args(id,q))===true;},
  async get(id){const raw=await call("grey_quote_read",{quote_id:id});if(!raw)return null;
   const q=raw as GreyQuoteRecord;
   if(![q.contextHash,q.credentialHash,q.policyHash].every(s=>typeof s==="string"&&/^[0-9a-f]{64}$/.test(s))||!Number.isFinite(q.expiresAt)||!Number.isFinite(q.estimateUsd))throw Error("Invalid shared quote record.");return q;
  },
  async claim(id,q){return await call("grey_quote_claim",args(id,q))===true;},
 };
}
