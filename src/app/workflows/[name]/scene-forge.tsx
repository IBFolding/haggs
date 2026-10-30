"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {Nav} from '../../nav';
import {sceneForgeHtml} from '../../../story/scene-forge';
import styles from './scene-forge.module.css';

const LIMIT=20_000_000;
type Clip = {name:string; data:string};
export function SceneForge() {
  const [clips,setClips]=useState<(Clip|null)[]>([null,null,null]);
  const [labels,setLabels]=useState(['Walk','Dodge','Attack']);
  const [selected,setSelected]=useState<number|null>(null);
  const [error,setError]=useState('');
  const sequence=useRef([0,0,0]);
  const ready=clips.every(Boolean);
  function choose(index:number,file:File|undefined) {
    if(!file)return;
    const token=(sequence.current[index] ?? 0)+1; sequence.current[index]=token;
    if(!['video/mp4','video/webm'].includes(file.type)||file.size>LIMIT||!file.size) {setError('Choose an MP4 or WebM under 20 MB for each branch.');return;}
    setError('');
    const reader=new FileReader();
    reader.onload=()=>{if(sequence.current[index]!==token || typeof reader.result!=='string')return;setClips(prev=>prev.map((v,i)=>i===index?{name:file.name,data:reader.result as string}:v));};
    reader.onerror=()=>setError('This file could not be read. Choose it again.');
    reader.readAsDataURL(file);
  }
  function download() {
    if(!ready)return;
    try {
      const html=sceneForgeHtml(labels,clips.map(c=>c!.data));
      const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
      const a=document.createElement('a');a.href=url;a.download='playable-scene.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(e instanceof Error?e.message:'Could not create the player.');}
  }
  return <div className="app"><Nav current="Workflows"/><main className={`canvas ${styles.page}`}>
    <Link href="/workflows#haggs">← Haggs workflows</Link><div className={styles.heading}><div><span className="eyebrow">Game Director · no model required</span><h1>Playable Scene Forge</h1><p>Turn three prepared video clips into a scene with choices. Add your clips, name the actions, then try and download the player.</p></div></div>
    <p className={styles.note}>This player uses existing clips. It does not generate H3 video or create persistent game state. Files stay in this browser; the downloaded player contains your clips.</p>
    <div className={styles.layout}><section className={styles.inputs} aria-label="Scene choices"><h2>1. Add your branches</h2>{clips.map((clip,i)=><div className={styles.card} key={i}><label>Choice {i+1}<input value={labels[i]} maxLength={120} onChange={e=>setLabels(prev=>prev.map((v,j)=>j===i?e.target.value:v))}/></label><label className={styles.upload}> {clip ? clip.name : 'Choose an MP4 or WebM'}<input type="file" accept="video/mp4,video/webm" aria-label={`Video for choice ${i+1}`} onChange={e=>{choose(i,e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label></div>)}<small>Up to 20 MB per clip. Use short, compatible videos.</small>{error&&<p role="alert">{error}</p>}</section>
    <section className={styles.preview} aria-label="Player preview"><h2>2. Try your scene</h2>{selected!==null&&clips[selected]?<video key={clips[selected]!.data} src={clips[selected]!.data} controls autoPlay playsInline/>:<div className={styles.empty}>Choose a branch below to preview it.</div>}<div className={styles.choices}>{clips.map((clip,i)=><button className="pill" key={i} disabled={!clip} onClick={()=>setSelected(i)}>{labels[i]?.trim()||`Choice ${i+1}`}</button>)}</div><button className="fire" disabled={!ready} onClick={download}>Download playable scene</button><p className="wf-small">One self-contained HTML file · choices replay the prepared clips.</p></section></div>
    <p><a href="/workflows/game-director/START-HERE.md">Full ComfyUI workflow and H3 requirements</a></p>
  </main></div>;
}
