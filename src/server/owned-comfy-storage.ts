import {list,put} from '@vercel/blob';
import {verifyToken} from './auth';
import {storageAllowance} from './storage-quota';
import {createManagedOutputJournal} from './managed-output-journal';
import {saveManagedOutput} from './managed-output-save';

const TYPES:Record<string,string>={mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',flac:'audio/flac',wav:'audio/wav'};
/** Draft adapter only. Production use requires verified migrations, storage and billing. */
export async function saveOwnedComfyOutput(userToken:string,submissionId:string,bytes:Uint8Array,extension:string):Promise<string> {
 if(process.env.HAGGS_OWN_COMFY_STORAGE_PREVIEW!=='1') throw Error('Owned Comfy storage is not enabled.');
 const user=await verifyToken(userToken);
 if(!user) throw Error('Sign in to save an output.');
 const env=process.env, blobToken=env.BLOB_READ_WRITE_TOKEN??env.HAGGS_SYNC_BLOB_TOKEN;
 const blobHost=env.HAGGS_MANAGED_BLOB_HOST,url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=env.HAGGS_WEBHOOK_SECRET;
 if(!blobToken||!blobHost||!url||!key||!secret) throw Error('Output storage is not configured.');
 if(!/^[a-zA-Z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(blobHost) || !Object.hasOwn(TYPES,extension)) throw Error('Output storage configuration is invalid.');
 const allowance=await storageAllowance(user);
 if(!allowance) throw Error('This account has no cloud storage.');
 const existingFiles:{url:string;size:number}[]=[]; let cursor:string|undefined;
 do {const page=await list({prefix:`haggs/u-${user.id}/`,limit:1000,token:blobToken,...(cursor?{cursor}:{})});existingFiles.push(...page.blobs.map(b=>({url:b.url,size:b.size})));cursor=page.hasMore?page.cursor:undefined;} while(cursor);
 const journal=createManagedOutputJournal({url,key,secret,userToken,blobHost});
 return saveManagedOutput({userId:user.id,submissionId,extension,bytes,allowance,existingFiles},journal,async(path,data,ext)=>{
  await put(path,Buffer.from(data),{access:'public',contentType:TYPES[ext]!,token:blobToken,addRandomSuffix:false,allowOverwrite:false});
 });
}
