"use client";
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {normalize} from '../../story/boards';
import {clipSeconds} from '../../story/cut';
import {defaultKv} from '../../story/kv';
import type {Project} from '../../story/model';
import {createProjectStore} from '../../story/store';
import {Nav} from '../nav';
import {LAST_BOARD} from '../project-tabs';
import {SiteFooter} from '../site-footer';
import {MediaThumb} from '../media-thumb';
import styles from './editor-home.module.css';

const duration=(seconds:number)=>{const whole=Math.round(seconds);return `${Math.floor(whole/60)}:${(whole%60).toString().padStart(2,'0')}`;};
export function EditorHome(){
 const store=useMemo(()=>createProjectStore(defaultKv()),[]);
 const [error,setError]=useState<string|null>(null),[projects,setProjects]=useState<Project[]|null>(null),[last,setLast]=useState<{project:string;board:string}|null>(null),[query,setQuery]=useState('');
 useEffect(()=>{let active=true;
  const load=async()=>{
   try{const remembered=JSON.parse(localStorage.getItem(LAST_BOARD)??'null');if(active&&typeof remembered?.project==='string'&&typeof remembered?.board==='string')setLast(remembered);}catch{}
   try{const summaries=await store.list(),loaded=await Promise.all(summaries.map(p=>store.load(p.id)));if(active)setProjects(loaded.filter((p):p is Project=>!!p).map(normalize).sort((a,b)=>b.updatedAt-a.updatedAt));}
   catch{if(active)setError('Your projects could not be opened. Retry or return to Projects.');}
  };void load();const refresh=()=>void load();window.addEventListener('haggs:projects-synced',refresh);
  return()=>{active=false;window.removeEventListener('haggs:projects-synced',refresh);};
 },[store]);
 const entries=useMemo(()=>(projects??[]).flatMap(project=>project.boards!.map(board=>{
  const attached=board.shots.filter(s=>s.render?.url),video=attached.filter(s=>s.render?.kind==='video').length,seconds=attached.reduce((n,s)=>n+clipSeconds(s),0),preview=attached[0]?.render;
  return {project,board,attached:attached.length,video,seconds,preview,href:`/board/${encodeURIComponent(project.id)}/cut?b=${encodeURIComponent(board.id)}`};
 })),[projects]);
 const recent=entries.find(e=>e.project.id===last?.project&&e.board.id===last?.board)??entries[0];
 const filtered=entries.filter(e=>`${e.project.name} ${e.board.name}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="app"><Nav current="Editor"/><div className="canvas"><main className={styles.main}>
  <header className={styles.header}><div><span className="eyebrow">Your editing room</span><h1>Pick up the cut.</h1><p>Continue your last board, or choose another project. Your edits stay with each board.</p></div><Link href="/library" className="pill">Projects & imports →</Link></header>
  {error?<p role="alert">{error} <button className="pill" onClick={()=>window.location.reload()}>Retry</button> <Link href="/library">Back to Projects</Link></p>:!projects?<p role="status">Loading your cuts…</p>:<>
   {recent&&<section className={styles.resume} aria-label="Continue editing"><div className={styles.preview}>{recent.preview?<MediaThumb url={recent.preview.url} kind={recent.preview.kind}/>:<span>No media attached yet</span>}</div><div className={styles.resumeInfo}><span className="eyebrow">Continue editing</span><h2>{recent.project.name}</h2><p>{recent.board.name} · {recent.board.shots.length} shots · {duration(recent.seconds)} attached media</p><Link className="fire" href={recent.href}>Open last cut →</Link></div></section>}
   {!entries.length?<section className={styles.empty}><h2>Your first cut starts with a shot.</h2><p>Start with a script, build a storyboard, or bring in your own footage.</p><div><Link className="fire" href="/library">Start a project →</Link><Link className="pill" href="/shorts">Browse Shorts templates</Link><Link className="plain" href="/coverage">Plan camera coverage</Link></div></section>:<>
    <div className={styles.listHead}><div><h2>All your boards</h2><p>{entries.length} board{entries.length===1?'':'s'} across {projects.length} project{projects.length===1?'':'s'}</p></div><label>Find a cut<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Project or board name"/></label></div>
    {filtered.length?<ul className={styles.grid}>{filtered.map(entry=><li key={`${entry.project.id}/${entry.board.id}`}><Link className={styles.card} href={entry.href}>
     <div className={styles.thumbnail}>{entry.preview?<MediaThumb url={entry.preview.url} kind={entry.preview.kind}/>:<span>Storyboard ready for your first take</span>}<span className={styles.time}>{duration(entry.seconds)}</span></div>
     <div className={styles.cardInfo}><span>{entry.project.name}</span><h3>{entry.board.name}</h3><p>{entry.board.shots.length} shots · {entry.video} video · {entry.attached-entry.video} stills</p><span className={styles.readiness}>{entry.attached?`${entry.attached} of ${entry.board.shots.length} shots have media`:'No media attached yet'}</span><b>Open board in editor →</b></div>
    </Link></li>)}</ul>:<div className={styles.empty}><h3>No cuts match “{query}”.</h3><button className="pill" onClick={()=>setQuery('')}>Clear search</button></div>}
   </>}
  </>}
 </main><SiteFooter/></div></div>;
}
