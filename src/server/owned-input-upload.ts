import {probeOwnedInput} from './owned-comfy-input';
import type {ComfyAsset} from '../providers/comfy-managed';

export type Entry={userId:string;submissionId:string;field:string;mime:string;sha256:string;size:number;state:'uploading'|'ready';assetId?:string;expiresAt:number};
export type Journal={begin(entry:Entry):Promise<boolean>;read(userId:string,submissionId:string,field:string):Promise<Entry|null>;accept(entry:Entry,assetId:string):Promise<boolean>};
type Deps={journal:Journal;upload(bytes:Uint8Array,mime:string):Promise<ComfyAsset>;probe?:typeof probeOwnedInput;now?:()=>number};
/** Prototype: journal must atomically persist upload intent before invoking the provider. */
export async function uploadOwnedInput(userId:string,submissionId:string,field:string,mime:string,bytes:Uint8Array,deps:Deps):Promise<ComfyAsset>{
 const now=(deps.now??Date.now)();
 if(!userId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId))throw Error('Invalid upload request.');
 const checked=await (deps.probe??probeOwnedInput)(field,mime,bytes);
 const existing=await deps.journal.read(userId,submissionId,field);
 if(existing){
  if(existing.userId!==userId||existing.submissionId!==submissionId||existing.field!==field||existing.mime!==mime||existing.sha256!==checked.sha256||existing.size!==checked.bytes)throw Error('Input does not match the saved upload.');
  if(existing.expiresAt<=now)throw Error('Input expired. Cleanup is pending; do not upload again automatically.');
  if(existing.state!=='ready'||!existing.assetId)throw Error('Upload outcome is uncertain. Do not upload it again.');
  return {__type:'core/ASSET',info:{id:existing.assetId}};
 }
 const entry:Entry={userId,submissionId,field,mime,sha256:checked.sha256,size:checked.bytes,state:'uploading',expiresAt:now+24*60*60*1000};
 if(!await deps.journal.begin(entry))throw Error('Upload already exists. Check its status before retrying.');
 let asset:ComfyAsset;try{asset=await deps.upload(bytes,mime);}catch{throw Error('Upload outcome is uncertain. Do not upload it again.');}
 if(asset.__type!=='core/ASSET'||!asset.info||!/^[a-zA-Z0-9_-]{1,128}$/.test(asset.info.id))throw Error('Upload outcome is uncertain. Do not upload it again.');
 if(!await deps.journal.accept(entry,asset.info.id))throw Error('Upload may have completed. Check its status before retrying.');
 return asset;
}

/** Resolve only ready, unexpired inputs belonging to the authenticated owner and job. */
export async function resolveOwnedPortalInputs(userId:string,submissionId:string,journal:Journal,now=Date.now()):Promise<Record<string,ComfyAsset>> {
 if(!userId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId))throw Error('Invalid input request.');
 const result:Record<string,ComfyAsset>={};
 for(const field of ['1/file','10001/file','10002/audio']) {
  const entry=await journal.read(userId,submissionId,field);
  if(!entry||entry.userId!==userId||entry.submissionId!==submissionId||entry.field!==field||entry.state!=='ready'||!entry.assetId||!/^[a-zA-Z0-9_-]{1,128}$/.test(entry.assetId)||!Number.isFinite(entry.expiresAt)||entry.expiresAt<=now)throw Error('A required upload is unavailable or expired.');
  result[field]={__type:'core/ASSET',info:{id:entry.assetId}};
 }
 return result;
}
