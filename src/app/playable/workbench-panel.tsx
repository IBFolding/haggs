'use client';
import { useEffect, useState } from 'react';
import { downloadJSON } from './download-json';
import { assetReadiness, exportPlayable, readWorkbench, repairBrief, revisionOf, type RunReport, type Workbench } from '../../playable/workbench';
import type { SavedGame } from '../../playable/store';
import type { GameSpec } from '../../playable/spec';

export function WorkbenchPanel({ game, run, onSave, onRestore, onRepair }: { game: SavedGame; run: RunReport | null; onSave: (value: Workbench) => Promise<void>; onRestore: (spec: GameSpec, name: string) => Promise<void>; onRepair: (brief: string) => void }) {
  const [draft,setDraft]=useState(()=>readWorkbench(game.workbench,game.spec));
  const [checks,setChecks]=useState({controls:false,goal:false,progression:false});
  const [notes,setNotes]=useState('');const [name,setName]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const revision=revisionOf(game.spec); const currentRun=run?.revision===revision ? run : null;
  const assets=assetReadiness(game.spec);
  const savedReview=[...draft.reviews].reverse().find(r=>r.revision===revision);
  const diagnosticRun=currentRun && (currentRun.started || currentRun.errors.length) ? currentRun : savedReview?.run;
  useEffect(()=>{const saved=readWorkbench(game.workbench,game.spec);const review=[...saved.reviews].reverse().find(r=>r.revision===revision);setDraft(saved);setChecks({controls:review?.controls??false,goal:review?.goal??false,progression:review?.progression??false});setNotes(review?.notes??'');setMessage('');},[game.id,game.workbench,revision]);
  async function persist(next: Workbench, text: string) {
    if(busy)return;setBusy(true);setMessage('');
    try{await onSave(next);setMessage(text);}catch(e){setMessage(e instanceof Error?e.message:'Could not save. Export your project first.');}finally{setBusy(false);}
  }
  return <section className="pl-workbench" aria-label="Game workbench">
    <div className="pl-workbench-head"><div><span className="pl-eyebrow">Build → Play → Review → Improve</span><h2>Make it worth playing.</h2></div><button className="pl-ghost pl-small" onClick={()=>downloadJSON(exportPlayable(game.spec,draft),`${game.spec.title.replace(/[^\w-]/g,'-')}.haggs-game.json`)}>Export editable project</button></div>
    <p className="pl-sub">Design and review stay with your game in this browser. Export a project file to back them up.</p>
    <div className="pl-workbench-grid">
      <details open><summary>1. Design brief</summary>
        {([['hook','The hook'],['goal','How you win'],['controls','Controls'],['progression','Stages and progression'],['artDirection','Art direction']] as const).map(([key,label])=><label key={key} className="pl-brief-field"><span>{label}</span><textarea aria-label={label} maxLength={600} rows={2} value={draft.brief[key]} onChange={e=>setDraft({...draft,brief:{...draft.brief,[key]:e.target.value}})} /></label>)}
        <button className="pl-ghost pl-small" disabled={busy} onClick={()=>void persist(draft,'Design brief saved.')}>Save design brief</button>
      </details>
      <details open><summary>2. Playtest & review</summary>
        <p className="pl-mono">{currentRun ? `${currentRun.ready?'Runtime ready':'Loading runtime'} · ${currentRun.started?'Played':'Not started'} · ${currentRun.started?currentRun.outcome:'Waiting for Play'} · ${currentRun.errors.length} reported errors${currentRun.score===null?'':` · score ${currentRun.score}`}` : 'Play the current code game to capture a run. Template games use the manual checklist.'}</p>
        <p className="pl-sub">Game-reported events are diagnostics. They do not prove a game is fun or that every level is reachable.</p>
        {currentRun?.errors.map((e,i)=><p key={i} className="pl-problem">{e}</p>)}
        {([['controls','Controls feel responsive'],['goal','Goal and restart work'],['progression','Progression and ending work']] as const).map(([key,label])=><label className="pl-review-check" key={key}><input type="checkbox" checked={checks[key]} onChange={e=>setChecks({...checks,[key]:e.target.checked})}/>{label}</label>)}
        <label className="pl-brief-field"><span>What should improve?</span><textarea aria-label="Playtest notes" maxLength={2000} rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
        <button className="pl-ghost pl-small" disabled={busy} onClick={()=>void persist({...draft,reviews:[...draft.reviews,{revision,at:Date.now(),...checks,notes,...(diagnosticRun?{run:diagnosticRun}:{})}].slice(-20)},'Human review saved for this revision.')}>Save review</button>
        <button className="pl-plain" disabled={busy} onClick={()=>onRepair(repairBrief(game.spec,{...draft,reviews:[...draft.reviews,{revision,at:Date.now(),...checks,notes,...(diagnosticRun?{run:diagnosticRun}:{})}]}))}>Prepare improvement request</button>
        <p className="pl-sub">Fills the chat for you to review. Sending it may use your Claude API key; nothing runs automatically.</p>
        {draft.reviews.length>0&&<p className="pl-mono">{draft.reviews.length} saved reviews · {draft.reviews.filter(r=>r.revision===revision).length} for this revision</p>}
      </details>
      <details><summary>3. Checkpoints & assets</summary>
        <p className="pl-sub">{assets.ready}/{assets.total} art slots have pictures. Placeholder art is playable. Checkpoints preserve a named version; restoring keeps the current version in Undo history.</p>
        <label className="pl-brief-field"><span>Checkpoint name</span><input aria-label="Checkpoint name" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>
        <button className="pl-ghost pl-small" disabled={busy||!name.trim()} onClick={()=>void persist({...draft,checkpoints:[...draft.checkpoints,{id:crypto.randomUUID(),name:name.trim(),at:Date.now(),spec:game.spec}].slice(-10)},'Checkpoint saved.')}>Save checkpoint</button>
        {draft.checkpoints.map(c=><div className="pl-saved-row" key={c.id}><span>{c.name}</span><button className="pl-plain" disabled={busy} onClick={async()=>{setBusy(true);try{await onRestore(c.spec,c.name);setMessage(`Restored ${c.name}. Undo keeps your previous version.`);}catch(e){setMessage(e instanceof Error?e.message:'Could not restore.');}finally{setBusy(false);}}}>Restore</button></div>)}
      </details>
    </div>
    {message&&<p role="status" className="pl-sub">{message}</p>}
  </section>;
}
