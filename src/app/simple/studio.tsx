'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Preproduction} from './preproduction';
import {BriefIntake} from './intake';
import {Nav} from '../nav';
import {PersonalHaggy} from '../personal-haggy';
import {usePersonalHaggy} from '../use-personal-haggy';
import {useSession} from '../session';
import {setPro} from '../prefs';
import {announceSaved,PROJECT_SAVED} from '../agent';
import {defaultKv} from '../../story/kv';
import {createProjectStore} from '../../story/store';
import {createProject,type Project} from '../../story/model';
import {importSheets} from '../../sheets/sheets';
import {listWorkflows} from '../workflow-actions';
import {type ToolContext} from '../../story/agent-tools';
import {planKey,readPlan,modelFor,PLAN_EVENT,type Plan} from '../../simple/plan';
import {type Journal} from '../../simple/execute';
import {BankPicker,useReturnedPick} from '../bank-picker';
import type {BankItem} from '../../story/bank';
export function SimpleStudio(){
 const kv=useMemo(()=>defaultKv(),[]),store=useMemo(()=>createProjectStore(kv),[kv]),{session,ready}=useSession(),owner=session?.user.id??'device',ownerRef=useRef(owner);ownerRef.current=owner;
 const [refresh,setRefresh]=useState(0),[plan,setPlan]=useState<Plan|null>(null),[project,setProject]=useState<Project|null>(null),[journal,setJournal]=useState<Journal|null>(null),[problem,setProblem]=useState(''),[busy,setBusy]=useState(false),[name,setName]=useState(''),[bank,setBank]=useState(false);const working=useRef(false),mounted=useRef(true),planRef=useRef<Plan|null>(null);planRef.current=plan;
 useEffect(()=>{setPro(false);mounted.current=true;return()=>{mounted.current=false;};},[]);
 const ctx=useMemo<ToolContext>(()=>({mode:'simple',list:()=>store.list(),load:async id=>await store.load(id)??null,save:async p=>{await store.save(p);announceSaved(p.id);},sheets:async id=>{const raw=await kv.get<string>(`sheets/${id}`);try{return raw?importSheets(raw):null;}catch{return null;}},workflows:async query=>(await listWorkflows()).entries.filter(e=>`${e.title} ${e.description}`.toLowerCase().includes(query.toLowerCase())).map(e=>({name:e.name,title:e.title,description:e.description})),open:path=>{window.location.assign(path);},production:{
  propose:async(id,input)=>{if(working.current)throw Error('Production is running. Pause it before revising the plan.');const own=ownerRef.current;const p=await store.load(id);if(ownerRef.current!==own)throw Error('The account changed.');if(!p)throw Error('Select a project first.');const previous=await kv.get<Plan>(planKey(own,id));if(ownerRef.current!==own)throw Error('The account changed.');const next=readPlan(input,p,previous??undefined);await kv.set(planKey(own,id),next);window.dispatchEvent(new CustomEvent(PLAN_EVENT,{detail:{project:id}}));return {status:'proposed_for_review',plan:next,message:'Plan saved for review. No board was changed and no generation was submitted. The user must review estimates and press Execute plan.'};},
  read:async id=>{const own=ownerRef.current,p=await kv.get<Plan>(planKey(own,id));if(ownerRef.current!==own)throw Error('The account changed.');return {plan:p??null,brief:await kv.get(`simple/brief/${own}/${id}`),bible:await kv.get(`simple/bible/${own}/${id}`),queue:await kv.get(`simple/queue/${own}/${id}`)};},
 }}),[kv,store,refresh]);
 const ai=usePersonalHaggy(ctx,true),projectId=ai.contextProject,selectedProject=useRef(projectId);selectedProject.current=projectId;
 const reload=useCallback(async()=>{if(!projectId||!ready)return;const own=owner;const [p,draft]=await Promise.all([store.load(projectId),kv.get<Plan>(planKey(own,projectId))]);if(ownerRef.current!==own||!mounted.current)return;setProject(p??null);if(draft?.id!==planRef.current?.id||draft?.revision!==planRef.current?.revision)setJournal(null);setPlan(draft??null);},[projectId,owner,ready,store,kv]);
 useEffect(()=>{working.current=false;setBusy(false);setPlan(null);setProject(null);setJournal(null);setProblem('');void reload();},[reload]);
 useEffect(()=>{const update=()=>{void reload();};window.addEventListener(PLAN_EVENT,update);window.addEventListener(PROJECT_SAVED,update);return()=>{window.removeEventListener(PLAN_EVENT,update);window.removeEventListener(PROJECT_SAVED,update);};},[reload]);

 async function create(){if(busy||!ready)return;const p=createProject(name.trim()||'My next film');await store.save(p);window.history.replaceState(null,'',`/simple?project=${p.id}`);ai.setContextProject(p.id);setRefresh(n=>n+1);setName('');}
 async function addReference(item:BankItem){if(!projectId||!item.image)return;const own=ownerRef.current,latest=await store.load(projectId);if(!latest||ownerRef.current!==own)return;const next={...latest,threads:[...latest.threads,{id:crypto.randomUUID(),name:item.name,kind:item.kind==='character'?'character' as const:'motif' as const,color:'#40d99c',ref:item.image}]};await store.save(next);if(ownerRef.current===own){setProject(next);announceSaved(next.id);}}
 const proHref=journal?`/board/${projectId}/cut?b=${journal.board}`:projectId?`/board/${projectId}/cut`:'/editor';
 return <div className="app"><Nav current="Home"/><main className="simple-studio">
  <header className="simple-heading"><div><span className="eyebrow">SIMPLE · YOUR AI, YOUR STUDIO</span><h1>Tell Haggy.<br/>Make something worth watching.</h1><p>Talk it through. Review the plan and cost. Then put it into production.</p></div><Link className="pill" href={proHref} onClick={()=>setPro(true)}>Open this project in Pro →</Link></header>
  <div className="simple-project"><label>Project<select aria-label="Simple project" disabled={busy||ai.busy||ai.recoverable} value={projectId} onChange={e=>{ai.setContextProject(e.target.value);window.history.replaceState(null,'',`/simple?project=${e.target.value}`);}}><option value="">Choose a project</option>{ai.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><input aria-label="New project name" placeholder="Name your next project" maxLength={100} value={name} disabled={busy||ai.busy} onChange={e=>setName(e.target.value)}/><button className="pill" disabled={!ready||busy||ai.busy||ai.recoverable} onClick={()=>void create().catch(()=>setProblem('The project could not be saved.'))}>Start a new project</button>{projectId&&<button className="plain" disabled={busy||ai.busy} onClick={()=>setBank(true)}>Add a character or location reference</button>}</div>
  <BriefIntake key={`${owner}:${projectId}`} disabled={!projectId||!ai.connection||ai.busy||ai.recoverable||busy} onSend={async text=>{const own=owner,id=projectId;await kv.set(`simple/brief/${own}/${id}`,{text,at:Date.now()});if(ownerRef.current!==own||selectedProject.current!==id)throw Error('The account or project changed. Review the brief again.');await ai.send(text);}}/>
  <div className="simple-layout"><section id="haggy-chat" className="simple-chat" aria-label="Talk to Haggy"><div className="simple-chat-heading"><b>Haggy</b><span>Plan first. Make it together.</span>{plan&&<a href="#production-plan" className="simple-plan-link">Review plan · version {plan.revision} →</a>}</div><PersonalHaggy ai={ai} embedded/></section>
  <section id="production-plan" className="simple-plan" aria-label="Production plan"><div className="simple-plan-head"><span className="eyebrow">YOUR PRODUCTION PLAN</span><span>{plan?`Version ${plan.revision}`:'Nothing runs until you review'}</span></div>
  {!plan?<div className="simple-empty"><span className="simple-orbit" aria-hidden>✦</span><h2>An idea becomes a plan here.</h2><p>Connect your Claude or Codex and describe the story, audience and feeling. Haggy will ask what’s missing, then lay out the shots, references, camera work and sound.</p><div className="simple-examples"><p>“A 30-second product reveal. Dark studio, deliberate camera moves, original sound.”</p><p>“Turn my script into an emotional trailer. Start with the people we might lose.”</p><p>“Keep the story, but plan a hand-painted anime version.”</p></div></div>:<>
  <h2>{plan.title}</h2><p>{plan.summary}</p><p className="simple-meta">{plan.aspect} · {plan.shots.length} shots · {plan.shots.reduce((n,s)=>n+s.seconds,0)} seconds · {plan.assets.length} cast/world assets</p><p className="simple-look">{plan.look}</p>
  <ol className="simple-shots">{plan.shots.map((s,i)=>{const made=journal?.steps[`picture-${s.key}`]?.result,ref=s.references[0]??s.assetKeys.flatMap(k=>{const url=journal?.steps[`asset-${k}`]?.result?.url;return url?[url]:[];})[0];return <li key={s.key}><div className="simple-shot-picture">{made?.kind==='video'?<video src={made.url} controls preload="metadata"/>:made||ref?<img src={made?.url??ref} alt={s.heading}/>:<span>{String(i+1).padStart(2,'0')}<small>{s.reuseShot?'Existing take':'Planned shot'}</small></span>}</div><div><div className="simple-shot-title"><h3>{s.heading}</h3><span>{s.seconds}s</span></div><p>{s.beat}</p><dl><div><dt>Camera</dt><dd>{s.camera}</dd></div><div><dt>Light</dt><dd>{s.light}</dd></div></dl><small>{s.reuseShot?'Reuse existing take':modelFor({kind:s.format,seconds:s.seconds,ratio:plan.aspect}).name}{s.format==='video'&&s.seconds<4?' · renders 4s, trimmed to this moment':''}{s.narration?` · ${s.narration.speaker}: “${s.narration.text}”`:''}{s.effect?' · Designed sound':''}</small></div></li>;})}</ol>
  {plan.music&&<p className="simple-look"><b>Soundtrack · Sonilo</b><br/>{plan.music.prompt}</p>}
  {project&&<Preproduction key={`${owner}:${plan.id}:${plan.revision}`} plan={plan} project={project} owner={owner} ownerNow={()=>ownerRef.current} ready={ready} aiBusy={ai.busy||ai.recoverable} kv={kv} store={store} onBusy={value=>{working.current=value;setBusy(value);}} onProject={setProject} onPreview={setJournal}/>}
</>}
  {problem&&<p role="alert" className="library-error">{problem}</p>}
  </section></div>
  <p className="simple-footnote">Simple and Pro share the same editable projects. Your AI account powers planning; Comfy BYOK or eligible Haggs credits power generation. No subscription change is made by switching modes.</p>
 </main>{project&&<ReturnedReference onPick={item=>void addReference(item).catch(()=>setProblem('Reference could not be saved.'))}/>}{bank&&<BankPicker kinds={['character','place']} label="Simple studio" onClose={()=>setBank(false)} allowPhotoBuild={false} onPick={item=>void addReference(item).catch(()=>setProblem('Reference could not be saved.'))}/>}</div>;
}

function ReturnedReference({onPick}:{onPick:(item:BankItem)=>void}){useReturnedPick(['character','place'],onPick);return null;}
