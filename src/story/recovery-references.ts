import type {Kv} from "./kv";
import {recoveryId} from "./comfy-recovery";
export type RecoveryReference={job:string;at:number;filename:string;subfolder:string;kind:"image"|"video"|"audio";preview:null};
function clean(raw:unknown):RecoveryReference|null{
 if(!raw||typeof raw!=="object")return null;const r=raw as Record<string,unknown>;
 if(typeof r.job!=="string"||!/^[-\w]{1,128}$/.test(r.job)||typeof r.filename!=="string"||!/^[-\w.]{1,200}$/.test(r.filename)||typeof r.subfolder!=="string"||!/^[-\w/]{0,100}$/.test(r.subfolder)||r.subfolder.includes("..")||!['image','video','audio'].includes(String(r.kind)))return null;
 return {job:r.job,filename:r.filename,subfolder:r.subfolder,kind:r.kind as RecoveryReference['kind'],at:typeof r.at==='number'&&Number.isFinite(r.at)?r.at:0,preview:null};
}
/** Owner-scoped browser durability; never persist signed previews or provider credentials. */
export function recoveryReferences(kv:Kv,owner:string){
 const key=`comfy-recovery/v1/${encodeURIComponent(owner)}`;
 const read=async()=>{const raw=await kv.get<unknown>(key);return Array.isArray(raw)?raw.map(clean).filter((r):r is RecoveryReference=>Boolean(r)):[];};
 return {read,remember:async(items:unknown[])=>{const map=new Map((await read()).map(r=>[recoveryId(r),r]));for(const raw of items){const item=clean(raw);if(item)map.set(recoveryId(item),item);}const held=[...map.values()].sort((a,b)=>b.at-a.at).slice(0,500);await kv.set(key,held);return held;}};
}
