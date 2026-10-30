import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {Artifact,ArtifactJournal,ArtifactRole} from './managed-artifact-save';
const types={mp4:'video/mp4',png:'image/png',json:'application/json'} as const;
/** Check only our exact configured storage host and expected object. Missing never permits re-upload. */
export async function verifyArtifact(item:Artifact,host:string,fetcher:typeof fetch=fetch):Promise<string>{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const expectedExt=item.role==='atlas'?'png':item.role==='manifest'||item.role==='branches'?'json':'mp4';
 if(!/^[a-zA-Z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(host)||!uuid.test(item.userId)||!uuid.test(item.submissionId)||!uuid.test(item.reservationId)||!['video','atlas','manifest','branch0','branch1','branch2','branches'].includes(item.role)||item.extension!==expectedExt||!Number.isSafeInteger(item.bytes)||item.bytes<=0||item.bytes>200000000||!/^[0-9a-f]{64}$/.test(item.sha256))throw Error('Invalid artifact record.');
 const path=`haggs/u-${item.userId}/uploads/${item.reservationId}/managed-${item.submissionId}-${item.role}.${item.extension}`;
 if(item.pathname!==path)throw Error('Invalid artifact path.');
 const url=`https://${host}/${path}`;if(item.state==='committed'&&item.url!==url)throw Error('Invalid committed artifact.');
 const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok||!response.body)throw Error('Artifact is not confirmed. Do not upload again.');
 const mime=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();if(mime&&mime!=='application/octet-stream'&&mime!==types[item.extension])throw Error('Invalid stored artifact type.');
 const length=response.headers.get('content-length');if(length!==null&&Number(length)!==item.bytes)throw Error('Invalid stored artifact size.');
 const reader=response.body.getReader(),hash=createHash('sha256');let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>item.bytes){await reader.cancel();throw Error('Invalid stored artifact size.');}hash.update(value);}}finally{reader.releaseLock();}
 if(size!==item.bytes||hash.digest('hex')!==item.sha256)throw Error('Artifact verification failed. Do not upload again.');return url;
}
/** Draft only. User identity and exact Blob host must be server-controlled. */
export function createManagedArtifactJournal(config:{url:string;key:string;secret:string;userToken:string;blobHost:string;fetch?:typeof fetch}):ArtifactJournal{
 const {url,key,secret,userToken,blobHost}=config;if(!url||!key||!secret||!userToken||!blobHost)throw Error('Artifact storage is not configured.');
 const auth={persistSession:false,autoRefreshToken:false},admin=createClient(url,key,{auth}),mine=createClient(url,key,{auth,global:{headers:{Authorization:`Bearer ${userToken}`}}});
 return {
  async read(user:string,submission:string,role:ArtifactRole){const {data,error}=await mine.from('managed_artifacts').select('user_id,submission_id,role,reservation_id,pathname,extension,bytes,sha256,state,url').eq('user_id',user).eq('submission_id',submission).eq('role',role).maybeSingle();if(error)throw Error('Artifact status unavailable. Do not upload again.');if(!data)return null;return {userId:data.user_id,submissionId:data.submission_id,role:data.role,reservationId:data.reservation_id,pathname:data.pathname,extension:data.extension,bytes:Number(data.bytes),sha256:data.sha256,state:data.state,url:data.url} as Artifact;},
  async claim(item,allowance,existing){const {data,error}=await admin.rpc('managed_artifact_claim',{target:item.userId,submission:item.submissionId,p_role:item.role,reservation:item.reservationId,extension:item.extension,amount:item.bytes,digest:item.sha256,allowance,existing_files:existing,secret});if(error||(data!=='created'&&data!=='existing'))throw Error('Artifact reservation unavailable.');return data;},
  async verifyAndCommit(item){const location=await verifyArtifact(item,blobHost,config.fetch);const {data,error}=await admin.rpc('managed_artifact_commit',{target:item.userId,submission:item.submissionId,p_role:item.role,location,digest:item.sha256,secret});if(error||data!==true)throw Error('Artifact may be saved; confirmation is pending. Do not upload again.');return location;},
 };
}
