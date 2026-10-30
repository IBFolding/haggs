import {createHash} from 'node:crypto';import type {RoomObjects} from './room-session-transport';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PrivateRoomBlob={putOnce(path:string,bytes:Uint8Array):Promise<void>;read(path:string,maxBytes:number):Promise<Uint8Array|null>};
/** These operations must be atomic and durable in a shared quota service. */
export type RoomQuota={reserve(owner:string,session:string,bytes:number,digest:string):Promise<'created'|'existing'|'denied'>;commit(owner:string,session:string,bytes:number,digest:string):Promise<boolean>};
/** One owner and session per instance. No URLs or client-chosen object paths are accepted. */
export function createPrivateRoomObjects(owner:string,session:string,blob:PrivateRoomBlob,quota:RoomQuota):RoomObjects{
 if(!UUID.test(owner)||!UUID.test(session))throw Error('Invalid room identity.');const expected=`rooms/u-${owner}/${session}/recording.mp4`;
 return {
  async putOnce(path,bytes){if(path!==expected||!bytes.length||bytes.length>100_000_000)throw Error('Invalid recording.');const digest=createHash('sha256').update(bytes).digest('hex');const claim=await quota.reserve(owner,session,bytes.length,digest);if(claim!=='created')throw Error('Recording reservation already exists or is unavailable. Do not upload again.');await blob.putOnce(expected,bytes);},
  async verify(path,size,digest){if(path!==expected||!Number.isSafeInteger(size)||size<=0||size>100_000_000||!/^[0-9a-f]{64}$/.test(digest))return false;const bytes=await blob.read(expected,size);if(!bytes||bytes.length!==size||createHash('sha256').update(bytes).digest('hex')!==digest)return false;return quota.commit(owner,session,size,digest);},
 };
}
/** No in-process fallback: validation must run in a separately isolated bounded worker. */
export function createRoomValidator(sandbox?:{probe(bytes:Uint8Array):Promise<{valid:boolean;duration:number;video:boolean}>}){
 return async(bytes:Uint8Array)=>{if(!sandbox)throw Error('Isolated media validation is not configured.');const result=await sandbox.probe(bytes);if(!result.valid||!result.video||!Number.isFinite(result.duration)||result.duration<=0||result.duration>10)throw Error('Invalid room recording.');};
}

/** Cleanup remains pending unless an atomic lease and conditional deletion succeed. */
export type RoomCleanup={claim(owner:string,session:string,now:number):Promise<{path:string;bytes:number;sha256:string;lease:string}|null>;finish(owner:string,session:string,lease:string):Promise<boolean>};
export async function cleanupExpiredRoom(owner:string,session:string,now:number,ledger:RoomCleanup,objects:{deleteIfMatch(path:string,bytes:number,digest:string):Promise<boolean>}):Promise<'not-ready'|'deleted'> {
 if(!UUID.test(owner)||!UUID.test(session)||!Number.isFinite(now))throw Error('Invalid cleanup request.');
 const item=await ledger.claim(owner,session,now);if(!item)return 'not-ready';const path=`rooms/u-${owner}/${session}/recording.mp4`;
 if(item.path!==path||!Number.isSafeInteger(item.bytes)||item.bytes<=0||item.bytes>100_000_000||!/^[0-9a-f]{64}$/.test(item.sha256)||!UUID.test(item.lease))throw Error('Invalid cleanup record.');
 if(!await objects.deleteIfMatch(path,item.bytes,item.sha256))throw Error('Cleanup outcome is uncertain; keep the reservation.');
 if(!await ledger.finish(owner,session,item.lease))throw Error('Cleanup confirmation is pending; keep the reservation.');return 'deleted';
}
