import {ownedComfyOrigin} from './comfy-owned-connection';
import {recoverJournaled,submitJournaled,type Journal} from './managed-job-journal';

type Connection = {ownerId:string;origin:string};
type Workflow = {outputNode:string};
type Dependencies = {
  connection(userId:string):Promise<Connection|null>;
  workflow(name:string):Promise<Workflow|null>;
  journal:Journal;
  submit(origin:string,name:string,reference:string):Promise<{id?:string;urls?:{self?:string}}>;
  find(origin:string,reference:string):Promise<{id?:string;urls?:{self?:string}}|null>;
  save(origin:string,job:{id:string;urls:{self:string}},outputNode:string,userId:string,reference:string):Promise<string>;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Experimental service only: authenticated identity and connection come from trusted server-side sources.
 * Never mount this until provider billing, durable credentials, storage and app inputs are verified. */
export async function ownedComfyExecution(userId:string|null,submissionId:string,name:string,action:'start'|'recover',deps:Dependencies):Promise<string> {
  if(!userId) throw Error('Sign in to use your deployment.');
  if(!UUID.test(submissionId) || !/^[a-z0-9-]{1,80}$/.test(name) || !['start','recover'].includes(action)) throw Error('Invalid request.');
  const connection=await deps.connection(userId);
  if(!connection || connection.ownerId!==userId) throw Error('Your deployment is not connected.');
  const origin=ownedComfyOrigin(connection.origin);
  if(action==='start') {
    const workflow=await deps.workflow(name);
    if(!workflow || !/^[a-zA-Z0-9_-]{1,128}$/.test(workflow.outputNode)) throw Error('This workflow is unavailable.');
    const job=await submitJournaled({userId,submissionId,deployment:origin,outputNode:workflow.outputNode,state:'dispatching'},deps.journal,ref=>deps.submit(origin,name,ref));
    return deps.save(origin,job,workflow.outputNode,userId,submissionId);
  }
  const record=await deps.journal.read(userId,submissionId);
  if(!record || record.userId!==userId || record.deployment!==origin) throw Error('Job not found for this connection.');
  const job=await recoverJournaled(userId,submissionId,deps.journal,ref=>deps.find(origin,ref));
  return deps.save(origin,job,job.outputNode,userId,submissionId);
}
