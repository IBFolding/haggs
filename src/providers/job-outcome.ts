import {AsyncLocalStorage} from 'node:async_hooks';
export type JobOutcome={state:'not-submitted'|'uncertain'|'rejected'|'completed';jobId?:string;storage?:{id:string;userId:string;maxBytes:number;saved:boolean}};
export const jobOutcome=new AsyncLocalStorage<JobOutcome>();
/** Only transport code updates this server-side state; never accept it from a client. */
export function markJob(state:JobOutcome['state'],jobId?:string){const current=jobOutcome.getStore();if(current){current.state=state;if(jobId)current.jobId=jobId;}}
