export type OutputRef={owner:string;job:string;filename:string;subfolder:string;extension:string};
export type RecoveryRecord={ref:OutputRef;state:"pending"|"saving"|"saved";url?:string};
export type RecoveryStore={load:(id:string)=>Promise<RecoveryRecord|null>;save:(id:string,record:RecoveryRecord)=>Promise<void>;claim:(id:string,owner:string)=>Promise<boolean>};
export function recoveryKey(ref:OutputRef){
 if(!/^[0-9a-f-]{36}$/.test(ref.owner)||!/^[-\w]{1,128}$/.test(ref.job)||!/^[-\w.]{1,200}$/.test(ref.filename)||!/^[-\w/]{0,100}$/.test(ref.subfolder)||ref.subfolder.includes("..")||! /^(png|jpg|webp|mp4|webm|mp3|wav|flac)$/.test(ref.extension))throw Error("Invalid output recovery reference.");
 return JSON.stringify([ref.owner,ref.job,ref.filename,ref.subfolder]);
}
/** Stable provider file identity survives signed-link expiry. Never records a key or signed URL. */
export async function rememberOutput(store:RecoveryStore,ref:OutputRef){const id=recoveryKey(ref),prior=await store.load(id);if(prior){if(JSON.stringify(prior.ref)!==JSON.stringify(ref))throw Error("Recovery identity conflict.");return id;}await store.save(id,{ref,state:"pending"});return id;}
/** Store.claim must atomically change pending to saving, owner-bound. No generation API exists here. */
export async function recoverOutput(store:RecoveryStore,id:string,owner:string,io:{read:(ref:OutputRef)=>Promise<Uint8Array>;keep:(bytes:Uint8Array,ref:OutputRef,id:string)=>Promise<string>;findSaved:(id:string)=>Promise<string|null>}):Promise<string>{
 const record=await store.load(id);if(!record||record.ref.owner!==owner||recoveryKey(record.ref)!==id)throw Error("Recovery record not found.");
 if(record.state==="saved"&&record.url)return record.url;
 if(record.state==="saving"){
  const found=await io.findSaved(id);if(!found)throw Error("Saving outcome is uncertain. Reconcile storage before retrying; no new generation was started.");
  await store.save(id,{...record,state:"saved",url:found});return found;
 }
 // Reading uses authenticated provider file identity, never the expired preview URL.
 if(!await store.claim(id,owner))throw Error("Recovery is already active. Check its status before retrying.");
 let bytes:Uint8Array;
 try { bytes=await io.read(record.ref); } catch(error) { await store.save(id,{...record,state:"pending"}); throw error; }
 const url=await io.keep(bytes,record.ref,id);
 await store.save(id,{...record,state:"saved",url});return url;
}
