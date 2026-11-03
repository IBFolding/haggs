import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {greyPlanningMaximum} from './grey-planning-limit';
export type GreySpendKind='proposal'|'still'|'video'|'matte'|'relight'|'real';
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
export async function withGreySpending<T>(deps:{userId:string|undefined;maximumUsd:number|undefined;reserve:(id:string,userId:string,max:number)=>Promise<boolean>;finish:(id:string,actual:number|null)=>Promise<boolean>},run:(recordActual:(usd:number)=>void)=>Promise<T>):Promise<T|{ok:false;reason:string;budgetBlocked:true}>{
 if(!deps.userId)return {ok:false,budgetBlocked:true,reason:'Sign in and set your Grey Room spending cap before generating.'};
 if(!deps.maximumUsd||!Number.isFinite(deps.maximumUsd)||deps.maximumUsd<=0)return {ok:false,budgetBlocked:true,reason:'This provider has no verified maximum charge for this action. Generation is blocked to protect your cap.'};
 const ref=randomUUID();try{if(!await deps.reserve(ref,deps.userId,deps.maximumUsd))return {ok:false,budgetBlocked:true,reason:'Set or raise your Grey Room cap. Charged and unresolved reservations count toward it.'};}catch{return {ok:false,budgetBlocked:true,reason:'Spending reservation could not be confirmed. Nothing was submitted.'};}
 // Only trusted server transport code can report a reconciled amount. Never infer zero from failure.
 let actual:number|null=null,reported=false;
 const recordActual=(usd:number)=>{if(reported||!Number.isFinite(usd)||usd<0){actual=null;reported=true;return;}actual=usd;reported=true;};
 try{return await run(recordActual);}finally{try{await deps.finish(ref,actual);}catch{/* The original reservation remains held. */}}
}
/** Planning uses the full documented model context, never a token-count estimate. */
/** Media runs reserve exactly the estimate the person approved (the server re-checks it against the quote it issued). Without an approved estimate there is no maximum, so nothing runs. */
export function verifiedGreyMaximum(kind:GreySpendKind,env:Record<string,string|undefined>=process.env,approvedUsd?:number):number|undefined{if(kind==='proposal')return greyPlanningMaximum(env);return typeof approvedUsd==='number'&&Number.isFinite(approvedUsd)&&approvedUsd>0?approvedUsd:undefined;}
