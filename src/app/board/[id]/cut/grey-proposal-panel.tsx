"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { quoteGreyProposal, generateGreyProposal,greyProposalAvailability } from "../../../grey-proposal-actions";
import type { ProposalQuote } from "../../../../server/grey-proposal-gateway";
import { proposalContext,type ProposalContext } from "../../../../story/grey-proposal-context";
import {prepareReferencePreview} from "../../../../story/grey-reference-preview";
import {MAX_REFERENCE_IMAGES} from "../../../../writer/image-input";
import type { GreyFrame } from "../../../../story/grey";
import type { GreyScene } from "../../../../story/grey-scene";
import type { SceneProposal } from "../../../../story/grey-space";
import { ALL_PROPOSAL_PARTS, type ProposalSelection, manualProposalRequest, readSceneProposal } from "../../../../story/grey-proposal";

import { previewSceneProposal } from "../../../../story/grey-proposal-preview";

export function GreyProposalPanel({ grey, scene, vertical, onApply }: { vertical: boolean; grey: GreyFrame; scene: GreyScene; onApply: (grey: GreyFrame, scene: GreyScene) => void }) {
  const [request, setRequest] = useState("");
  const [reply, setReply] = useState("");
  const [proposal, setProposal] = useState<SceneProposal | null>(null);
  const [camera, setCamera] = useState(false);
  const [selection,setSelection]=useState<ProposalSelection>(ALL_PROPOSAL_PARTS);
  const [reviewedStamp,setReviewedStamp]=useState("");
  const [previewTime,setPreviewTime]=useState(0);
  const sceneStamp=JSON.stringify({grey,scene});
  const latestScene=useRef(sceneStamp);latestScene.current=sceneStamp;
  const stale=reviewedStamp!==sceneStamp;
  const preview=useMemo(()=>{if(!proposal||stale)return null;try{return {ok:true as const,...previewSceneProposal(grey,scene,proposal,camera,selection,vertical,previewTime)};}catch(e){return {ok:false as const,reason:(e as Error).message};}},[grey,scene,proposal,camera,selection,vertical,previewTime,stale]);
  function review(next:SceneProposal){setProposal(next);setCamera(false);setSelection(ALL_PROPOSAL_PARTS);setPreviewTime(0);setReviewedStamp(sceneStamp);}
  function chooseItem(key:"personIndices"|"propIndices",index:number,include:boolean,total:number){
    setSelection(current=>{const chosen=current[key]??Array.from({length:total},(_,i)=>i);return {...current,[key]:include?[...new Set([...chosen,index])]:chosen.filter(i=>i!==index)};});
  }
  const sameName=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
  const [status, setStatus] = useState("");
  const [quote,setQuote]=useState<ProposalQuote|null>(null);
  const [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [visionEnabled,setVisionEnabled]=useState(false);
  const [imageIds,setImageIds]=useState<string[]>([]);
  const prepared=useRef<{stamp:string;context:ProposalContext}|null>(null);
  useEffect(()=>{let active=true;void greyProposalAvailability().then(result=>{if(active)setVisionEnabled(result.visionEnabled);}).catch(()=>{});return()=>{active=false;};},[]);
  const pending=useRef(false),epoch=useRef(0);
  const contextStamp=JSON.stringify({direction:scene.direction,references:scene.references,grey,props:scene.props,space:scene.space,imageIds});
  const latest=useRef(contextStamp);latest.current=contextStamp;
  useEffect(()=>{setQuote(null);setConsent(false);prepared.current=null;},[contextStamp]);
  useEffect(()=>()=>{epoch.current++;},[]);
  const context=()=>proposalContext({description:(scene.direction??"").trim()||(imageIds.length?"Propose a cinematic scene using the selected reference images.":""),references:scene.references??[],grey,scene});
  async function automatic(send:boolean) {
    if(pending.current)return;
    pending.current=true;setBusy(true);setStatus("");
    const start=contextStamp,run=++epoch.current;
    try {
      if(send) {
        if(!quote||!consent||prepared.current?.stamp!==start)return;
        setProposal(null);
        const result=await generateGreyProposal(prepared.current.context,quote.id,true);
        if(run!==epoch.current)return;
        setQuote(null);setConsent(false);prepared.current=null;
        if(!result.ok){setStatus(result.reason);return;}
        if(latest.current!==start){setStatus("The scene changed while the proposal was prepared. Request a new proposal for the current scene.");return;}
        review(result.proposal);setStatus("Proposal ready for review. Nothing has been applied.");
      } else {
        const request=context();
        if(imageIds.length){
          if(!visionEnabled){setStatus("Reference image analysis is not enabled.");return;}
          const refs=(scene.references??[]).filter(r=>imageIds.includes(r.id));
          if(refs.length!==imageIds.length){setStatus("A selected reference changed. Select it again before quoting.");return;}
          try{const images=[];for(const ref of refs)images.push(await prepareReferencePreview(ref));request.images=images;}
          catch{setStatus("A selected reference could not be prepared. Upload a smaller PNG or JPEG copy. Nothing was sent to the provider.");return;}
        }
        if(run!==epoch.current||latest.current!==start)return;
        const result=await quoteGreyProposal(request);
        if(run!==epoch.current||latest.current!==start)return;
        setQuote(result.ok?result:null);setConsent(false);
        prepared.current=result.ok?{stamp:start,context:request}:null;
        if(!result.ok)setStatus(result.reason);
      }
    } catch {if(run===epoch.current)setStatus("The request could not finish. Check provider activity before trying again if a model request was sent.");}
    finally {pending.current=false;if(run===epoch.current)setBusy(false);}
  }
  return <details className="gr-proposal">
    <summary>Plan the scene with AI</summary>
    <p>Ask the configured Claude provider for a scene proposal, then review it before applying. Scene text and reference names are included. Image previews are included only when selected below and image analysis is enabled.</p>
    <div aria-label="Reference image analysis">
      <p>{visionEnabled?"Choose up to two reference images for visual analysis. Selected previews are sent to Haggs to prepare the quote, then to Claude only after you approve the cost. Original files stay unchanged.":"Reference image analysis is not enabled. Text-only proposals and manual handoff remain available."}</p>
      {visionEnabled&&(scene.references??[]).map(ref=><label className="gr-reference-choice" key={ref.id}><input type="checkbox" aria-label={`Analyze reference ${ref.name}`} disabled={!visionEnabled||busy||(!imageIds.includes(ref.id)&&imageIds.length>=MAX_REFERENCE_IMAGES)} checked={imageIds.includes(ref.id)} onChange={e=>setImageIds(ids=>e.target.checked?[...ids,ref.id]:ids.filter(id=>id!==ref.id))}/><span>{ref.name}</span></label>)}
    </div>
    <button className="pill" disabled={busy||(!(scene.direction??"").trim()&&!imageIds.length)} onClick={()=>void automatic(false)}>{busy?"Working…":"Get AI proposal quote"}</button>
    {quote&&<div aria-label="AI proposal cost"><p>{quote.model}: estimated ${quote.estimateUsd.toFixed(4)} on your existing provider account. Actual billing may differ. Quote is valid for five minutes from quoting. This creates a proposal only, not pictures or video. {quote.imageCount?`${quote.imageCount} selected image previews are included; the estimate includes a conservative image allowance.`:"No images are included."}</p>{prepared.current?.context.images?.map((image,i)=><figure key={i}><img width={160} alt={`Image to analyze: ${image.name}`} src={`data:${image.mediaType};base64,${image.data}`}/><figcaption>{image.name}</figcaption></figure>)}<label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> Allow one provider request at the displayed estimate{quote.imageCount?" and share the selected image previews":""}</label><button className="pill" disabled={busy||!consent} onClick={()=>void automatic(true)}>Request AI proposal</button></div>}
    <p>Use your AI chat to propose the room, people, props, materials, light and camera. Describe the scene below, prepare a request, then paste the reply here for review. This manual handoff makes no model call from Haggs. Attach reference pictures in your chat if you want image analysis.</p>
    <button className="pill" onClick={() => { try { setRequest(manualProposalRequest({ description:scene.direction ?? "", references:scene.references ?? [], grey, scene }));setStatus(""); } catch(e) { setStatus((e as Error).message); } }}>Prepare AI request</button>
    {request && <label>Request to copy<textarea aria-label="AI scene request" readOnly value={request} onFocus={e=>e.currentTarget.select()} /></label>}
    <label>AI reply<textarea aria-label="AI scene reply" value={reply} maxLength={50000} disabled={busy} onChange={e=>{setReply(e.target.value);setProposal(null);}} /></label>
    <button className="pill" disabled={busy||!reply.trim()} onClick={()=>{try {review(readSceneProposal(reply));setStatus("");}catch(e){setStatus((e as Error).message);}}}>Review proposal</button>
    {proposal && <div className="gr-proposal-review" aria-label="Scene proposal review">
      <b>{proposal.summary}</b>
      <p>Floor: {proposal.room.floor}. Wall: {proposal.room.wall}.</p>
      <p>Proposed people: {proposal.people.map(p=>p.label+(p.facing===undefined?"":` (facing ${p.facing}°)`)).join(", ") || "None"}. Proposed props: {proposal.props.map(p=>p.name+(p.material?` (${p.material})`:"")).join(", ") || "None"}. Existing names are kept in place.</p>
      <p>Proposed camera: {proposal.camera.lens} mm, {proposal.camera.distance} m away, {proposal.camera.height} m high, angle {proposal.camera.angle}°. {proposal.cameraPath?` Camera move: ${proposal.cameraPath.length} keys over 6 seconds.`:" Still camera."} Light: {proposal.light.az}° direction, {proposal.light.el}° elevation.</p>
      <div aria-label="Proposal choices">
        <label><input type="checkbox" checked={selection.people} onChange={e=>setSelection({...selection,people:e.target.checked})}/> Add proposed people</label>
        <div className="gr-proposal-items" role="group" aria-label="Choose proposed people">
          {proposal.people.map((person,i)=>{const exists=grey.subjects.some(s=>sameName(s.label,person.label));return <label key={i}><input type="checkbox" aria-label={`Add proposed person ${person.label}`} disabled={!selection.people||exists} checked={selection.people&&!exists&&(selection.personIndices===undefined||selection.personIndices.includes(i))} onChange={e=>chooseItem("personIndices",i,e.target.checked,proposal.people.length)}/><span>{person.label}{exists?" (already in scene)":""}</span></label>;})}
        </div>
        <label><input type="checkbox" checked={selection.props} onChange={e=>setSelection({...selection,props:e.target.checked})}/> Add proposed props</label>
        <div className="gr-proposal-items" role="group" aria-label="Choose proposed props">
          {proposal.props.map((prop,i)=>{const exists=scene.props?.some(p=>sameName(p.name,prop.name));return <label key={i}><input type="checkbox" aria-label={`Add proposed prop ${prop.name}`} disabled={!selection.props||exists} checked={selection.props&&!exists&&(selection.propIndices===undefined||selection.propIndices.includes(i))} onChange={e=>chooseItem("propIndices",i,e.target.checked,proposal.props.length)}/><span>{prop.name}{exists?" (already in scene)":prop.material?` (${prop.material})`:""}</span></label>;})}
        </div>
        <label><input type="checkbox" checked={selection.room} onChange={e=>setSelection({...selection,room:e.target.checked})}/> Use proposed room materials</label>
      </div>
      <label><input type="checkbox" aria-label="Use proposed camera and key light" checked={camera} onChange={e=>setCamera(e.target.checked)} /> Use proposed camera and key light{grey.camKeys?.length ? (proposal.cameraPath?" (replaces the current camera path with the proposed move)":" (replaces the current camera path with a still camera)") : ""}</label>
      {stale&&<p role="status">The scene changed after review. <button className="pill" onClick={()=>{setReviewedStamp(sceneStamp);setStatus("");}}>Review against current scene</button></p>}
      {preview?.ok&&<>
        <div className="gr-proposal-compare" aria-label="Visual proposal comparison">
          <figure><img alt="Current scene preview" src={`data:image/svg+xml,${encodeURIComponent(preview.before)}`}/><figcaption>Current scene</figcaption></figure>
          <figure><img alt="Proposed scene preview" src={`data:image/svg+xml,${encodeURIComponent(preview.after)}`}/><figcaption>After applying your choices</figcaption></figure>
        </div>
        <p>{preview.peopleAdded} {preview.peopleAdded===1?"person":"people"} and {preview.propsAdded} {preview.propsAdded===1?"prop":"props"} will be added. {camera?(proposal.cameraPath?"The proposed camera move replaces the current path.":"The proposed still camera replaces the current path."):"Your camera path is kept."} This is a local blockout preview; nothing has been applied.</p>
        <label>Preview time<input aria-label="Proposal preview time" type="range" min={0} max={6} step={.1} value={previewTime} onChange={e=>setPreviewTime(Number(e.target.value))}/> {previewTime.toFixed(1)} s</label>
      </>}
      {preview&&!preview.ok&&<p role="status">{preview.reason}</p>}
      <button className="pill on" disabled={busy||stale||!preview?.ok} onClick={()=>{if(latestScene.current!==reviewedStamp||!preview?.ok){setStatus("Review the current scene before applying.");return;}onApply(preview.candidate.grey,preview.candidate.scene);setProposal(null);setStatus("Proposal applied. Fine-tune the scene, then make and approve a first frame.");}}>Apply reviewed proposal</button>
      <button className="plain" onClick={()=>setProposal(null)}>Discard proposal</button>
    </div>}
    {status && <p role="status">{status}</p>}
  </details>;
}
