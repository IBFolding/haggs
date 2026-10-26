"use client";
import {useState} from "react";
import type { Shot } from "../../../../story/model";
import {applyReviewFix} from "../../../../story/review";
export function ReviewPanel({shots,selectedId,time,onShot,onSelect}:{shots:Shot[];selectedId:string|null;time:number;onShot:(id:string,change:(s:Shot)=>Shot)=>void;onSelect:(id:string)=>void}) {
 const [text,setText]=useState("");const [targetId,setTargetId]=useState<string|null>(null);const noteShotId=targetId??selectedId;const noteTime=targetId&&targetId!==selectedId?0:time;
 return <section aria-label="Review notes"><p>Play the full cut, pause at a problem, and select its shot. Notes follow shot IDs when the cut changes. Unrendered shots remain listed below.</p>
 <label>Note at {noteTime.toFixed(1)}s into {shots.find(s=>s.id===noteShotId)?.heading||"selected shot"}<textarea value={text} onChange={e=>setText(e.target.value)} /></label>
 <button className="pill" disabled={!noteShotId||!text.trim()} onClick={()=>{if(!noteShotId)return;onShot(noteShotId,s=>({...s,review:[...(s.review??[]),{id:crypto.randomUUID(),shotId:s.id,at:noteTime,text:text.trim(),fix:text.trim(),status:"open"}]}));setText("");}}>Flag selected shot</button>
 <p className="takes-note">Review never runs a paid job. Approve and apply a fix to update only that shot’s instructions. Its current media and takes stay intact; regeneration is a separate action.</p>
 {shots.map((s,i)=><div key={s.id} className="review-shot"><button className="plain" onClick={()=>{setTargetId(s.id);onSelect(s.id);}}>{i+1}. {s.heading||"Untitled shot"}{!s.render?" · no selected media":""}</button>{(s.review??[]).map(n=><fieldset key={n.id}><legend>{n.at.toFixed(1)}s · {n.status}</legend><p>{n.text}</p><label>Fix instructions<textarea value={n.fix} disabled={n.status==="applied"} onChange={e=>onShot(s.id,x=>({...x,review:(x.review ?? []).map(v=>v.id===n.id?{...v,fix:e.target.value,status:"open"}:v)}))}/></label><button className="plain" disabled={n.status!=="open"||!n.fix.trim()} onClick={()=>onShot(s.id,x=>({...x,review:(x.review ?? []).map(v=>v.id===n.id?{...v,status:"approved"}:v)}))}>Approve fix</button><button className="pill" disabled={n.status!=="approved"} onClick={()=>onShot(s.id,x=>applyReviewFix(x,n.id))}>Apply fix instructions</button></fieldset>)}</div>)}
 </section>;
}
