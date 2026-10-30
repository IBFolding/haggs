"use client";
import { useState } from "react";
import { arrangeLettering } from "../../comic/arrange-lettering";
import { THEMES, type Appearance, type LetterPosition } from '../../comic/appearance';
import type { LookId, Panel, Rect } from '../../comic/comic';
export function PageDesign({value,onChange,onLook}:{value:Appearance;onChange:(v:Appearance)=>void;onLook:(look:LookId)=>void}) {
 const change=(patch:Partial<Appearance>)=>onChange({...value,...patch,theme:'custom'});
 return <details className="cx-sec" open><summary><b>Page design</b><small>{THEMES.find(t=>t.id===value.theme)?.name??'Custom'}</small></summary>
 <label className="wf-field"><span>Comic theme</span><select aria-label="Comic theme" value={value.theme} onChange={e=>{const t=THEMES.find(t=>t.id===e.target.value);if(t){onChange({...t.design});onLook(t.look);}else change({});}}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}<option value="custom">Custom</option></select></label>
 <p className="wf-small">Themes style this page and set the look for future drawings. Your existing artwork and animation stay intact. Custom changes are free.</p>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{([['paper','Paper / background'],['border','Border colour'],['ink','Lettering colour'],['bubble','Bubble colour'],['caption','Caption colour']] as const).map(([key,label])=><label key={key}>{label}<input type="color" aria-label={label} value={value[key]} onChange={e=>change({[key]:e.target.value})}/></label>)}</div>
 <label className="wf-field"><span>Paper texture</span><select aria-label="Paper texture" value={value.texture} onChange={e=>change({texture:e.target.value as Appearance['texture']})}><option value="plain">Plain</option><option value="grain">Paper grain</option><option value="dots">Halftone dots</option></select></label>
 {([['borderWidth','Border thickness',0,10,1],['gutter','Panel spacing',0,32,1],['textScale','Lettering size',.7,1.5,.1]] as const).map(([key,label,min,max,step])=><label className="wf-field" key={key}><span>{label} · {value[key]}</span><input type="range" aria-label={label} min={min} max={max} step={step} value={value[key]} onChange={e=>change({[key]:Number(e.target.value)})}/></label>)}
 <label className="wf-field"><span>Speech bubbles</span><select aria-label="Speech bubbles" value={value.bubbleShape} onChange={e=>change({bubbleShape:e.target.value as Appearance['bubbleShape']})}><option value="oval">Oval</option><option value="rounded">Rounded</option><option value="box">Box</option></select></label>
 <label className="wf-field"><span>Lettering font</span><select aria-label="Lettering font" value={value.font} onChange={e=>change({font:e.target.value as Appearance['font']})}><option value="comic">Comic</option><option value="serif">Book serif</option><option value="sans">Clean sans</option></select></label>
 </details>;
}
export function LetterPlacement({panel,index,onChange,appearance,rect}:{panel:Panel;index:number;appearance:Appearance;rect:Rect;onChange:(patch:Partial<Panel>)=>void}) {
 const [message,setMessage]=useState('');
 const update=(kind:'caption'|'bubble',n:number,position:LetterPosition)=>{
  if(kind==='caption')onChange({lettering:{...panel.lettering,caption:position}});
  else {const bubbles=[...(panel.lettering?.bubbles??[])];for(let j=0;j<=n;j++)bubbles[j]??={x:j===0?100:0,y:j===0?0:45};bubbles[n]=position;onChange({lettering:{...panel.lettering,bubbles}});}
 };
 const controls=(kind:'caption'|'bubble',n:number,label:string)=>{const p=(kind==='caption'?panel.lettering?.caption:panel.lettering?.bubbles?.[n])??{x:kind==='caption'?0:n===0?100:0,y:kind==='caption'?100:n===0?0:45};return <div key={label}><b>{label}</b>{(['x','y'] as const).map(axis=><label key={axis}>{axis==='x'?'Across':'Down'}<input type="range" min={0} max={100} value={p[axis]} aria-label={`Panel ${index+1}: ${label} ${axis==='x'?'across':'down'}`} onChange={e=>update(kind,n,{...p,[axis]:Number(e.target.value)})}/></label>)}</div>};
 return <details><summary>Place captions and bubbles</summary><p className="wf-small">Move lettering away from faces and action. Positions stay inside each panel.</p>{panel.caption&&controls('caption',0,'Caption')}{panel.lines.filter(l=>l.text.trim()).map((_,n)=>controls('bubble',n,`Bubble ${n+1}`))}<button className="plain" onClick={()=>{const lettering=arrangeLettering(panel,rect.w,rect.h,appearance);if(lettering){onChange({lettering});setMessage("Lettering arranged. Check faces and artwork; adjust with the sliders if needed.");}else setMessage("No clear arrangement found. Shorten the text, reduce lettering size, or adjust positions manually. Your positions are unchanged.");}}>Arrange lettering</button><p role="status">{message}</p><button className="plain" onClick={()=>{onChange({lettering:{}});setMessage('');}}>Reset lettering positions</button></details>;
}
