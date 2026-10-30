import {createHash,randomUUID} from 'node:crypto';
export type ArtifactRole='video'|'atlas'|'manifest'|'branch0'|'branch1'|'branch2'|'branches';
export type Artifact={userId:string;submissionId:string;role:ArtifactRole;reservationId:string;pathname:string;extension:'mp4'|'png'|'json';bytes:number;sha256:string;state:'reserved'|'committed';url:string|null};
export type ArtifactJournal={read(user:string,submission:string,role:ArtifactRole):Promise<Artifact|null>;claim(item:Artifact,allowance:number,existing:{url:string;size:number}[]):Promise<'created'|'existing'>;verifyAndCommit(item:Artifact):Promise<string>};
const extFor=(role:ArtifactRole)=>role==='atlas'?'png':role==='manifest'||role==='branches'?'json':'mp4';
/** Save one artifact; an uncertain upload is only verified, never repeated. */
export async function saveManagedArtifact(args:{userId:string;submissionId:string;role:ArtifactRole;bytes:Uint8Array;allowance:number;existing:{url:string;size:number}[]},journal:ArtifactJournal,upload:(item:Artifact,data:Uint8Array)=>Promise<void>):Promise<string>{
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(args.userId)||!uuid.test(args.submissionId)||!['video','atlas','manifest','branch0','branch1','branch2','branches'].includes(args.role)||!args.bytes.length||args.bytes.length>200_000_000)throw Error('Invalid artifact.');
 const sha256=createHash('sha256').update(args.bytes).digest('hex'),extension=extFor(args.role);
 const recover=async(item:Artifact)=>{if(item.userId!==args.userId||item.submissionId!==args.submissionId||item.role!==args.role||item.bytes!==args.bytes.length||item.sha256!==sha256||item.extension!==extension)throw Error('Artifact conflict. Do not upload again.');return journal.verifyAndCommit(item);};
 const old=await journal.read(args.userId,args.submissionId,args.role);if(old)return recover(old);
 const reservationId=randomUUID(),pathname=`haggs/u-${args.userId}/uploads/${reservationId}/managed-${args.submissionId}-${args.role}.${extension}`;
 const item:Artifact={userId:args.userId,submissionId:args.submissionId,role:args.role,reservationId,pathname,extension,bytes:args.bytes.length,sha256,state:'reserved',url:null};
 if(await journal.claim(item,args.allowance,args.existing)==='existing'){const winner=await journal.read(args.userId,args.submissionId,args.role);if(!winner)throw Error('Artifact reservation uncertain. Do not upload again.');return recover(winner);}
 try{await upload(item,args.bytes);}catch{throw Error('Artifact upload may have succeeded. Recover before retrying.');}
 return journal.verifyAndCommit(item);
}
