import {createClient} from '@supabase/supabase-js';
import type {Entry,Journal} from './owned-input-upload';
/** Draft journal; identity must be verified before constructing it. */
export function createOwnedInputJournal(config:{url:string;key:string;secret:string;userToken:string}):Journal{
 const {url,key,secret,userToken}=config;if(!url||!key||!secret||!userToken)throw Error('Input journal is not configured.');
 const auth={persistSession:false,autoRefreshToken:false};const admin=createClient(url,key,{auth});
 const mine=createClient(url,key,{auth,global:{headers:{Authorization:`Bearer ${userToken}`}}});
 return {
  async begin(e:Entry){const {data,error}=await admin.rpc('managed_input_begin',{target:e.userId,submission:e.submissionId,p_field:e.field,p_deployment:e.deployment,p_mime:e.mime,p_bytes:e.size,digest:e.sha256,secret});if(error)throw Error('Could not reserve input. No upload started.');return data===true;},
  async read(userId:string,submissionId:string,field:string){const {data,error}=await mine.from('managed_input_intents').select('user_id,submission_id,deployment,field,mime,bytes,sha256,state,asset_id,expires_at').eq('user_id',userId).eq('submission_id',submissionId).eq('field',field).maybeSingle();if(error)throw Error('Input status is unavailable. Do not upload again.');if(!data)return null;const expiresAt=Date.parse(data.expires_at);if(!Number.isFinite(expiresAt))throw Error('Input status is invalid.');return {userId:data.user_id,submissionId:data.submission_id,deployment:data.deployment,field:data.field,mime:data.mime,size:Number(data.bytes),sha256:data.sha256,state:data.state,...(data.asset_id?{assetId:data.asset_id}:{}),expiresAt} as Entry;},
  async accept(e:Entry,assetId:string){const {data,error}=await admin.rpc('managed_input_accept',{target:e.userId,submission:e.submissionId,p_field:e.field,digest:e.sha256,provider_id:assetId,secret});if(error)throw Error('Upload may have completed. Do not upload again.');return data===true;},
 };
}
