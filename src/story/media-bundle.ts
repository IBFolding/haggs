import { privateMediaPath } from "../server/private-media-url";
const TYPES=new Set(["image/png","image/jpeg","image/webp","video/mp4","video/webm","video/quicktime","audio/mpeg","audio/mp4","audio/aac","audio/flac","audio/wav","audio/x-wav"]);
const MAX=64*1024*1024,TOTAL=128*1024*1024;
function appMedia(url:string){
 if(privateMediaPath(url))return true;
 if(/^\/api\/local\/[a-zA-Z0-9_./% -]+$/.test(url)){try{const parts=url.slice("/api/local/".length).split("/").map(decodeURIComponent);if(parts.every(p=>p&&p!=="."&&p!==".."&&!p.includes("/")&&!p.includes("\\")))return true;}catch{}}
 try{const u=new URL(url);return u.protocol==="https:"&&/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}
}
async function walk(value:unknown,resolve:(s:string)=>Promise<string>):Promise<unknown>{
 if(typeof value==="string"){
  if(value.startsWith("{")||value.startsWith("[")){let parsed;try{parsed=JSON.parse(value);}catch{return resolve(value);}const out=await walk(parsed,resolve);return JSON.stringify(out)===JSON.stringify(parsed)?value:JSON.stringify(out);}
  return resolve(value);
 }
 if(Array.isArray(value)){const out=[];for(const item of value)out.push(await walk(item,resolve));return out;}
 if(value&&typeof value==="object"){const out:[string,unknown][]=[];for(const [key,item] of Object.entries(value))out.push([key,await walk(item,resolve)]);return Object.fromEntries(out);}
 return value;
}
function encode(bytes:Uint8Array){let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
/** Explicit download only: no publication, provider generation or credential forwarding to remote stores. */
export async function bundleAppMedia<T>(value:T,fetcher:typeof fetch=fetch):Promise<T>{
 const cache=new Map<string,string>();let total=0;
 return await walk(value,async url=>{
  if(!appMedia(url))return url;
  const prior=cache.get(url);if(prior)return prior;
  const response=await fetcher(url,{credentials:url.startsWith("/")?"same-origin":"omit",redirect:"error",cache:"no-store"});
  if(!response.ok||!response.body)throw Error("A media file could not be bundled. Sign in and try again; no export was created.");
  const type=(response.headers.get("content-type")??"").split(";")[0]!;
  if(!TYPES.has(type))throw Error("This bundle supports raster images, audio and video. Export other asset types separately.");
  const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;total+=part.value.length;if(size>MAX||total>TOTAL)throw Error("Bundle limit: 64 MB per file and 128 MB total. Export large media separately.");parts.push(part.value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const data=`data:${type};base64,${encode(bytes)}`;cache.set(url,data);return data;
 }) as T;
}
export function hasEmbeddedMedia(value:unknown):boolean{return JSON.stringify(value).includes("data:");}
/** Import stays atomic at project level. Failed uploads leave the existing project untouched. */
export async function restoreBundledMedia<T>(value:T,upload:(file:File)=>Promise<{ok:true;url:string}|{ok:false;reason:string}>):Promise<T>{
 const cache=new Map<string,string>();let total=0;
 return await walk(value,async uri=>{
  const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(uri);if(!match){if(uri.startsWith("data:"))throw Error("Invalid embedded media.");return uri;}
  if(!TYPES.has(match[1]!))throw Error("Unsupported embedded media type.");
  const prior=cache.get(uri);if(prior)return prior;
  if(match[2]!.length>Math.ceil(MAX/3)*4)throw Error("Embedded file exceeds the bundle limit.");
  const binary=atob(match[2]!);if(btoa(binary)!==match[2])throw Error("Invalid embedded media.");
  total+=binary.length;if(total>TOTAL)throw Error("Embedded media exceeds the total bundle limit.");
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const ext=({"image/png":"png","image/jpeg":"jpg","image/webp":"webp","video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov","audio/mpeg":"mp3","audio/mp4":"m4a","audio/aac":"aac","audio/flac":"flac","audio/wav":"wav","audio/x-wav":"wav"} as Record<string,string>)[match[1]!]!;
  const result=await upload(new File([bytes],`bundle-${cache.size}.${ext}`,{type:match[1]!}));
  if(!result.ok)throw Error(`Import stopped: ${result.reason} Some files may already be uploaded; check Account Files before retrying. The project was not replaced.`);
  cache.set(uri,result.url);return result.url;
 }) as T;
}
/** Keep large attachments outside sheet/project schemas, which deliberately cap text size. */
export async function createMediaEnvelope<T extends object>(value:T,fetcher:typeof fetch=fetch):Promise<T & {mediaBundle:{format:string;files:Record<string,string>}}>{
 const packed=await bundleAppMedia(value,fetcher),files:Record<string,string>={},ids=new Map<string,string>();
 const replaced=await walk(packed,async uri=>{if(!uri.startsWith("data:"))return uri;let id=ids.get(uri);if(!id){id=`haggs-bundle:${ids.size}`;ids.set(uri,id);files[id]=uri;}return id;}) as T;
 return {...replaced,mediaBundle:{format:"haggs.media/1",files}};
}
export async function restoreMediaEnvelope(value:Record<string,unknown>,upload:Parameters<typeof restoreBundledMedia>[1]):Promise<Record<string,unknown>>{
 const manifest=value.mediaBundle as {format?:unknown;files?:unknown}|undefined;
 if(!manifest||manifest.format!=="haggs.media/1"||!manifest.files||typeof manifest.files!=="object"||Array.isArray(manifest.files))throw Error("Invalid media bundle manifest.");
 const files=manifest.files as Record<string,unknown>;
 if(Object.keys(files).length>1000||Object.entries(files).some(([id,data])=>!/^haggs-bundle:[0-9]+$/.test(id)||typeof data!=="string"||!data.startsWith("data:")))throw Error("Invalid media bundle attachments.");
 const restored=await restoreBundledMedia(files,upload),{mediaBundle:_,...content}=value;
 return await walk(content,async reference=>{if(!reference.startsWith("haggs-bundle:"))return reference;const url=restored[reference];if(typeof url!=="string")throw Error("A bundle attachment is missing.");return url;}) as Record<string,unknown>;
}
