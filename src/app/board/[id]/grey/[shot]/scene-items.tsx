"use client";
import type { GreyScene } from "../../../../../story/grey-scene";
/** Always-visible inventory, including hidden layers that cannot be picked on canvas. */
export function SceneItems({scene, selected, onSelect}: {scene: GreyScene; selected: string | null; onSelect: (id: string) => void}) {
  return <div className="gs-scene-items" aria-label="In this scene"><strong>In this scene</strong>
    {scene.props?.map(p => <button key={p.id} className={`pill${selected === p.id ? " on" : ""}`} aria-pressed={selected === p.id} onClick={() => onSelect(p.id)}><img src={p.url} alt="" />{p.name}{p.hidden ? " · hidden" : ""}</button>)}
    {scene.surfaces?.map(s => <button key={s.id} className={`pill${selected === s.id ? " on" : ""}`} aria-pressed={selected === s.id} onClick={() => onSelect(s.id)}>{s.label}</button>)}
    {scene.lights?.map(l => <button key={l.id} className={`pill${selected === l.id ? " on" : ""}`} aria-pressed={selected === l.id} onClick={() => onSelect(l.id)}><span style={{color:l.color}}>●</span> {l.kind} light</button>)}
    {!scene.props?.length && !scene.surfaces?.length && !scene.lights?.length && <span>Add images, areas or lights to see them here.</span>}
  </div>;
}
