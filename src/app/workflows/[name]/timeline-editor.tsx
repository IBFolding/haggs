import { useEffect, useState } from 'react';
import styles from './timeline-editor.module.css';

import { ACTOR_ACTIONS, changeActorEvents, changePathPoints, object, parseTimeline, updateTimeline, type Item } from './timeline-data';
function NumberField({label, value, min, max, onChange, invalidMessage}: {label: string; value: number; min: number; max?: number | undefined; onChange: (v: number) => void | boolean; invalidMessage?: string}) {
  const [draft, setDraft] = useState(String(value));
  const [error,setError] = useState('');
  useEffect(() => setDraft(String(value)), [value]);
  return <label><span>{label}</span><input type="number" inputMode="decimal" step="0.01" min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && n >= min && (max === undefined || n <= max) && onChange(n)!==false) setError('');
    else {setDraft(String(value));setError(invalidMessage ?? 'Enter a valid number.');}
  }} />{error && <span role="alert">{error}</span>}</label>;
}
function PositionField({label, value, onChange}: {label: string; value: number; onChange: (v: number) => void}) {
  return <label><span>{label}: {Math.round(value * 100)}%</span><input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} onChange={e => onChange(Number(e.target.value) / 100)} /></label>;
}
export function TimelineEditor({value, onChange}: {value: string; onChange: (v: string) => void}) {
  const parsed = parseTimeline(value);
  const update = (i: number, path: (string | number)[], v: string | number) => { const next = updateTimeline(value, i, path, v); if (next === null) return false; onChange(next); return true; };
  const number = (i: number, item: Item, key: string, label: string, max?: number) => typeof item[key] === 'number' && <NumberField key={key} label={label} value={item[key] as number} min={0} max={max} onChange={n => update(i, [key], n)} />;
  return <section className={styles.timeline} aria-label="Timing and placement">
    <h3>Timing and placement</h3>
    {parsed ? <><p>Adjust timing and move the sliders to place each point in the image.</p>{parsed.items.map((item, i) => <fieldset key={i} className={styles.item}>
      <legend>{String(item.name ?? item.type ?? item.shape ?? `${parsed.group === 'actors' ? 'Character' : 'Effect'} ${i + 1}`)}</legend>
      <div className={styles.grid}>
        {number(i,item,'start','Start (seconds)')}{number(i,item,'impact','Impact (seconds)')}{number(i,item,'end','End (seconds)')}{number(i,item,'radius','Size',1)}{typeof item.x === 'number' && <PositionField label="Left to right" value={item.x} onChange={n => update(i,['x'],n)} />}{typeof item.y === 'number' && <PositionField label="Top to bottom" value={item.y} onChange={n => update(i,['y'],n)} />}
      </div>
      {Array.isArray(item.path) && <><div>{item.path.map((point, p) => Array.isArray(point) && point.length >= 3 && point.slice(0,3).every(n => typeof n === 'number') && <div className={styles.point} key={p}><strong>Position {p + 1}</strong><div className={styles.grid}>{['At (seconds)','Left to right','Top to bottom'].map((label, axis) => axis === 0 ? <NumberField key={axis} label={label} value={point[axis]} min={0} invalidMessage="Use a different, nonnegative time for each position." onChange={n => update(i, ['path',p,axis], n)} /> : <PositionField key={axis} label={label} value={point[axis]} onChange={n => update(i, ['path',p,axis], n)} />)}</div><button type="button" disabled={changePathPoints(value,i,p)===null} onClick={()=>{const next=changePathPoints(value,i,p);if(next!==null)onChange(next);}}>Remove position {p+1}</button></div>)}</div><button type="button" disabled={changePathPoints(value,i)===null} onClick={()=>{const next=changePathPoints(value,i);if(next!==null)onChange(next);}}>Add position</button>{changePathPoints(value,i)===null && <p>Use different times and valid coordinates for each position. The visual editor supports up to 100 positions.</p>}</>}
      {parsed.group==='actors' && Array.isArray(item.events) && <><h4>Actions</h4>{item.events.map((event, e) => object(event) && <div className={styles.point} key={e}>
        <label><span>Action {e+1}</span><select value={typeof event.action==='string'?event.action:''} onChange={input=>update(i,['events',e,'action'],input.target.value)}>
          {(typeof event.action!=='string'||!ACTOR_ACTIONS.some(a=>a===event.action)) && <option value={typeof event.action==='string'?event.action:''}>Unsupported action</option>}
          {ACTOR_ACTIONS.map(action=><option key={action} value={action}>{action[0]!.toUpperCase()+action.slice(1)}</option>)}
        </select></label>
        <div className={styles.grid}>{(['start','end'] as const).map(k => typeof event[k] === 'number' && <NumberField key={k} label={`${k === 'start' ? 'Start' : 'End'} (seconds)`} value={event[k] as number} min={0} invalidMessage="The end must be after the start." onChange={n => update(i, ['events',e,k], n)} />)}</div>
        <button type="button" disabled={changeActorEvents(value,i,e)===null} onClick={()=>{const next=changeActorEvents(value,i,e);if(next!==null)onChange(next);}}>Remove action {e+1}</button>
      </div>)}<button type="button" disabled={changeActorEvents(value,i)===null} onClick={()=>{const next=changeActorEvents(value,i);if(next!==null)onChange(next);}}>Add action</button>{changeActorEvents(value,i)===null && <p>Check the action names and times in the advanced editor. The visual editor supports up to 100 actions.</p>}</>}
    </fieldset>)}</> : <p>Open the advanced editor to fix or edit this timeline.</p>}
    <details open={!parsed || undefined}><summary>Advanced timeline editor</summary><label><span>Timeline JSON</span><textarea rows={8} value={value} onChange={e => onChange(e.target.value)} /></label></details>
  </section>;
}
