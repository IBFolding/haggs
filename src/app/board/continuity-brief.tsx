"use client";
import {compileShot} from '../../story/compile';
import type {Project} from '../../story/model';

export function ContinuityBrief({project,shotId}:{project:Project;shotId:string}) {
 let brief:ReturnType<typeof compileShot>;
 try {brief=compileShot(project,project.shots.findIndex(s=>s.id===shotId));}
 catch {return <p role="alert">This model cannot be compiled. Choose an available model.</p>;}
 return <details style={{marginBlock:16}}><summary>Continuity brief · what generation receives</summary>
 <p>{brief.modelName} · {brief.images.length} input image(s){brief.firstFrame?' · starts from image':''}</p>
 {brief.blockers.map(w=><p role="alert" key={w}>{w}</p>)}
 {brief.warnings.length>0&&<ul>{brief.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
 <p>Cast: {brief.cast.map(c=>`${c.name} (${c.included?'reference included':'reference not sent'})`).join(', ')||'No character threads assigned'}</p>
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{brief.images.map((url,i)=><figure key={`${i}-${url}`} style={{margin:0,width:100}}><img src={url} alt={`Generation input ${i+1}`} style={{width:'100%',height:72,objectFit:'contain'}}/><figcaption>{i===0&&brief.firstFrame?'Starting frame':`Reference ${i+1}`}</figcaption></figure>)}</div>
 <label>Exact prompt<textarea readOnly value={brief.prompt} rows={8} style={{width:'100%'}}/></label>
 <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(brief.settings,null,2)}</pre>
 {brief.voices.length>0&&<><p>Dialogue is a separate voice/audio step; these lines are not inserted into the picture prompt.</p><ul>{brief.voices.map((v,i)=><li key={i}>{v.speaker}: {v.text} ({v.hasAudio?'audio attached':'audio missing'})</li>)}</ul></>}
 </details>;
}
