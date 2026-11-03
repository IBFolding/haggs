import {createHash,randomUUID} from 'node:crypto';
import type {GreyQuoteStore} from './grey-quote-store';
export type GreyMediaKind='still'|'video'|'matte'|'relight'|'real';
export type GreyMediaConsent={quoteId:string;consent:true;approvedFirstFrame?:boolean};
export type GreyMediaQuote={ok:true;id:string;estimateUsd:number;expiresAt:number}|{ok:false;reason:string};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const failure=(reason:string)=>({ok:false as const,reason});
/** Media quotes share the durable ledger, with a distinct domain to prevent proposal/media replay. */
export function createGreyMediaConsent(deps:{store:GreyQuoteStore;policy:(kind:GreyMediaKind,input?:unknown)=>{enabled:boolean;estimateUsd:number};identity:()=>Promise<unknown>;now?:()=>number}){
 const now=deps.now??Date.now;
 async function binding(kind:GreyMediaKind,input:unknown){
  if(kind!=='still'&&kind!=='video'&&kind!=='matte'&&kind!=='relight'&&kind!=='real')throw Error('Invalid media kind');
  const policy=deps.policy(kind,input);
  if(!policy.enabled||!Number.isFinite(policy.estimateUsd)||policy.estimateUsd<=0)throw Error('Media generation is not enabled.');
  const text=JSON.stringify(input);
  if(!text||text.length>8_000_000||!input||typeof input!=='object')throw Error('Invalid media request.');
  const identity=await deps.identity();if(!identity)throw Error('Sign in or add your existing provider connection first.');
  return {contextHash:hash({domain:'grey-media-v1',kind,input}),credentialHash:hash(identity),policyHash:hash({domain:'grey-media-v1',kind,policy}),estimateUsd:policy.estimateUsd};
 }
 return {
  async quote(kind:GreyMediaKind,input:unknown):Promise<GreyMediaQuote>{
   try{const b=await binding(kind,input),id=randomUUID(),expiresAt=now()+300000;
    if(!await deps.store.put(id,{...b,expiresAt}))return failure('Too many pending quotes. Try again later.');
    return {ok:true,id,estimateUsd:b.estimateUsd,expiresAt};
   }catch{return failure('Media quote unavailable. Check rollout and provider settings; nothing was submitted.');}
  },
  async consume(kind:GreyMediaKind,input:unknown,approval?:GreyMediaConsent):Promise<{ok:true}|{ok:false;reason:string}>{
   if(approval?.consent!==true||typeof approval.quoteId!=='string'||(kind==='video'&&approval.approvedFirstFrame!==true))return failure('Approve the displayed estimate and, for video, the selected first frame.');
   try{const b=await binding(kind,input),q=await deps.store.get(approval.quoteId);
    if(!q||q.expiresAt<=now()||q.contextHash!==b.contextHash||q.credentialHash!==b.credentialHash||q.policyHash!==b.policyHash||q.estimateUsd!==b.estimateUsd)return failure('Quote expired or request, price, or provider settings changed. Get a fresh quote.');
    if(!await deps.store.claim(approval.quoteId,q))return failure('This quote was already used or expired. Nothing was retried.');
    return {ok:true};
   }catch{return failure('Quote claim could not be confirmed. Nothing was submitted by this request; check Activity before trying again.');}
  }
 };
}
