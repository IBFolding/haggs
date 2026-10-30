import {recoverJournaled,type Journal} from './managed-job-journal';
import {persistGameBundle} from './game-artifact-bundle';
import type {ArtifactRole} from './managed-artifact-save';
type Job={id:string;urls:{self:string};outputNode:string};
type Provider={findByReference(ref:string):Promise<{id?:string;urls?:{self?:string}}|null>;artifactIndex(job:Job):Promise<{node:string;name:string;mime:string}[]>;artifacts(job:Job,expected:readonly {node:string;name:string;mime:string}[]):Promise<{node:string;name:string;mime:string;bytes:Uint8Array}[]>};
/** Recovery only: never submits a job, and never returns a provider URL. */
export async function recoverGameBundle(userId:string,submissionId:string,deployment:string,kind:'atlas'|'branches',journal:Journal,provider:Provider,save:(role:ArtifactRole,bytes:Uint8Array)=>Promise<string>){
 const entry=await journal.read(userId,submissionId);if(!entry||entry.userId!==userId||entry.submissionId!==submissionId||entry.deployment!==deployment)throw Error('Job not found for this connection.');
 const job=await recoverJournaled(userId,submissionId,journal,ref=>provider.findByReference(ref));
 const index=await provider.artifactIndex(job);
 const required=kind==='atlas'?[{node:'950',name:'atlas.png',mime:'image/png'},{node:'950',name:'atlas.json',mime:'application/json'}]:[0,1,2].map(i=>({node:'9000',name:`branch-${i}.mp4`,mime:'video/mp4'})).concat({node:'9000',name:'branches.json',mime:'application/json'});
 if(kind==='atlas'){const videos=index.filter(e=>e.node==='911'&&e.mime==='video/mp4');if(videos.length!==1)throw Error('Video output is unavailable or ambiguous.');required.unshift(videos[0]!);}
 for(const e of required)if(index.filter(x=>x.node===e.node&&x.name===e.name&&x.mime===e.mime).length!==1)throw Error('Output bundle is incomplete or ambiguous.');
 const artifacts=await provider.artifacts(job,required);return persistGameBundle(kind,artifacts,save);
}
