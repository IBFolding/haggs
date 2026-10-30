import {createHash, randomUUID} from 'node:crypto';
import type {ManagedOutput} from './managed-output-journal';

type Journal = {
  read(userId:string, submissionId:string):Promise<ManagedOutput|null>;
  claim(item:ManagedOutput, allowance:number, existingFiles:{url:string;size:number}[]):Promise<'created'|'existing'>;
  verifyAndCommit(item:ManagedOutput):Promise<string>;
};
type Upload = (path:string, bytes:Uint8Array, extension:string)=>Promise<void>;

/** Never retry an uncertain upload: only the process that created the reservation may upload. */
export async function saveManagedOutput(args:{userId:string;submissionId:string;extension:string;bytes:Uint8Array;allowance:number;existingFiles:{url:string;size:number}[]}, journal:Journal, upload:Upload):Promise<string> {
  const existing=await journal.read(args.userId,args.submissionId);
  if(existing) return recoverMatching(existing,args,journal);
  const reservationId=randomUUID();
  const item:ManagedOutput={userId:args.userId,submissionId:args.submissionId,reservationId,extension:args.extension,bytes:args.bytes.byteLength,sha256:createHash('sha256').update(args.bytes).digest('hex'),pathname:`haggs/u-${args.userId}/uploads/${reservationId}/managed-${args.submissionId}.${args.extension}`,state:'reserved',url:null};
  const result=await journal.claim(item,args.allowance,args.existingFiles);
  if(result==='existing') {
    const winner=await journal.read(args.userId,args.submissionId);
    if(!winner) throw new Error('Output reservation is uncertain. Do not upload again.');
    return recoverMatching(winner,args,journal);
  }
  try { await upload(item.pathname,args.bytes,item.extension); }
  catch { throw new Error('Output upload may have succeeded. Recover it before trying again.'); }
  return journal.verifyAndCommit(item);
}

async function recoverMatching(item:ManagedOutput,args:{userId:string;submissionId:string;extension:string;bytes:Uint8Array},journal:Journal):Promise<string> {
  const digest=createHash('sha256').update(args.bytes).digest('hex');
  if(item.userId!==args.userId || item.submissionId!==args.submissionId || item.extension!==args.extension || item.bytes!==args.bytes.byteLength || item.sha256!==digest) throw new Error('Existing output does not match this request. Do not upload again.');
  return journal.verifyAndCommit(item);
}
