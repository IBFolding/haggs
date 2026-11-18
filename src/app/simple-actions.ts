'use server';
import {cookies} from 'next/headers';
import {createSimpleGate,requestSchema} from '../simple/gate';
import {modelFor,type StepRequest} from '../simple/plan';
import {sharedGreyQuoteStore} from '../server/grey-quote-store';
import {COMFY_COOKIE,keyIn} from '../server/keys';
import {userNow} from '../server/auth';
import {platformOn} from '../server/platform';
import {partnerRefusal} from '../server/open-only';
import {estimateGeneration,quoteLine,quoteEffect,quoteMusic,run,speakLine,makeEffect,makeMusic} from './actions';
async function identity(){if(await partnerRefusal())throw Error('Open weights only is on. This automatic plan uses partner models; use Pro to choose an open workflow.');const jar=await cookies(),own=keyIn(jar,COMFY_COOKIE),user=await userNow();if(!own&&(!platformOn()||!user))return null;return {own:own??null,user:user?.id??null,platform:own?null:process.env.COMFY_PLATFORM_KEY};}
async function estimate(r:StepRequest){if(r.kind==='voice')return quoteLine(r.prompt);if(r.kind==='music')return quoteMusic(r.seconds);if(r.kind==='effect')return quoteEffect(r.seconds);const m=modelFor(r);return (await estimateGeneration(m.id,r.prompt,m.settings,r.images,r.firstFrame===true)).usd;}
const gate=createSimpleGate({store:sharedGreyQuoteStore(process.env),identity,estimate,generate:async r=>{
 if(r.kind==='image'||r.kind==='video'){const m=modelFor(r),result=await run(m.id,r.prompt,m.settings,r.images,r.firstFrame===true);if(!result.ok)return result;const asset=result.shots[0];if(!asset||asset.kind!==r.kind)return {ok:false,reason:'The provider did not return the planned media type.'};return {ok:true,url:asset.url,kind:asset.kind,usd:result.usd,...(asset.storageWarning?{storageWarning:asset.storageWarning}:{})};}
 const result=r.kind==='voice'?await speakLine(r.prompt,r.voice!):r.kind==='music'?await makeMusic(r.prompt,r.seconds):await makeEffect(r.prompt,r.seconds);return result.ok?{...result,kind:'audio'}:result;
}});
export async function estimateSimpleStep(input:unknown){try{const r=requestSchema.parse(input);await identity();const usd=await estimate(r);return {ok:true as const,usd};}catch(e){return {ok:false as const,reason:e instanceof Error?e.message:'Estimate unavailable.'};}}
export async function quoteSimpleStep(input:unknown){return gate.quote(input);}
export async function executeSimpleStep(input:unknown,quoteId:string,consent:boolean){return gate.execute(input,quoteId,consent);}
