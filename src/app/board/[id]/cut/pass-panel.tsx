"use client";
import{useEffect,useState}from"react";
import Link from"next/link";
import{MODELS,getModelCard}from"../../../../catalog/models";
import{defaultSettings,coerceSettings}from"../../../../catalog/settings";
import{promptFor}from"../../../../story/assemble";
import{needsApproval}from"../../../../story/grey";
import{continuityStale}from"../../../../story/continuity";
import{takesOf}from"../../../../story/takes";
import type{Project,Shot}from"../../../../story/model";
import{estimateGeneration,run}from"../../../actions";
import{passKey,runGenerationPass,saveGenerationPass,type PassRequest}from"../../../../story/generation-pass";
import{creditsText}from"../../../../story/price-text";
export function PassPanel({project,shot,onShot}:{project:Project;shot:Shot;onShot:(id:string,f:(s:Shot)=>Shot)=>void}){
 const[stage,setStage]=useState<"draft"|"final">("draft");const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");const[quote,setQuote]=useState<{key:string;usd:number|null;basis:string}|null>(null);
 const models=MODELS.filter(m=>m.capability==="text-to-video"||m.capability==="image-to-video");const fallback=models.find(m=>m.id===shot.model.id)??models[0]!;
 const config=shot.generationPasses?.[stage]??{id:fallback.id,settings:defaultSettings(fallback.settings)};const card=getModelCard(config.id);const settings=coerceSettings(card.settings,config.settings);
 const source=shot.startsFrom?.frameUrl??shot.generationPasses?.sourceImage??(shot.render?.kind==="image"?shot.render.url:undefined);
 const images=[...(source?[source]:[]),...(shot.refs??[])].slice(0,card.inputImages);const prompt=promptFor(project,project.shots.findIndex(s=>s.id===shot.id));const request:PassRequest={stage,model:{id:config.id,settings},prompt,images,...(source?{source}:{}),modelName:card.name,inputImages:card.inputImages};const fingerprint=passKey(request);
 const locked=needsApproval(shot);const stale=continuityStale(project,shot);const unsupported=!!source&&card.inputImages===0;
 const change=(id:string,next:Record<string,string|number|boolean>)=>onShot(shot.id,s=>({...s,generationPasses:{...s.generationPasses,[stage]:{id,settings:next}}}));
 useEffect(()=>{setQuote(null);},[fingerprint]);
 return <section aria-label="Generation passes"><p>Draft and final are separate, optional runs. Choose the model and settings for each. A draft is not guaranteed cheaper; draft + final + upscale can cost more than one final.</p><div role="group" aria-label="Pass"><button className="pill" aria-pressed={stage==="draft"} onClick={()=>setStage("draft")}>Draft</button><button className="pill" aria-pressed={stage==="final"} onClick={()=>setStage("final")}>Final</button></div>
 <label>Pass model<select disabled={busy} value={config.id} onChange={e=>{const c=getModelCard(e.target.value);change(c.id,defaultSettings(c.settings));}}>{models.map(m=><option key={m.id} value={m.id}>{m.name}{m.inputImages===0?" · text only":""}</option>)}</select></label>
 {Object.entries(card.settings).map(([key,f])=><label key={key}>{f.label}{f.type==="enum"?<select disabled={busy} value={String(settings[key])} onChange={e=>change(config.id,{...settings,[key]:e.target.value})}>{f.values.map(v=><option key={v}>{v}</option>)}</select>:f.type==="range"?<input disabled={busy} type="number" min={f.min} max={f.max} step={f.step??1} value={Number(settings[key])} onChange={e=>change(config.id,{...settings,[key]:Number(e.target.value)})}/>:<input disabled={busy} type="checkbox" checked={settings[key]===true} onChange={e=>change(config.id,{...settings,[key]:e.target.checked})}/>}</label>)}
 {unsupported&&<p role="status">This text-only model cannot use your starting image. Choose an image-capable video model; the image will not be silently discarded.</p>}{stale&&<p role="status">Update or remove the stale previous-shot dependency first.</p>}
 <button className="pill" disabled={busy||unsupported||stale||!prompt.trim()} onClick={async()=>{setBusy(true);try{const q=await estimateGeneration(config.id,prompt,settings,images,!!source);setQuote({...q,key:fingerprint});}catch{setMessage("Estimate unavailable. No job was submitted.");}finally{setBusy(false);}}}>Estimate {stage}</button>
 {quote&&<p role="status">{quote.usd===null?"Price unavailable":`Estimated ${creditsText(quote.usd)}`} · {quote.basis}</p>}
 {locked&&<p role="status">This take is locked. Approve it under Reshoot before generating an alternative.</p>}
 <button className="fire" disabled={locked||busy||unsupported||stale||quote?.key!==fingerprint||quote?.usd==null} onClick={async()=>{if(locked||quote?.key!==fingerprint||quote.usd===null)return;setBusy(true);setMessage("");try{const result=await runGenerationPass(project,shot,request,quote,run);if(!result.ok){setMessage(result.reason);return;}const made=result.shots[0];if(!made){setMessage("No media returned. Existing takes are unchanged.");return;}onShot(shot.id,s=>saveGenerationPass(s,request,result));setMessage(`${stage} saved as a new take. No further pass was started.`);setQuote(null);}catch{setMessage("The request did not return successfully. Check Activity/provider status before retrying; no automatic retry was sent.");}finally{setBusy(false);}}}>{busy?"Working…":`Generate ${stage}`}{quote?.usd!=null?` · about ${creditsText(quote.usd)}`:""}</button>
 {message&&<p role="status">{message}</p>}<p>{takesOf(shot).length} existing takes remain available under Shot.</p>
 <h3>Optional upscale</h3><p>Upscaling is a separate workflow with its own input and price. It does not run automatically or replace a selected take. Model-specific regeneration is not a universal video upscaler.</p><Link className="pill" href="/workflows/build?quick=upscale-video">Open video upscale workflow</Link>
 </section>;
}
