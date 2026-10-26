"use client";
import{useState}from"react";
import type{Project,Shot}from"../../../../story/model";
import{acceptsStartFrame,continuityStale,previousClip}from"../../../../story/continuity";
import{clipSeconds}from"../../../../story/cut";
import{terminalFrame}from"../../../cut-actions";
export function ContinuityPanel({project,shot,onShot}:{project:Project;shot:Shot;onShot:(id:string,f:(s:Shot)=>Shot)=>void}){
 const[busy,setBusy]=useState(false);const[error,setError]=useState("");let source:Shot|undefined;let why="";try{source=previousClip(project,shot.id);}catch(e){why=(e as Error).message;}if(!acceptsStartFrame(shot))why="Choose a video model that accepts a starting image.";
 return <section aria-label="Starting-frame continuity"><p>Use the previous selected clip’s actual last frame. This prepares a starting image only; it does not generate a clip or change your selected take.</p>{shot.startsFrom&&<p role="status">{continuityStale(project,shot)?"Previous clip changed — update this dependency before generating.":"Starting frame saved from the previous clip."}</p>}
 <button className="pill" disabled={busy||!!why} title={why||undefined} onClick={async()=>{if(!source?.render)return;setBusy(true);setError("");try{const result=await terminalFrame(source.render.url,source.trimIn??0,clipSeconds(source));if(!result.ok){setError(result.reason);return;}const d={shotId:source.id,sourceUrl:source.render.url,sourceAt:source.render.at,from:source.trimIn??0,seconds:clipSeconds(source),frameUrl:result.url};onShot(shot.id,s=>({...s,startsFrom:d}));}catch{setError("Could not extract the last frame. Retry when the clip is available.");}finally{setBusy(false);}}}>{busy?"Extracting last frame…":"Start from previous shot’s last frame"}</button>
 {why&&<p className="takes-note">{why}</p>}{error&&<p role="alert">{error}</p>}{shot.startsFrom&&<><img src={shot.startsFrom.frameUrl} alt="Saved starting frame" style={{maxWidth:"100%"}}/><button className="plain" onClick={()=>onShot(shot.id,s=>{const{startsFrom:_,...rest}=s;return rest;})}>Remove starting-frame dependency</button></>}
 </section>;
}
