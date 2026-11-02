import { privateMediaPath } from "../server/private-media-url";
/** Package only an owner's same-origin private raster; keep atlas bytes unchanged. */
export async function privatePicture(url:string,fetcher:typeof fetch=fetch):Promise<string>{
 if(!privateMediaPath(url))return url;
 const response=await fetcher(url,{credentials:"same-origin",redirect:"error",cache:"no-store"});
 if(!response.ok||!response.body)throw Error("Sign in to open this private game picture.");
 const type=(response.headers.get("content-type")??"").split(";")[0]!;
 if(!["image/png","image/jpeg","image/webp"].includes(type))throw Error("Use a PNG, JPEG or WebP game picture.");
 const max=16*1024*1024,parts:Uint8Array[]=[];let size=0;const reader=response.body.getReader();
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max)throw Error("Keep private game pictures under 16 MB.");parts.push(part.value);}}finally{await reader.cancel();}
 let binary="";for(const part of parts)for(let i=0;i<part.length;i+=8192)binary+=String.fromCharCode(...part.subarray(i,i+8192));
 return `data:${type};base64,${btoa(binary)}`;
}
/** Caller invokes this only during explicit export; errors abort rather than export broken private links. */
export async function packagePrivatePictures(pictures:Record<string,string>,fetcher:typeof fetch=fetch):Promise<Record<string,string>>{
 const entries=[];for(const [id,url] of Object.entries(pictures))entries.push([id,await privatePicture(url,fetcher)]);
 return Object.fromEntries(entries);
}
