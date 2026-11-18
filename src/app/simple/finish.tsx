'use client';
import {StoryPopExport} from '../storypop-export';
import {useMemo,useState} from 'react';
import type {Project} from '../../story/model';
import {view} from '../../story/boards';
import {buildCut} from '../../story/cut';
import {reviewFilm} from '../../simple/review';
import {hashPrompt} from '../../story/assemble';
export type SimpleExport={url:string;stamp:string};
export function SimpleFinish({project,board,saved,onSaved}:{project:Project;board:string;saved?:SimpleExport|undefined;onSaved:(result:SimpleExport)=>Promise<void>}){
 const cut=useMemo(()=>buildCut(view(project,board)),[project,board]),stamp=hashPrompt(JSON.stringify(cut)),[busy,setBusy]=useState(false),[problem,setProblem]=useState(''),[reviewed,setReviewed]=useState('');
 const findings=useMemo(()=>reviewFilm(project,board),[project,board]),errors=findings.some(f=>f.severity==='error'),warnings=findings.some(f=>f.severity==='review');
 return <section className="simple-finish" aria-label="Finished film"><h3>Your finished cut</h3><p>Export joins the selected takes and mixes voice, effects and music. It does not generate new media. Hosted export still requires your account’s storage allowance.</p>
 <section aria-label="Export preflight"><h4>Before you export</h4><p>These are checks of the project data, not an AI quality score. Listen and watch the full cut for performance, identity and image artifacts.</p>{findings.length?<ul>{findings.map((f,i)=><li key={i} data-severity={f.severity}>{f.message}</li>)}</ul>:<p>No blocking problems found in the project data.</p>}{warnings&&<label><input type="checkbox" aria-label="Reviewed export warnings" checked={reviewed===stamp} onChange={e=>setReviewed(e.target.checked?stamp:'')}/> I checked the remaining review items.</label>}</section>
 <button className="fire" disabled={busy||errors||warnings&&reviewed!==stamp||!cut.clips.length||cut.skipped.length>0} onClick={async()=>{setBusy(true);setProblem('');try{const response=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:project.name,cut,burn:false})}),result=await response.json();if(!response.ok||!result.ok||typeof result.url!=='string')throw Error(result.reason??'The export did not finish.');await onSaved({url:result.url,stamp});}catch(e){setProblem(e instanceof Error?e.message:'Export interrupted. Check Activity before exporting again.');}finally{setBusy(false);}}}>{busy?'Exporting the film…':'Export MP4'}</button>
 {cut.skipped.length>0&&<p role="alert">Some shots have no selected media. Resolve them in Pro before exporting.</p>}
 {saved&&<><p>{saved.stamp===stamp?'Export ready.':'Previous export — this cut has changed since it was made.'}</p><video src={saved.url} controls preload="metadata"/><a className="pill" href={saved.url} download>Download your film</a>{saved.stamp===stamp&&<StoryPopExport url={saved.url} title={project.name}/>}</>}{problem&&<p role="alert" className="library-error">{problem}</p>}</section>;
}
