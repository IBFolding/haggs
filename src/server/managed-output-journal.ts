import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

export type ManagedOutput = {submissionId:string; userId:string; reservationId:string; pathname:string; extension:string; bytes:number; sha256:string; state:'reserved'|'committed'; url:string|null};
type Config = {url:string;key:string;secret:string;userToken:string;blobHost:string;fetch?:typeof fetch};
const MIME: Record<string,string> = {mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',flac:'audio/flac',wav:'audio/wav'};

function validateManagedOutput(item:ManagedOutput):string {
  if (!Object.hasOwn(MIME,item.extension) || !Number.isSafeInteger(item.bytes) || item.bytes<=0 || item.bytes>200_000_000 || !/^[0-9a-f]{64}$/.test(item.sha256)) throw new Error('Managed output record is invalid.');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(item.userId) || !uuid.test(item.submissionId) || !uuid.test(item.reservationId)) throw new Error('Managed output record is invalid.');
  const expected=`haggs/u-${item.userId}/uploads/${item.reservationId}/managed-${item.submissionId}.${item.extension}`;
  if (item.pathname!==expected) throw new Error('Managed output path is invalid.');
  return expected;
}

/** Verify a deterministic object before the atomic storage/journal commit.
 * Never interpret a missing object or a failed request as permission to upload again. */
export async function verifyManagedOutput(item:ManagedOutput, blobHost:string, fetcher:typeof fetch=fetch):Promise<string> {
  if (!/^[a-zA-Z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(blobHost)) throw new Error('Managed storage is not configured.');
  const expected=validateManagedOutput(item);
  const url=`https://${blobHost}/${expected}`;
  if (item.state==='committed' && item.url!==url) throw new Error('Managed output record is invalid.');
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(120_000)});
  if (!response.ok || !response.body) throw new Error('Output is not confirmed in storage. Do not upload or submit it again.');
  const contentType=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType && contentType!=='application/octet-stream' && contentType!==MIME[item.extension]) throw new Error('Stored output type is invalid. Do not upload it again.');
  const length=response.headers.get('content-length');
  if (length !== null && Number(length)!==item.bytes) throw new Error('Stored output size is invalid. Do not upload it again.');
  const reader=response.body.getReader(), hash=createHash('sha256'); let size=0;
  try { for (;;) {const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>item.bytes){await reader.cancel();throw new Error('Stored output size is invalid. Do not upload it again.');} hash.update(value); } }
  finally {reader.releaseLock();}
  if(size!==item.bytes || hash.digest('hex')!==item.sha256) throw new Error('Stored output verification failed. Do not upload it again.');
  return url;
}

/** Unwired prototype; callers must obtain user identity and blobHost from trusted server configuration. */
export function createManagedOutputJournal(config:Config) {
  if (!config.url || !config.key || !config.secret || !config.userToken) throw new Error('Managed output recovery is not configured.');
  const opts={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(config.url,config.key,opts);
  const mine=createClient(config.url,config.key,{...opts,global:{headers:{Authorization:`Bearer ${config.userToken}`}}});
  return {
    async claim(item:ManagedOutput,allowance:number,existingFiles:{url:string;size:number}[]) {
      if(item.state!=='reserved' || item.url!==null) throw new Error('Invalid output claim.');
      validateManagedOutput(item);
      const {data,error}=await admin.rpc('managed_output_claim',{target:item.userId,submission:item.submissionId,reservation:item.reservationId,extension:item.extension,amount:item.bytes,digest:item.sha256,allowance,existing_files:existingFiles,secret:config.secret});
      if(error || (data!=='created' && data!=='existing')) throw new Error('Could not reserve managed output storage.');
      return data as 'created'|'existing';
    },
    async read(userId:string,submissionId:string):Promise<ManagedOutput|null> {
      const {data,error}=await mine.from('managed_output_journal').select('submission_id,user_id,reservation_id,pathname,extension,bytes,sha256,state,url').eq('user_id',userId).eq('submission_id',submissionId).maybeSingle();
      if(error) throw new Error('Could not read managed output. Do not upload it again.');
      if(!data)return null;
      return {submissionId:data.submission_id,userId:data.user_id,reservationId:data.reservation_id,pathname:data.pathname,extension:data.extension,bytes:Number(data.bytes),sha256:data.sha256,state:data.state,url:data.url};
    },
    async verifyAndCommit(item:ManagedOutput) {
      const url=await verifyManagedOutput(item,config.blobHost,config.fetch);
      const {data,error}=await admin.rpc('managed_output_commit',{target:item.userId,submission:item.submissionId,location:url,digest:item.sha256,secret:config.secret});
      if(error || data!==true) throw new Error('Output may be saved, but storage confirmation is pending. Do not upload it again.');
      return url;
    },
  };
}
