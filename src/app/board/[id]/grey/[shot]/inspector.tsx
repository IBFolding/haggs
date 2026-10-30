"use client";

import { useEffect, useRef, useState } from "react";

import { uploadFile } from "../../../../upload-client";
import type { BankItem } from "../../../../../story/bank";
import { MODEL_EXT, addProp, propShadow, removeProp, setPropModel, shiftLayer, updateProp, type GreyScene, type Prop } from "../../../../../story/grey-scene";
import { LightInspector, SceneLook } from "./light-panel";
import { NumSlide, Slide } from "./slide";
import { SurfacesPanel } from "./surfaces-panel";

type Tab = "item" | "scene";

/**
 * The right-hand side: the controls for whatever is selected, or, with nothing selected,
 * the whole scene (its layers, look, shadows and air). Picking something on the picture
 * or in a list switches to its controls.
 */
export function Inspector({ scene, selected, onSelect, onChange, footageUrl, isVideo, places, props }: {
  scene: GreyScene;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: GreyScene) => void;
  footageUrl: string | null;
  isVideo: boolean;
  places: BankItem[];
  props: BankItem[];
}) {
  const [tab, setTab] = useState<Tab>("scene");
  useEffect(() => { setTab(selected ? "item" : "scene"); }, [selected]);
  const prop = scene.props?.find((p) => p.id === selected) ?? null;
  const light = scene.lights?.find((l) => l.id === selected) ?? null;
  const surface = scene.surfaces?.find((s) => s.id === selected) ?? null;
  const backdrop = selected === "backdrop" && scene.backdrop ? scene.backdrop : null;
  // The area's own flow stays mounted, so a search that is still running is not lost when you click elsewhere.
  const lastSurface = useRef<string | null>(null);
  if (surface) lastSurface.current = surface.id;
  const surfaceFocus = surface?.id ?? (scene.surfaces?.some((s) => s.id === lastSurface.current) ? lastSurface.current : null);

  return (
    <div className="gw-inspector">
      <div className="gw-tabs" role="tablist" aria-label="Controls">
        <button role="tab" aria-selected={tab === "item"} className={tab === "item" ? "on" : ""} onClick={() => setTab("item")}>{prop ? "Object" : light ? "Light" : surface ? "Area" : backdrop ? "Background" : "Selected"}</button>
        <button role="tab" aria-selected={tab === "scene"} className={tab === "scene" ? "on" : ""} onClick={() => setTab("scene")}>Scene</button>
      </div>
      <div className="gw-inspector-body gs-panel">
        <div hidden={tab !== "item" || !surface}>
          {surfaceFocus && <SurfacesPanel mode="card" focus={surfaceFocus} scene={scene} footageUrl={footageUrl} isVideo={isVideo} references={[...(scene.references ?? []).map((r) => ({ ...r, image: r.url })), ...places, ...props]} onChange={onChange} />}
        </div>
        {tab === "item" && (
          <>
            {prop && <PropControls scene={scene} prop={prop} onSelect={onSelect} onChange={onChange} />}
            {light && <LightInspector scene={scene} id={light.id} onSelect={onSelect} onChange={onChange} />}
            {backdrop && (
              <section className="gs-sec">
                <h3 className="gw-ihead">Background · {backdrop.name}</h3>
                <div className="gs-sliders">
                  <Slide label="Zoom" min={1} max={4} step={0.05} value={backdrop.scale} onChange={(v) => onChange({ ...scene, backdrop: { ...backdrop, scale: v } })} />
                  <Slide label="Across" min={0} max={1} step={0.01} value={backdrop.x} onChange={(v) => onChange({ ...scene, backdrop: { ...backdrop, x: v } })} />
                  <Slide label="Down" min={0} max={1} step={0.01} value={backdrop.y} onChange={(v) => onChange({ ...scene, backdrop: { ...backdrop, y: v } })} />
                  <Slide label="Soft focus" min={0} max={1} step={0.01} value={backdrop.blur} onChange={(v) => onChange({ ...scene, backdrop: { ...backdrop, blur: v } })} />
                  <button className="plain" onClick={() => { onChange({ ...scene, backdrop: undefined as never, place: undefined as never }); onSelect(null); }}>Remove the background</button>
                </div>
              </section>
            )}
            {!prop && !light && !surface && !backdrop && (
              <p className="gw-empty">Click something on the picture, or pick it from the list under Scene, to change its size, place, light and look.</p>
            )}
          </>
        )}
        {tab === "scene" && <SceneControls scene={scene} selected={selected} onSelect={onSelect} onChange={onChange} />}
      </div>
    </div>
  );
}

function PropControls({ scene, prop: sel, onSelect, onChange }: { scene: GreyScene; prop: Prop; onSelect: (id: string | null) => void; onChange: (next: GreyScene) => void }) {
  const modelPick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const live = useRef(scene);
  live.current = scene;
  const set = (change: Partial<Omit<Prop, "id">>) => onChange(updateProp(scene, sel.id, change));

  /** A 3D model for the Blender set. Only on your own computer: the Blender export reads files from the local media folder. */
  async function uploadModel(file: File | undefined) {
    if (!file) return;
    if (!MODEL_EXT.test(file.name)) return setProblem("Add a glb, gltf, obj or fbx model.");
    setBusy(true);
    setProblem(null);
    const r = await uploadFile(file);
    setBusy(false);
    if (!r.ok) return setProblem(r.reason);
    onChange(setPropModel(live.current, sel.id, { url: r.url, name: file.name }));
  }

  return (
    <section className="gs-sec" aria-label={`${sel.name} controls`}>
      <h3 className="gw-ihead"><span>{sel.role === "actor" ? "Actor" : "Object"}</span> {sel.name}</h3>
      <div className="gs-row" aria-label="Size shortcuts">
        <button className="pill" disabled={sel.locked} onClick={() => set({ w: sel.w / 2 })} title="Half the size">Half size</button>
        <button className="pill" disabled={sel.locked} onClick={() => set({ w: sel.w * 2 })} title="Twice the size">Double</button>
        <button className="plain" disabled={sel.locked} onClick={() => set({ w: 0.25, rotate: 0 })} title="Back to the starting size, upright">Reset size</button>
      </div>
      <div className="gs-sliders">
        <NumSlide label="Size" min={0.03} max={1.5} step={0.01} value={sel.w} onChange={(v) => set({ w: v })} />
        <NumSlide label="Across" min={0} max={1} step={0.01} value={sel.x} onChange={(v) => set({ x: v })} />
        <NumSlide label="Down" min={0} max={1} step={0.01} value={sel.y} onChange={(v) => set({ y: v })} />
        <NumSlide label="Turn" min={0} max={359} step={1} value={sel.rotate} scale={1} unit="°" onChange={(v) => set({ rotate: v })} />
        <NumSlide label="Opacity" min={0.1} max={1} step={0.01} value={sel.opacity} onChange={(v) => set({ opacity: v })} />
        <NumSlide label="Shadow" min={0} max={1} step={0.05} value={propShadow(sel)} onChange={(v) => set({ shadow: v })} />
      </div>
      <div className="gs-row">
        <button className={`pill${sel.behind ? " on" : ""}`} aria-pressed={sel.behind} onClick={() => set({ behind: !sel.behind })}>Behind the actor</button>
        <button className={`pill${sel.flip ? " on" : ""}`} aria-pressed={sel.flip === true} onClick={() => set({ flip: !sel.flip })}>Flip</button>
        <button className={`pill${sel.locked ? " on" : ""}`} aria-pressed={sel.locked === true} onClick={() => set({ locked: !sel.locked })}>{sel.locked ? "Locked" : "Lock"}</button>
      </div>
      <div className="gs-row">
        <button className="pill" onClick={() => { const { id: _id, ...p } = sel; const next = addProp(scene, p); const id = next.props!.at(-1)!.id; onChange(updateProp(next, id, { ...p, x: Math.min(0.95, p.x + 0.05), y: Math.min(0.95, p.y + 0.05) })); onSelect(id); }}>Duplicate</button>
        <button className="pill" onClick={() => onChange(shiftLayer(scene, sel.id, 1))} title="Bring forward">Forward</button>
        <button className="pill" onClick={() => onChange(shiftLayer(scene, sel.id, -1))} title="Send back">Back</button>
        <button className="plain danger" onClick={() => { onChange(removeProp(scene, sel.id)); onSelect(null); }}>Remove</button>
      </div>
      {process.env.NEXT_PUBLIC_HOSTED !== "1" && (
        <div className="gs-row">
          <button className="pill" disabled={busy} onClick={() => modelPick.current?.click()}>{busy ? "Adding…" : sel.model ? "Change 3D model" : "Add a 3D model"}</button>
          {sel.model && <button className="plain" onClick={() => onChange(setPropModel(scene, sel.id, null))}>Remove {sel.model.name}</button>}
          <input ref={modelPick} type="file" accept=".glb,.gltf,.obj,.fbx" hidden onChange={(e) => { void uploadModel(e.target.files?.[0]); e.target.value = ""; }} />
          <small className="gs-soft">For the Blender set only. The picture above is still what you see here.</small>
        </div>
      )}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </section>
  );
}

/** Every layer in the picture in one list, then the look of the whole frame. */
function SceneControls({ scene, selected, onSelect, onChange }: { scene: GreyScene; selected: string | null; onSelect: (id: string | null) => void; onChange: (next: GreyScene) => void }) {
  const props = [...(scene.props ?? [])].reverse();
  const empty = !scene.backdrop && props.length === 0 && !(scene.lights ?? []).length && !(scene.surfaces ?? []).length;
  return (
    <>
      <section className="gs-sec">
        <h3>Layers</h3>
        {empty && <p className="gs-soft">Nothing here yet. Add a background, an object or a light from the shelf on the left.</p>}
        <ul className="gs-layers" aria-label="Everything in the picture">
          {scene.backdrop && (
            <li className={selected === "backdrop" ? "on" : ""}>
              <button className="gs-lname" onClick={() => onSelect(selected === "backdrop" ? null : "backdrop")}>Background · {scene.backdrop.name}</button>
              <span className="gs-lact"><button aria-label="Remove" title="Remove" onClick={() => { onChange({ ...scene, backdrop: undefined as never, place: undefined as never }); if (selected === "backdrop") onSelect(null); }}>×</button></span>
            </li>
          )}
          {props.map((p) => (
            <li key={p.id} className={p.id === selected ? "on" : ""}>
              <button className="gs-lname" onClick={() => onSelect(p.id === selected ? null : p.id)}>{p.name}{p.role === "actor" ? " · actor" : ""}{p.behind ? " · behind" : ""}</button>
              <span className="gs-lact">
                <button aria-label={p.hidden ? "Show" : "Hide"} title={p.hidden ? "Show" : "Hide"} onClick={() => onChange(updateProp(scene, p.id, { hidden: !p.hidden }))}>{p.hidden ? "○" : "●"}</button>
                <button aria-label={p.locked ? "Unlock" : "Lock"} title={p.locked ? "Unlock" : "Lock"} onClick={() => onChange(updateProp(scene, p.id, { locked: !p.locked }))}>{p.locked ? "🔒" : "🔓"}</button>
                <button aria-label="Forward" title="Forward" onClick={() => onChange(shiftLayer(scene, p.id, 1))}>↑</button>
                <button aria-label="Back" title="Back" onClick={() => onChange(shiftLayer(scene, p.id, -1))}>↓</button>
                <button aria-label="Delete" title="Delete" onClick={() => { onChange(removeProp(scene, p.id)); if (selected === p.id) onSelect(null); }}>×</button>
              </span>
            </li>
          ))}
          {(scene.lights ?? []).map((l) => (
            <li key={l.id} className={l.id === selected ? "on" : ""}>
              <button className="gs-lname" onClick={() => onSelect(l.id === selected ? null : l.id)}><i className="gw-swatch" style={{ background: l.color }} /> {l.kind} light</button>
            </li>
          ))}
          {(scene.surfaces ?? []).map((s) => (
            <li key={s.id} className={s.id === selected ? "on" : ""}>
              <button className="gs-lname" onClick={() => onSelect(s.id === selected ? null : s.id)}>{s.label} · area{s.hidden ? " · hidden" : ""}</button>
            </li>
          ))}
        </ul>
      </section>
      <SceneLook scene={scene} onChange={onChange} />
    </>
  );
}
