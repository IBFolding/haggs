import {recoverJournaled, type Journal} from './managed-job-journal';
import type {ManagedJob} from '../providers/comfy-managed';

type Provider = {findByReference(reference:string):Promise<ManagedJob|null>;status(job:ManagedJob,outputNode:string):Promise<{status:string;providerOutputAvailable:boolean}>};
/** Owner and server deployment are checked before any provider request. */
export async function managedJobStatus(userId:string, submissionId:string, deployment:string, journal:Journal, provider:Provider) {
  const entry = await journal.read(userId,submissionId);
  if (!entry || entry.userId !== userId || entry.submissionId !== submissionId) throw new Error('Job not found for this account.');
  if (entry.deployment !== deployment) throw new Error('Job deployment is no longer available.');
  const job = await recoverJournaled(userId,submissionId,journal,ref=>provider.findByReference(ref));
  return provider.status(job,job.outputNode);
}
