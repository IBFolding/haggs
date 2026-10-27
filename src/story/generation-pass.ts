import type { Project, Shot } from "./model";
import { addTake } from "./takes";
import { hashPrompt } from "./assemble";
import { continuityStale } from "./continuity";
import { needsApproval } from "./grey";

export type PassRequest = { stage: "draft" | "final"; model: Shot["model"]; prompt: string; images: string[]; source?: string; modelName: string; inputImages: number };
export type PassResult = { ok: true; shots: {url:string;kind:"image"|"video"}[]; usd:number|null } | {ok:false;reason:string};
export type PassSender = (model:string,prompt:string,settings:Record<string,unknown>,images:string[],firstFrame:boolean)=>Promise<PassResult>;
export function passKey(request: PassRequest): string { return JSON.stringify(request); }
/** The explicit run boundary is shared by the UI and non-billable contract tests. */
export async function runGenerationPass(project:Project, shot:Shot, request:PassRequest, quote:{key:string;usd:number|null}, send:PassSender):Promise<PassResult> {
 if(needsApproval(shot))return {ok:false,reason:"Approve the selected take under Reshoot first."};
 if(continuityStale(project,shot))return {ok:false,reason:"Update the previous-shot dependency first."};
 if(request.source && request.inputImages===0)return {ok:false,reason:"This model cannot use the starting image."};
 if(quote.key!==passKey(request)||quote.usd===null||!Number.isFinite(quote.usd)||quote.usd<0)return {ok:false,reason:"Estimate this exact pass before generating."};
 return send(request.model.id,request.prompt,request.model.settings,request.images,!!request.source);
}
/** Only the requested stable shot is replaced; all other shots and old takes survive. */
export function saveGenerationPass(shot:Shot, request:PassRequest, result:PassResult, at=Date.now()):Shot {
 if(!result.ok||!result.shots[0])return shot;
 const made=result.shots[0];
 return {...addTake(shot,{url:made.url,kind:made.kind,usd:result.usd,promptHash:hashPrompt(request.prompt),at},`${request.stage==="draft"?"Draft":"Final"} · ${request.modelName}`),generationPasses:{...shot.generationPasses,[request.stage]:request.model,...(request.source?{sourceImage:request.source}:{})}};
}

/** The selected still overrides the source retained from an earlier video pass. */
export function generationSource(shot:Shot):string|undefined {
 return shot.startsFrom?.frameUrl ?? (shot.render?.kind === "image" ? shot.render.url : shot.generationPasses?.sourceImage);
}
