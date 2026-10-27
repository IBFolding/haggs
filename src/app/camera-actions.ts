"use server";
import {cookies} from 'next/headers';
import {COMFY_COOKIE,keyIn,localIn} from '../server/keys';
import {catalogOf} from '../server/comfy-library';
import {localBase} from '../providers/local';
import {trajectoryWorkflow,trajectoryPreflight} from '../comfy/trajectory-vace';
import type {Trajectory} from '../story/trajectory';
import type {Catalog} from '../comfy/convert';
/** Catalog lookup only. Never queues, uploads media, changes settings or requests inference. */
export async function checkCameraBackend(t:Trajectory,vertical:boolean,prompt:string){
 try{
  const jar=await cookies(),address=localIn(jar),key=keyIn(jar,COMFY_COOKIE);let catalog:Catalog;let backend:string;
  if(address){const response=await fetch(`${localBase(address)}/object_info`,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});if(!response.ok)throw Error('Local Comfy catalog is unavailable.');catalog=await response.json();backend='Your local ComfyUI';}
  else if(key){catalog=await catalogOf(process.cwd(),key);backend='Comfy Cloud catalog (may be cached)';}
  else return {ok:false,reason:'Connect an existing Comfy account or local ComfyUI in Provider keys. Nothing was submitted.'};
  const problems=trajectoryPreflight(trajectoryWorkflow(t,vertical,prompt),catalog);
  if(problems.length)return{ok:false,reason:`${backend}: ${problems.slice(0,3).join('; ')}`};
  return{ok:true,reason:`${backend}: graph schema accepted. Model execution and output quality are not tested.`,price:null,submissionEnabled:false};
 }catch{return{ok:false,reason:'Backend compatibility could not be checked. No upload or job was submitted. Retry when the configured backend is reachable.'};}
}
