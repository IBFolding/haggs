import { useEffect, useState } from 'react';
import styles from './timeline-editor.module.css';

import { changePathPoints, object, parseTimeline, updateTimeline, type Item } from './timeline-data';
function NumberField({label, value, min, max, onChange}: {label: string; value: number; min: number; max?: number | undefined; onChange: (v: number) => void}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label><span>{label}</span><input type="number" inputMode="decimal" step="0.01" min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => {
    const n = Number(draft);
    if (draft.trim() && Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
    else setDraft(String(value));
  }} /></label>;
}
function PositionField({label, value, onChange}: {label: string; value: number; onChange: (v: number) => void}) {
  return <label><span>{label}: {Math.round(value * 100)}%</span><input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} onChange={e => onChange(Number(e.target.value) / 100)} /></label>;
}
export function TimelineEditor({value, onChange}: {value: string; onChange: (v: string) => void}) {
  const parsed = parseTimeline(value);
  const update = (i: number, path: (string | number)[], v: string | number) => { const next = updateTimeline(value, i, path, v); if (next !== null) onChange(next); };
  const number = (i: number, item: Item, key: string, label: string, max?: number) => typeof item[key] === 'number' && <NumberField key={key} label={label} value={item[key] as number} min={0} max={max} onChange={n => update(i, [key], n)} />;
  return <section className={styles.timeline} aria-label="Timing and placement">
    <h3>Timing and placement</h3>
    {parsed ? <><p>Adjust timing and move the sliders to place each point in the image.</p>{parsed.items.map((item, i) => <fieldset key={i} className={styles.item}>
      <legend>{String(item.name ?? item.type ?? item.shape ?? `${parsed.group === 'actors' ? 'Character' : 'Effect'} ${i + 1}`)}</legend>
      <div className={styles.grid}>
        {number(i,item,'start','Start (seconds)')}{number(i,item,'impact','Impact (seconds)')}{number(i,item,'end','End (seconds)')}{number(i,item,'radius','Size',1)}{typeof item.x === 'number' && <PositionField label="Left to right" value={item.x} onChange={n => update(i,['x'],n)} />}{typeof item.y === 'number' && <PositionField label="Top to bottom" value={item.y} onChange={n => update(i,['y'],n)} />}
      </div>
      {Array.isArray(item.path) && <><div>{item.path.map((point, p) => Array.isArray(point) && point.length >= 3 && point.slice(0,3).every(n => typeof n === 'number') && <div className={styles.point} key={p}><strong>Position {p + 1}</strong><div className={styles.grid}>{['At (seconds)','Left to right','Top to bottom'].map((label, axis) => axis === 0 ? <NumberField key={axis} label={label} value={point[axis]} min={0} onChange={n => update(i, ['path',p,axis], n)} /> : <PositionField key={axis} label={label} value={point[axis]} onChange={n => update(i, ['path',p,axis], n)} />)}</div><button type="button" disabled={changePathPoints(value,i,p)===null} onClick={()=>{const next=changePathPoints(value,i,p);if(next!==null)onChange(next);}}>Remove position {p+1}</button></div>)}</div><button type="button" disabled={changePathPoints(value,i)===null} onClick={()=>{const next=changePathPoints(value,i);if(next!==null)onChange(next);}}>Add position</button>{changePathPoints(value,i)===null && <p>Use different times and valid coordinates for each position. The visual editor supports up to 100 positions.</p>}</>}
      {Array.isArray(item.events) && item.events.map((event, e) => object(event) && <div className={styles.point} key={e}><strong>{typeof event.action === 'string' ? event.action : `Action ${e + 1}`}</strong><div className={styles.grid}>{(['start','end'] as const).map(k => typeof event[k] === 'number' && <NumberField key={k} label={`${k === 'start' ? 'Start' : 'End'} (seconds)`} value={event[k] as number} min={0} onChange={n => update(i, ['events',e,k], n)} />)}</div></div>)}
    </fieldset>)}</> : <p>Open the advanced editor to fix or edit this timeline.</p>}
    <details open={!parsed || undefined}><summary>Advanced timeline editor</summary><label><span>Timeline JSON</span><textarea rows={8} value={value} onChange={e => onChange(e.target.value)} /></label></details>
  </section>;
}
