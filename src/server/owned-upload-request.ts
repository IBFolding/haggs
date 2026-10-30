import {uploadOwnedInput,type Journal} from './owned-input-upload';
import type {ComfyAsset} from '../providers/comfy-managed';
import type {probeOwnedInput} from './owned-comfy-input';
type Deps={authenticate(request:Request):Promise<string|null>;journal:Journal;upload(bytes:Uint8Array,mime:string):Promise<ComfyAsset>;probe:typeof probeOwnedInput};
const reply=(data:object,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
/** Injected core; deployment and API key are chosen and validated by the server route. */
export async function ownedUploadRequest(request:Request,deployment:string,deps:Deps):Promise<Response>{
 const user=await deps.authenticate(request);if(!user)return reply({error:'Sign in first.'},401);
 const declared=Number(request.headers.get('content-length')??0);if(!Number.isSafeInteger(declared)||declared<0||declared>10_100_000)return reply({error:'File is too large.'},413);
 let form:FormData;try{
  const reader=request.body?.getReader();if(!reader)return reply({error:'Invalid upload.'},400);const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>10_100_000){await reader.cancel();return reply({error:'File is too large.'},413);}chunks.push(value);}}finally{reader.releaseLock();}
  form=await new Request('http://local.invalid',{method:'POST',headers:{'content-type':request.headers.get('content-type')??''},body:Buffer.concat(chunks)}).formData();
 }catch{return reply({error:'Invalid upload.'},400);}
 const ref=form.get('reference'),field=form.get('field'),file=form.get('file');
 if(typeof ref!=='string'||typeof field!=='string'||!(file instanceof File)||file.size>10_000_000)return reply({error:'Invalid upload.'},400);
 const mime=file.type;
 try{await uploadOwnedInput(user,ref,field,mime,new Uint8Array(await file.arrayBuffer()),{deployment,journal:deps.journal,probe:deps.probe,upload:deps.upload});return reply({ok:true},200);}
 catch{return reply({error:'Upload failed or its outcome is uncertain. Check before trying again.'},503);}
}
