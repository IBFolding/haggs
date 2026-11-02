import type {RunStore} from "./runs";

/** Server-confirmed media kind also repairs entries recorded by older clients. */
export async function recordHostedRecovery(runs: RunStore, item: {id:string;filename:string|null;provider_job:string|null}, result: {url:string;kind:unknown}) {
 if (result.kind !== "image" && result.kind !== "video" && result.kind !== "audio") throw Error("Recovery metadata is missing. Recheck the journal before adding this output.");
 const marker=`hosted:${item.id}`, existing=(await runs.list()).find(run=>run.comfyJob===marker);
 if(existing) {
  if(existing.kind!==result.kind || existing.url!==result.url) await runs.adopt([{...existing,kind:result.kind,url:result.url,...(existing.remote?{remote:result.url}:{}),rev:Math.max(Date.now(),(existing.rev??0)+1)}]);
 } else await runs.record({modelId:"hosted-recovered",modelName:"Recovered output",prompt:`Recovered: ${item.filename??item.provider_job??item.id}`,settings:{},url:result.url,kind:result.kind,usd:null,comfyJob:marker});
}
