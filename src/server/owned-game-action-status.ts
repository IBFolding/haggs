import {ownedComfyOrigin} from './comfy-owned-connection';
import {recoverJournaled} from './managed-job-journal';
import {bindActionJournal,type ActionJournalStore,type ActionMode} from './owned-game-action-journal';
/** One short status request per call. The caller schedules polling; no job is submitted here. */
export async function ownedGameActionStatus(user:string|null,reference:string,mode:ActionMode,deps:{connection(user:string):Promise<{ownerId:string;origin:string}|null>;journal:ActionJournalStore;find(origin:string,reference:string):Promise<{id?:string;urls?:{self?:string}}|null>;status(origin:string,job:{id:string;urls:{self:string}},node:string):Promise<{status:string;providerOutputAvailable:boolean}>}){
 if(!user)throw Error('Sign in to check this job.');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)||!['drag-to-action','boss-fight'].includes(mode))throw Error('Invalid request.');
 const connection=await deps.connection(user);if(!connection||connection.ownerId!==user)throw Error('Connection unavailable.');const origin=ownedComfyOrigin(connection.origin),journal=bindActionJournal(deps.journal,mode),entry=await journal.read(user,reference);
 if(!entry||entry.userId!==user||entry.submissionId!==reference||entry.deployment!==origin||entry.outputNode!=='911')throw Error('Job not found for this connection.');
 const job=await recoverJournaled(user,reference,journal,ref=>deps.find(origin,ref));const result=await deps.status(origin,job,'911');
 if(!['queued','running','canceling','succeeded','failed','canceled','expired'].includes(result.status)||typeof result.providerOutputAvailable!=='boolean')throw Error('Invalid job status.');
 return {status:result.status,providerOutputAvailable:result.status==='succeeded'&&result.providerOutputAvailable};
}
