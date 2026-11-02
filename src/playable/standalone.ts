import type { CodeSpec } from "./spec";
import {srcdoc} from "./kit";
import {bundleAppMedia} from "../story/media-bundle";
/** User-requested standalone HTML; game scripts remain confined by the existing CSP. */
export async function standaloneGame(spec:CodeSpec,fetcher:typeof fetch=fetch,prepare?: (url:string,sprite:boolean)=>Promise<string>):Promise<string>{
 if(spec.three)throw Error("Standalone export currently supports 2D code games. 3D games still require their external runtime.");
 const pictures=Object.fromEntries(spec.art.assets.filter(a=>a.url).map(a=>[a.id,a.url!]));
 const packed=await bundleAppMedia(pictures,fetcher);
 if(prepare)for(const asset of spec.art.assets)if(packed[asset.id]&&!asset.atlas)packed[asset.id]=await prepare(packed[asset.id]!,asset.kind==="sprite");
 for(const url of Object.values(packed))if(!url.startsWith("data:image/"))throw Error("Every game picture must be embedded or stored in Haggs before standalone export.");
 const page=srcdoc(spec,packed);
 const escaped=page.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Haggs game</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe title="Exported game" sandbox="allow-scripts" allow="autoplay; fullscreen" srcdoc="${escaped}"></iframe></body></html>`;
}
