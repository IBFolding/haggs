import type {Kv} from '../story/kv';
import type {StepRequest} from './plan';
import type {Result} from './gate';
const key=async(owner:string,project:string,r:StepRequest)=>{
 const bytes=new TextEncoder().encode(JSON.stringify(['simple-audio-v1-eleven_v4-sonilo',r.kind,r.prompt,r.voice??null,r.kind==='voice'?null:r.seconds]));
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');return `simple/audio/${owner}/${project}/${hash}`;
};
const audio=(r:StepRequest)=>['voice','effect','music'].includes(r.kind);
export async function cachedAudio(kv:Kv,owner:string,project:string,r:StepRequest){if(!audio(r))return;const found=await kv.get<Extract<Result,{ok:true}>>(await key(owner,project,r));if(!found||found.kind!=='audio'||found.storageWarning)return;return found;}
export async function rememberAudio(kv:Kv,owner:string,project:string,r:StepRequest,result:Extract<Result,{ok:true}>){if(audio(r)&&result.kind==='audio'&&!result.storageWarning)await kv.set(await key(owner,project,r),result);}
