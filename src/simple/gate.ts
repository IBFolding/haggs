import {VOICES} from "../providers/cloud-edits";
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {GreyQuoteStore} from '../server/grey-quote-store';
import type {StepRequest} from './plan';
export const requestSchema=z.object({id:z.string().min(1).max(100),kind:z.enum(['image','video','voice','effect','music']),prompt:z.string().trim().min(1).max(4000),seconds:z.number().min(0).max(180),ratio:z.enum(['16:9','9:16']),images:z.array(z.string().max(2000000)).max(9),voice:z.enum(VOICES).optional(),firstFrame:z.boolean().optional()}).strict().superRefine((s,c)=>{if(s.kind==='video'&&(!Number.isInteger(s.seconds)||s.seconds<4||s.seconds>15))c.addIssue({code:'custom',message:'Video takes need 4–15 seconds.'});if(s.kind==='image'&&s.images.length>9)c.addIssue({code:'custom',message:'Image models accept nine references.'});if((s.kind==='voice'&&(s.prompt.length<5||s.prompt.length>2000))||(['music','effect'].includes(s.kind)&&(s.prompt.length<4||s.prompt.length>500)))c.addIssue({code:'custom',message:'The audio prompt is outside its supported length.'});if(s.kind==='voice'&&!s.voice)c.addIssue({code:'custom',message:'Choose a supported voice.'});if((s.kind==='effect'&&(s.seconds<.5||s.seconds>15))||(s.kind==='music'&&(s.seconds<5||s.seconds>180)))c.addIssue({code:'custom',message:'Unsupported audio duration.'});if(!['image','video'].includes(s.kind)&&s.images.length)c.addIssue({code:'custom',message:'Audio does not accept image references.'});});
export type Result={ok:true;url:string;kind:'image'|'video'|'audio';usd:number|null;storageWarning?:string}|{ok:false;reason:string};
export type Quote={ok:true;id:string;usd:number;expiresAt:number}|{ok:false;reason:string};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function createSimpleGate(deps:{store:GreyQuoteStore;identity:()=>Promise<unknown>;estimate:(r:StepRequest)=>Promise<number|null>;generate:(r:StepRequest)=>Promise<Result>;now?:()=>number}){
 const now=deps.now??Date.now;
 async function binding(input:unknown){const r=requestSchema.parse(input),identity=await deps.identity();if(!identity)throw Error('Connect Comfy or sign in to an eligible plan first.');const usd=await deps.estimate(r);if(usd===null||!Number.isFinite(usd)||usd<=0)throw Error('This step has no verified estimate. Nothing was submitted.');return {r,contextHash:hash({domain:'simple-step-v1',r}),credentialHash:hash(identity),policyHash:hash({domain:'simple-step-v1',usd}),estimateUsd:usd};}
 return {
  async quote(input:unknown):Promise<Quote>{try{const {r:_r,...b}=await binding(input),id=randomUUID(),expiresAt=now()+300000;if(!await deps.store.put(id,{...b,expiresAt}))throw Error('Too many pending quotes.');return {ok:true,id,usd:b.estimateUsd,expiresAt};}catch(e){return {ok:false,reason:e instanceof z.ZodError?'Some inputs exceed the model limits. Check the prompt, duration, voice and references; nothing was submitted.':e instanceof Error?e.message:'Quote unavailable.'};}},
  async execute(input:unknown,id:string,consent:boolean):Promise<Result>{
   if(consent!==true)return {ok:false,reason:'Review the plan and approve execution first.'};
   try{const b=await binding(input),q=await deps.store.get(id);if(!q||q.expiresAt<=now()||q.contextHash!==b.contextHash||q.credentialHash!==b.credentialHash||q.policyHash!==b.policyHash||q.estimateUsd!==b.estimateUsd)return {ok:false,reason:'The quote, inputs, connection or price changed. Review again; no job was submitted.'};if(!await deps.store.claim(id,q))return {ok:false,reason:'This request was already claimed. Check Activity; it was not retried.'};return await deps.generate(b.r);}
   catch{return {ok:false,reason:'Execution could not be confirmed. Check Activity before attempting another request. No automatic retry was made.'};}
  }
 };
}
