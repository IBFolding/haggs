import {privateMediaPath} from "./private-media-url";
import {readMedia} from "./media";
/** Provider upload receives authorized bytes, never an app session or private app URL. */
export async function privateProviderInputs(urls:string[],read:typeof readMedia=readMedia):Promise<string[]>{
 const result:string[]=[];
 for(const url of urls){if(!privateMediaPath(url)){result.push(url);continue;}const media=await read(url);if(!/^(image\/(png|jpeg|webp)|video\/(mp4|webm|quicktime))$/.test(media.mime)||!media.bytes.length||media.bytes.length>100*1024*1024)throw Error("This private provider input must be a supported image/video under 100 MB.");result.push(`data:${media.mime};base64,${Buffer.from(media.bytes).toString('base64')}`);}
 return result;
}
