import type {Cut} from '../story/cut';
import {uploadFile,type Uploaded} from './upload-client';
/** Older saved boards may contain inline stills. Materialize only these images when the user explicitly exports. */
export async function prepareCutMedia(cut:Cut,upload:(file:File)=>Promise<Uploaded>=uploadFile):Promise<Cut>{
 const saved=new Map<string,string>();
 const clips=[];
 for(const clip of cut.clips){
  if(!clip.url.startsWith('data:')){clips.push(clip);continue;}
  if(clip.kind!=='image')throw Error('This embedded media cannot be exported. Upload the original file to its shot.');
  let url=saved.get(clip.url);
  if(!url){
   const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(clip.url);
   if(!match||match[2]!.length>28*1024*1024)throw Error('This embedded picture cannot be exported. Upload a PNG, JPEG or WebP up to 20 MB.');
   const bytes=Uint8Array.from(atob(match[2]!),c=>c.charCodeAt(0));
   if(!bytes.length||bytes.length>20*1024*1024)throw Error('This embedded picture is empty or too large. Upload the original image again.');
   const ext=match[1]==='image/jpeg'?'jpg':match[1]!.split('/')[1];
   const result=await upload(new File([bytes],`saved-still.${ext}`,{type:match[1]!}));
   if(!result.ok)throw Error(result.reason);
   url=result.url;saved.set(clip.url,url);
  }
  clips.push({...clip,url});
 }
 return {...cut,clips};
}
