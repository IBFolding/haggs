'use server';
import {createHash} from 'node:crypto';
import {gpuIn,gpuBase,gpuFetch} from '../../server/gpu-connection';
export type MachineReport={base:string;checkedAt:number;fingerprint:string;devices:{name:string;totalGB:number|null;freeGB:number|null}[];nodes:number;models:{loader:string;field:string;names:string[]}[];version:string};
/** Read-only machine disclosure. A successful catalog fetch is not a qualification render. */
export async function inspectMachine():Promise<{ok:true;report:MachineReport}|{ok:false;reason:string}>{
 try{
  const address=await gpuIn();if(!address)return {ok:false,reason:'Connect a local or rented GPU in connection settings first.'};
  const base=gpuBase(address);const [statsResponse,catalogResponse]=await Promise.all([gpuFetch(base+'/system_stats',{signal:AbortSignal.timeout(10000)}),gpuFetch(base+'/object_info',{signal:AbortSignal.timeout(15000)})]);
  if(!statsResponse.ok||!catalogResponse.ok)throw Error('ComfyUI status or catalog did not answer.');
  const stats=await statsResponse.json() as {system?:{comfyui_version?:string};devices?:{name?:string;vram_total?:number;vram_free?:number}[]};
  const raw=await catalogResponse.json();if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid ComfyUI catalog.');
  const models:MachineReport['models']=[];
  for(const loader of ['CheckpointLoaderSimple','UNETLoader','VAELoader','CLIPLoader','DualCLIPLoader']){
   const fields=raw[loader]?.input?.required;if(!fields||typeof fields!=='object')continue;
   for(const [field,config] of Object.entries(fields)){if(Array.isArray(config)&&Array.isArray(config[0])&&config[0].every(n=>typeof n==='string'))models.push({loader,field,names:config[0].slice(0,300).map((n:string)=>n.slice(0,200))});}
  }
  const gb=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?Math.round(n/1024**3*10)/10:null;
  const devices=(stats.devices??[]).slice(0,8).map(d=>({name:String(d.name??'Unknown device').slice(0,160),totalGB:gb(d.vram_total),freeGB:gb(d.vram_free)}));
  const version=String(stats.system?.comfyui_version??'Not reported').slice(0,80);
  const fingerprint=createHash('sha256').update(JSON.stringify([Object.keys(raw).sort(),models,devices.map(d=>[d.name,d.totalGB]),version])).digest('hex').slice(0,24);
  return {ok:true,report:{base,checkedAt:Date.now(),fingerprint,devices,nodes:Object.keys(raw).length,models,version}};
 }catch(error){return {ok:false,reason:error instanceof Error?error.message:'Machine inspection failed. No render was submitted.'};}
}
