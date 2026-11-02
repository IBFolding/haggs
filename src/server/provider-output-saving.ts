import { mayFetchForKeeping, keptExtension } from "./keep-url";
import type { Kept } from "../providers/cloud";
export const TEMPORARY_OUTPUT_WARNING = "Private saving is incomplete. This temporary provider link may expire and anyone with the link may open it. Download this result and check recovery before generating again.";
export type SavedShot = { url:string; kind:"image"|"video"; storageWarning?:string };
/** Preserve a paid output on save failure; this never submits or retries generation. */
export async function keepProviderShots(shots:SavedShot[],keep:(bytes:Uint8Array,extension:Kept)=>Promise<string>,fetcher:typeof fetch=fetch):Promise<SavedShot[]>{
 return Promise.all(shots.map(async shot=>{
  if(!mayFetchForKeeping(shot.url))return shot;
  try{
   const got=await fetcher(shot.url,{redirect:"error",signal:AbortSignal.timeout(90_000)});
   if(!got.ok||Number(got.headers.get("content-length")??0)>200_000_000)return {...shot,storageWarning:TEMPORARY_OUTPUT_WARNING};
   const bytes=new Uint8Array(await got.arrayBuffer());
   if(bytes.length>200_000_000)return {...shot,storageWarning:TEMPORARY_OUTPUT_WARNING};
   const {storageWarning:_,...saved}=shot;
   return {...saved,url:await keep(bytes,keptExtension(got.headers.get("content-type")??"",shot.kind))};
  }catch{return {...shot,storageWarning:TEMPORARY_OUTPUT_WARNING};}
 }));
}
