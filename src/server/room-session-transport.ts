import {createHash,randomUUID} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type RoomSession={id:string;owner:string;deployment:string;expiresAt:number;state:'open'|'uploading'|'recorded';recording?:{path:string;bytes:number;sha256:string}};
/** Store implementations must perform claim/commit atomically in shared durable storage. */
export type RoomStore={create(session:RoomSession):Promise<boolean>;read(owner:string,id:string):Promise<RoomSession|null>;claim(owner:string,id:string,recording:NonNullable<RoomSession['recording']>,now:number):Promise<boolean>;commit(owner:string,id:string,recording:NonNullable<RoomSession['recording']>,now:number):Promise<boolean>};
export type RoomObjects={putOnce(path:string,bytes:Uint8Array):Promise<void>;verify(path:string,bytes:number,sha256:string):Promise<boolean>};
const deploymentOk=(s:string)=>/^https:\/\/[a-z0-9-]+\.run\.comfy\.app$/.test(s);
/** All identities must come from verified server authentication, never a client user ID. */
export function createRoomTransport(store:RoomStore,objects:RoomObjects,validate:(bytes:Uint8Array)=>Promise<void>,now:()=>number=Date.now){
 async function checked(owner:string,id:string,deployment:string){if(!UUID.test(owner)||!UUID.test(id)||!deploymentOk(deployment))throw Error('Invalid room request.');const row=await store.read(owner,id);if(!row||row.owner!==owner||row.id!==id||row.deployment!==deployment)throw Error('Room not found.');if(!Number.isFinite(row.expiresAt)||row.expiresAt<=now())throw Error('Room session expired.');return row;}
 return {
  async create(owner:string,deployment:string){if(!UUID.test(owner)||!deploymentOk(deployment))throw Error('Invalid room request.');const id=randomUUID();const row:RoomSession={id,owner,deployment,expiresAt:now()+24*60*60*1000,state:'open'};if(!await store.create(row))throw Error('Could not create room.');return id;},
  async status(owner:string,id:string,deployment:string){const row=await checked(owner,id,deployment);return {state:row.state,expiresAt:row.expiresAt};},
  async record(owner:string,id:string,deployment:string,bytes:Uint8Array){
   const row=await checked(owner,id,deployment);if(!bytes.length||bytes.length>100_000_000)throw Error('Invalid recording size.');await validate(bytes);
   const recording={path:`rooms/u-${owner}/${id}/recording.mp4`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
   if(row.state!=='open'||!await store.claim(owner,id,recording,now()))throw Error('Recording already exists or is uncertain. Recover it instead.');
   try{await objects.putOnce(recording.path,bytes);}catch{throw Error('Recording may be saved. Recover it before trying again.');}
   if(!await objects.verify(recording.path,recording.bytes,recording.sha256))throw Error('Recording is not confirmed. Recover it before trying again.');
   if(!await store.commit(owner,id,recording,now()))throw Error('Recording confirmation is pending. Recover it before trying again.');
   return {state:'recorded' as const};
  },
  async recover(owner:string,id:string,deployment:string){
   const row=await checked(owner,id,deployment);if(row.state==='open'||!row.recording)throw Error('No recording to recover.');
   const expected=`rooms/u-${owner}/${id}/recording.mp4`;
   if(row.recording.path!==expected||!Number.isSafeInteger(row.recording.bytes)||row.recording.bytes<=0||row.recording.bytes>100_000_000||!/^[0-9a-f]{64}$/.test(row.recording.sha256))throw Error('Invalid recording record.');
   if(!await objects.verify(expected,row.recording.bytes,row.recording.sha256))throw Error('Recording is not confirmed. Do not upload it again.');
   if(row.state!=='recorded'&&!await store.commit(owner,id,row.recording,now())){const latest=await checked(owner,id,deployment);if(latest.state!=='recorded'||!latest.recording||latest.recording.path!==row.recording.path||latest.recording.bytes!==row.recording.bytes||latest.recording.sha256!==row.recording.sha256)throw Error('Recording confirmation is pending.');}
   return {state:'recorded' as const};
  },
 };
}
