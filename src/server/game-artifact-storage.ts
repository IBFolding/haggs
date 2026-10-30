import {list,put} from '@vercel/blob';
import {verifyToken} from './auth';
import {storageAllowance} from './storage-quota';
import {createManagedArtifactJournal} from './managed-artifact-journal';
import {saveManagedArtifact,type ArtifactRole} from './managed-artifact-save';
const types={mp4:'video/mp4',png:'image/png',json:'application/json'} as const;
/** Draft only. No route enables this in production. */
export async function saveGameArtifact(token:string,submissionId:string,role:ArtifactRole,bytes:Uint8Array):Promise<string>{
 if(process.env.NODE_ENV==='production'||process.env.HAGGS_GAME_ARTIFACT_PREVIEW!=='1')throw Error('Game artifact saving is unavailable.');
 const user=await verifyToken(token);if(!user)throw Error('Sign in first.');
 const env=process.env,blobToken=env.BLOB_READ_WRITE_TOKEN??env.HAGGS_SYNC_BLOB_TOKEN,host=env.HAGGS_MANAGED_BLOB_HOST,url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=env.HAGGS_WEBHOOK_SECRET;
 if(!blobToken||!host||!url||!key||!secret||!/^[a-zA-Z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(host))throw Error('Storage is not configured.');
 const allowance=await storageAllowance(user);if(!allowance)throw Error('This account has no cloud storage.');
 const existing:{url:string;size:number}[]=[];let cursor:string|undefined;
 do{const page=await list({prefix:`haggs/u-${user.id}/`,limit:1000,token:blobToken,...(cursor?{cursor}:{})});existing.push(...page.blobs.map(b=>({url:b.url,size:b.size})));cursor=page.hasMore?page.cursor:undefined;}while(cursor);
 const journal=createManagedArtifactJournal({url,key,secret,userToken:token,blobHost:host});
 return saveManagedArtifact({userId:user.id,submissionId,role,bytes,allowance,existing},journal,async(item,data)=>{await put(item.pathname,Buffer.from(data),{access:'public',contentType:types[item.extension],token:blobToken,addRandomSuffix:false,allowOverwrite:false});});
}
