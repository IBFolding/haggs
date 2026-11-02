import {createHash,createHmac} from "node:crypto";
import {privateMediaUrl} from "./private-media-url";
export type HostedFile={filename:string;subfolder:string;extension:string};
export type HostedOutput={id:string;user_id:string;scope:"platform"|"own";credential_hash:string;output_node:string;state:"dispatching"|"accepted"|"ready"|"saving"|"saved"|"missing"|"canceled";provider_job:string|null;filename:string|null;subfolder:string|null;extension:string|null;bytes:number|null;digest:string|null;reservation_id:string|null;url:string|null};
export type HostedStore={get:(id:string)=>Promise<HostedOutput|null>;act:(id:string,action:string,value?:Record<string,unknown>)=>Promise<unknown>};
export type HostedIO={store:HostedStore;owner:string;credentialHash:string;inspect:(job:string,node:string)=>Promise<HostedFile|null>;read:(job:string,file:HostedFile)=>Promise<Uint8Array>;reserve:(bytes:number)=>Promise<string>;release:(reservation:string)=>Promise<void>;verify:(path:string,bytes:number,digest:string)=>Promise<boolean>;put:(path:string,bytes:Uint8Array,extension:string)=>Promise<void>;finish:(reservation:string,url:string,bytes:number)=>Promise<void>;writes:()=>boolean};
export class OriginalUnavailable extends Error{}
export const credentialFingerprint=(key:string,secret:string)=>createHmac("sha256",secret).update(key).digest("hex");
export const outputDigest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export function outputPath(record:HostedOutput){if(!record.extension||! /^(png|jpg|webp|mp4|webm|mp3|wav|flac)$/.test(record.extension)||! /^[0-9a-f-]{36}$/.test(record.id)||! /^[0-9a-f-]{36}$/.test(record.user_id))throw Error("Invalid recovery object.");return `haggs/u-${record.user_id}/recovered/${record.id}.${record.extension}`;}
export async function ownedOutput(io:HostedIO,id:string){const record=await io.store.get(id);if(!record||record.user_id!==io.owner)throw Error("Recovery record not found.");if(record.credential_hash!==io.credentialHash)throw Error("The provider connection changed. Restore the matching connection before recovering this job.");return record;}
/** A saving claim is irreversible without reconciliation: uncertain writes are never retried. */
export async function reconcileHostedOutput(io:HostedIO,record:HostedOutput):Promise<string|null>{
 if(record.state!=="saving"&&record.state!=="saved")return null;
 if(!record.bytes||!record.digest||!record.reservation_id)throw Error("Recovery needs operator review.");
 const path=outputPath(record),url=privateMediaUrl(path);
 if(!await io.verify(path,record.bytes,record.digest))throw Error("No verified private copy was found. Saving may be uncertain or the copy was removed. Reconcile storage before retrying; no upload or generation was repeated.");
 await io.finish(record.reservation_id,url,record.bytes);
 if(record.state!=="saved")await io.store.act(record.id,"saved");
 return url;
}
export async function saveHostedOutput(io:HostedIO,id:string,bytes:Uint8Array):Promise<string>{
 const record=await ownedOutput(io,id),found=await reconcileHostedOutput(io,record);if(found)return found;
 if(record.state!=="ready")throw Error("This output is not ready to save.");
 if(!io.writes())throw Error("Private writes are paused. Existing private media remains readable.");
 if(!bytes.length||bytes.length>100*1024*1024)throw Error("Recovery output must be under 100 MB.");
 const reservation=await io.reserve(bytes.length),digest=outputDigest(bytes);
 let claimed:unknown;try{claimed=await io.store.act(id,"claim",{bytes:bytes.length,digest,reservation});}catch(error){await io.release(reservation);throw error;}
 if(claimed!==true){await io.release(reservation);throw Error("Recovery is already active or its storage hold expired. Check status before retrying.");}
 // Journal is committed before this one deterministic, no-overwrite write.
 const path=outputPath(record),url=privateMediaUrl(path);
 await io.put(path,bytes,record.extension!);
 if(!await io.verify(path,bytes.length,digest))throw Error("Private output verification is pending. Do not upload or generate again.");
 await io.finish(reservation,url,bytes.length);await io.store.act(id,"saved");return url;
}
export async function recoverHostedOutput(io:HostedIO,id:string):Promise<string>{
 let record=await ownedOutput(io,id);const found=await reconcileHostedOutput(io,record);if(found)return found;
 if(record.state==="canceled")throw Error("This saved output was deleted. Recovery will not silently restore it.");
 if(!record.provider_job)throw Error("Submission outcome is uncertain. The provider job must be identified before recovery; do not generate again.");
 if(!io.writes())throw Error("Private writes are paused. Recovery can resume when writes are enabled.");
 try{
  const file=await io.inspect(record.provider_job,record.output_node);
  if(!file)throw new OriginalUnavailable("Provider original unavailable.");
  if(record.filename&&(file.filename!==record.filename||file.subfolder!==record.subfolder||file.extension!==record.extension))throw Error("The provider output identity changed. Operator review is required.");
  if(record.state!=="ready") {await io.store.act(id,"ready",file);record=await ownedOutput(io,id);}
  else if(file.filename!==record.filename||file.subfolder!==record.subfolder||file.extension!==record.extension)throw Error("The provider output identity changed. Operator review is required.");
  return await saveHostedOutput(io,id,await io.read(record.provider_job!,file));
 }catch(error){if(error instanceof OriginalUnavailable){await io.store.act(id,"missing");throw Error("No durable private copy was verified and the provider original is unavailable. Metadata cannot recover deleted bytes. No generation was submitted.");}throw error;}
}
