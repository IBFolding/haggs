import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
export type GreySpendKind='proposal'|'still'|'video';
export type GreySpendStatus={capUsd:number;chargedUsd:number;reservedUsd:number};
export function greySpendingStore(env:Record<string,string|undefined>,token?:string){
 const call=async(name:string,args:Record<string,unknown>={})=>{
  const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw Error('Spending limits are unavailable.');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:token?{Authorization:`Bearer ${token}`}:{}}});
  const {data,error}=await db.rpc(name,args);if(error)throw Error('Spending limits are unavailable.');return data;
 };
 const server=(name:string,args:Record<string,unknown>)=>{if(!env.HAGGS_WEBHOOK_SECRET)throw Error('Spending limits are unavailable.');return call(name,{...args,secret:env.HAGGS_WEBHOOK_SECRET});};
 return {status:async()=>await call('grey_spend_status') as GreySpendStatus|null,setCap:async(cap:number)=>await call('grey_spend_set_cap',{cap})===true,reserve:async(ref:string,uid:string,maximum:number)=>await server('grey_spend_reserve',{ref,uid,maximum})===true,finish:async(ref:string,actual:number|null)=>await server('grey_spend_finish',{ref,actual})===true};
}
/** Only a verified provider-enforced maximum is acceptable, never a displayed cost estimate. */
export async function withGreySpending<T>(deps:{userId:string|undefined;maximumUsd:number|undefined;reserve:(id:string,userId:string,max:number)=>Promise<boolean>;finish:(id:string,actual:number|null)=>Promise<boolean>},run:(recordActual:(usd:number)=>void)=>Promise<T>):Promise<T|{ok:false;reason:string}>{
 if(!deps.userId)return {ok:false,reason:'Sign in and set your Grey Room spending cap before generating.'};
 if(!deps.maximumUsd||!Number.isFinite(deps.maximumUsd)||deps.maximumUsd<=0)return {ok:false,reason:'This provider has no verified maximum charge for this action. Generation is blocked to protect your cap.'};
 const ref=randomUUID();try{if(!await deps.reserve(ref,deps.userId,deps.maximumUsd))return {ok:false,reason:'Set or raise your Grey Room cap. Charged and unresolved reservations count toward it.'};}catch{return {ok:false,reason:'Spending reservation could not be confirmed. Nothing was submitted.'};}
 // Only trusted server transport code can report a reconciled amount. Never infer zero from failure.
 let actual:number|null=null,reported=false;
 const recordActual=(usd:number)=>{if(reported||!Number.isFinite(usd)||usd<0){actual=null;reported=true;return;}actual=usd;reported=true;};
 try{return await run(recordActual);}finally{try{await deps.finish(ref,actual);}catch{/* The original reservation remains held. */}}
}
/** No reviewed, provider-enforced ceilings are currently available for these routes. */
export function verifiedGreyMaximum(_kind:GreySpendKind):number|undefined{return undefined;}
