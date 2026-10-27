"use client";
import {useEffect,useRef,useState} from 'react';
import type {Trajectory,PreparedControl} from '../../../../story/trajectory';
import {controlSpec} from '../../../../story/trajectory-control';
import {checkCameraBackend} from '../../../camera-actions';
export function CameraControlPanel({value,vertical,onChange}:{value:Trajectory;vertical:boolean;onChange:(v:Trajectory)=>void}){
 const [busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[message,setMessage]=useState('');const abort=useRef<AbortController|null>(null);
 const {control,...input}=value;const fingerprint=JSON.stringify({input,vertical});const latest=useRef(fingerprint);latest.current=fingerprint;
 const prompt=value.controlPrompt??'A cinematic scene matching the reference image, following the perspective and movement in the depth control.';
 const spec=controlSpec(value,vertical),stale=!!control&&control.fingerprint!==fingerprint;
 useEffect(()=>()=>abort.current?.abort(),[]);
 async function prepare(){const controller=new AbortController();abort.current=controller;setBusy(true);setMessage('');const snapshot=fingerprint;
 try{const res=await fetch('/api/grey/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({trajectory:input,vertical,prompt}),signal:controller.signal});const data=await res.json() as PreparedControl&{ok:boolean;reason?:string};if(!data.ok)throw Error(data.reason??'Preparation failed.');if(latest.current!==snapshot){setMessage('Path changed during preparation. Existing inputs are preserved; prepare again for this path.');return;}onChange({...value,control:{...data,fingerprint:snapshot}});setMessage('Depth control saved locally. No AI job or upload was submitted.');}catch(e){setMessage(controller.signal.aborted?'Preparation cancelled. Your previous control is unchanged.':e instanceof Error?e.message:'Preparation failed.');}finally{setBusy(false);}}
 return <section aria-label="Camera path conditioning"><h4>Camera path → Comfy depth control</h4><p>Real perspective depth of these proxy boxes and ground. This does not reconstruct your reference photo or guarantee the generated camera route. VACE uses the reference for appearance; it is not a first/last-frame lock.</p>
 <label>Scene description<textarea value={prompt} maxLength={4000} onChange={e=>onChange({...value,controlPrompt:e.target.value})}/></label>
 <p>{spec.width} × {spec.height} · {spec.frames} frames at {spec.fps} fps · {spec.seconds.toFixed(3)}s output. Includes both route endpoints; the last frame is held for one frame interval.</p>
 <button className="pill" disabled={busy||value.seconds>6||!prompt.trim()} onClick={()=>void prepare()}>{busy?'Preparing depth…':'Prepare depth control · no generation'}</button>{value.seconds>6&&<p>Use a path up to six seconds for this integration.</p>}{busy&&<button className="plain" onClick={()=>abort.current?.abort()}>Cancel preparation</button>}
 <button className="pill" disabled={checking||busy} onClick={async()=>{setChecking(true);try{const r=await checkCameraBackend(value,vertical,prompt);setMessage(r.reason);}finally{setChecking(false);}}}>{checking?'Checking…':'Check Comfy compatibility · no generation'}</button>
 {control&&<><p role="status">{stale?'Path or description changed — prepare a new control before using this workflow.':'Prepared control matches this path.'}</p><video controls src={control.video} style={{width:'100%'}} aria-label="Prepared depth control"/>{!stale&&<p><a href={control.video} download>Download depth video</a> · <a href={control.workflow} download>Download VACE workflow</a> · <a href={control.poses} download>Download camera poses</a></p>}</>}
 <p>Generation is disabled here: no verified per-run quote or generated test yet. Import the prepared workflow into Comfy only after reviewing its cost and approving a run. Supply this depth video and your own reference image; originals remain unchanged.</p>
 {message&&<p role="status">{message}</p>}</section>;
}
