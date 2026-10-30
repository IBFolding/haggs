"use client";

import { useEffect, useRef, useState } from "react";

import { StudioIcon } from "./studio-icon";
import { addUploadedLayer } from "../../../../../story/grey-tray";
import { track } from "../../../../../activity/activity";
import { propCutoutPrompt, propPrompt, PROP_INPUT } from "../../../../../comfy/prop-cutout";
import { editEstimate } from "../../../../../providers/cloud-edits";
import { run } from "../../../../actions";
import { openKeys } from "../../../../nav";
import { runWorkflow } from "../../../../workflow-actions";
import { uploadFile } from "../../../../upload-client";
import { BuildLink } from "../../../../return-bar";
import type { BankItem } from "../../../../../story/bank";
import { LightPanel } from "./light-panel";
import { SetsPanel } from "./sets-panel";
import { ReferenceBoard } from "./reference-board";
import { SurfacesPanel } from "./surfaces-panel";
import type { SavedSet } from "../../../../../story/set-bank";
import { MODEL_EXT, addProp, replaceRoomSource, propShadow, removeProp, setPropModel, shiftLayer, updateProp, type GreyScene } from "../../../../../story/grey-scene";

/** The Set step: where it happens, and what is standing in it. */
/** How many frame-widths wide a picture must be to fill the whole frame, so a wide room in a tall frame doesn't leave bars. */
async function coverScale(url: string, vertical: boolean): Promise<number> {
  const size = await new Promise<{ w: number; h: number } | null>((done) => {
    const img = new Image();
    img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => done(null);
    img.src = url;
  });
  if (!size || !size.w || !size.h) return 1;
  const frame = vertical ? 9 / 16 : 16 / 9;
  return Math.min(4, Math.max(1, +(size.w / size.h / frame).toFixed(2)));
}

export function SetPanel({ compact = false, taskChoice, scene, places, props, actors = [], selected, vertical, footageUrl, isVideo, others, onSelect, onChange, onReplace, onUseEverywhere }: {
  compact?: boolean;
  taskChoice?: "surface" | "background" | "objects" | "actors" | "sets" | "lights";
  scene: GreyScene;
  places: BankItem[];
  /** Props you can drop in: your saved accessories with a picture. */
  props: BankItem[];
  actors?: BankItem[];
  selected: string | null;
  vertical: boolean;
  footageUrl: string | null;
  isVideo: boolean;
  others: number;
  onSelect: (id: string | null) => void;
  onChange: (next: GreyScene) => void;
  /** Swaps the whole set at once, without keyframing it. */
  onReplace: (next: GreyScene) => void;
  onUseEverywhere: (set: SavedSet) => void;
}) {
  const [task, setTask] = useState<"surface" | "background" | "objects" | "actors" | "sets" | "lights">("surface");
  useEffect(() => { if (selected && scene.props?.some(p => p.id === selected)) setTask(scene.props.find(p => p.id === selected)?.role === "actor" ? "actors" : "objects"); else if (selected && scene.lights?.some(l => l.id === selected)) setTask("lights"); else if (selected && scene.surfaces?.some(s => s.id === selected)) setTask("surface"); }, [selected]);
  useEffect(() => { if (taskChoice) setTask(taskChoice); }, [taskChoice]);
  const sourcePick = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const propPick = useRef<HTMLInputElement>(null);
  const modelPick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // An upload finishes after the scene may have changed, so it builds on the scene as it is then.
  const live = useRef(scene);
  live.current = scene;
  const [words, setWords] = useState("");
  const bd = scene.backdrop;
  const sel = scene.props?.find((p) => p.id === selected) ?? null;

  async function uploadRoom(file: File | undefined) {
    if (!file) return;
    setBusy("room"); setProblem(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choose a room photo.");
      const result = await uploadFile(file);
      if (!result.ok) throw new Error(result.reason);
      onReplace(replaceRoomSource(live.current, { url: result.url, kind: "image" }));
      setTask("surface"); onSelect(null);
    } catch (e) { setProblem(e instanceof Error ? e.message : "The room photo could not be added."); }
    finally { setBusy(null); }
  }

  async function upload(file: File | undefined, as: "backdrop" | "prop") {
    if (!file) return;
    setBusy(as);
    setProblem(null);
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok) return setProblem(r.reason);
    if (r.kind !== "image") return setProblem("Add a picture.");
    const now = live.current;
    if (as === "backdrop") onChange({ ...now, backdrop: { url: r.url, name: file.name.replace(/\.[^.]+$/, ""), scale: await coverScale(r.url, vertical), x: 0.5, y: 0.5, blur: 0 } });
    else { const result = addUploadedLayer(now, { name: file.name.replace(/\.[^.]+$/, ""), url: r.url }, task === "actors" ? "actor" : "object"); onChange(result.scene); onSelect(result.selected); }
  }

  /** A 3D model for the Blender set. Only on your own computer: the Blender export reads files from the local media folder. */
  async function uploadModel(file: File | undefined, id: string) {
    if (!file) return;
    if (!MODEL_EXT.test(file.name)) return setProblem("Add a glb, gltf, obj or fbx model.");
    setBusy("model");
    setProblem(null);
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok) return setProblem(r.reason);
    onChange(setPropModel(live.current, id, { url: r.url, name: file.name }));
  }

  /** A prop from words: a picture of the object alone on white, then the white cut away. Two steps, each shown in the header. */
  async function makeProp() {
    const text = propPrompt(words);
    if (!text) return;
    setBusy("make");
    setProblem(null);
    const href = window.location.pathname + window.location.search;
    const fail = (x: { ok: boolean; reason?: string }) => (x.ok ? null : (x.reason ?? "It didn't finish."));
    const pic = await track({ label: `Making a prop: ${words.trim().slice(0, 30)}`, href, failure: fail }, () => run("bfl/flux-3-image", text, {})).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "It didn't finish.", needsKey: false }));
    const first = pic.ok ? pic.shots[0] : undefined;
    if (!pic.ok || !first) {
      setBusy(null);
      if ("needsKey" in pic && pic.needsKey) openKeys();
      return setProblem(pic.ok ? "No picture came back." : pic.reason);
    }
    const cut = await track({ label: "Cutting the prop out", href, failure: fail }, () => runWorkflow({ file: JSON.stringify(propCutoutPrompt()) }, {}, { [PROP_INPUT]: first.url })).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "The cut-out didn't finish.", needsKey: false }));
    setBusy(null);
    if (!cut.ok) return setProblem(`The picture is made, but the cut-out didn't finish: ${cut.reason}`);
    const next = addProp(live.current, { name: words.trim().slice(0, 40), url: cut.url });
    onChange(next);
    onSelect(next.props!.at(-1)!.id);
    setWords("");
  }

  return (
    <div className={`gs-panel${compact ? " gw-inspector" : ""}`}>
      <section className="gs-sec gs-source-tools"><div className="gs-surf-head"><h3>Your starting image</h3><button className="pill" disabled={busy !== null} onClick={() => sourcePick.current?.click()}>{busy === "room" ? "Adding…" : footageUrl ? "Change photo" : "Upload a photo"}</button></div><p className="gs-soft">Bring your own room or scene. Changing the photo clears old outlines; your reference cards and placed layers stay.</p><input ref={sourcePick} type="file" accept="image/*" hidden onChange={e => { void uploadRoom(e.target.files?.[0]); e.target.value = ""; }} /></section>
      <div className="gs-edit-choices" role="group" aria-label="What would you like to change?">
        {([ ["surface", "Edit an area"], ["objects", "Furniture & props"], ["actors", "Actors"], ["background", "Background"], ["sets", "Saved looks"], ["lights", "Lights & atmosphere"] ] as const).map(([id, label]) => <button key={id} className={`pill${task === id ? " on" : ""}`} aria-pressed={task === id} onClick={() => setTask(id)}>{label}</button>)}

      </div>
      {task === "lights" && <LightPanel compact={compact} scene={scene} selected={selected} onSelect={onSelect} onChange={onChange} />}
      {!compact && <ReferenceBoard selected={selected} scene={scene} onChange={onChange} onEdit={(id, kind) => { setTask(kind ?? "surface"); onSelect(id ?? null); }} />}
      {task === "background" && <section className="gs-sec">
        <h3>Background reference</h3>
        <p className="gs-soft">Choose the place around your subject. Cut out the subject first to reveal this background.</p>
        {places.length > 0 && (
          <ul className="gs-places">
            {places.filter((p) => p.image).map((p) => (
              <li key={p.id}>
                <button className={`gs-place${scene.place === p.id ? " on" : ""}`} aria-pressed={scene.place === p.id} onClick={async () => onChange(scene.place === p.id ? { ...scene, place: undefined as never, backdrop: undefined as never } : { ...scene, place: p.id, backdrop: { url: p.image!, name: p.name, scale: await coverScale(p.image!, vertical), x: 0.5, y: 0.5, blur: 0 } })}>
                  <img src={p.image!} alt="" />
                  <b>{p.name}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="gs-row">
          <button className="pill" disabled={busy === "backdrop"} onClick={() => pick.current?.click()}>{busy === "backdrop" ? "Adding…" : "Add a picture"}</button>
          <BuildLink className="pill" href="/locations" label="the Grey Room">Make a new place</BuildLink>
          <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0], "backdrop"); e.target.value = ""; }} />
        </div>
        {bd && (
          <div className="gs-sliders">
            <Slide label="Zoom" min={1} max={4} step={0.05} value={bd.scale} onChange={(v) => onChange({ ...scene, backdrop: { ...bd, scale: v } })} />
            <Slide label="Across" min={0} max={1} step={0.01} value={bd.x} onChange={(v) => onChange({ ...scene, backdrop: { ...bd, x: v } })} />
            <Slide label="Down" min={0} max={1} step={0.01} value={bd.y} onChange={(v) => onChange({ ...scene, backdrop: { ...bd, y: v } })} />
            <Slide label="Soft focus" min={0} max={1} step={0.01} value={bd.blur} onChange={(v) => onChange({ ...scene, backdrop: { ...bd, blur: v } })} />
            <button className="plain" onClick={() => onChange({ ...scene, backdrop: undefined as never, place: undefined as never })}>Remove the background</button>
          </div>
        )}
        {!scene.matte && bd && <p className="gs-soft">Use Cut out first to see them in this place.</p>}
      </section>}

      {task === "surface" && <SurfacesPanel scene={scene} footageUrl={footageUrl} isVideo={isVideo} references={[...(scene.references ?? []).map(r => ({ ...r, image: r.url })), ...places, ...props]} onChange={onChange} />}

      {(task === "objects" || task === "actors") && <section className="gs-sec">
        {compact && !sel && <div className="gw-empty-inspector"><StudioIcon name="cube" size={32}/><h3>Build your scene</h3><p>Drag an asset into the picture. Select it to move, resize, or swap it.</p></div>}
        {sel && (
          <div className="gs-sliders" aria-label={`${sel.name} controls`}>
            <div className="gw-selected-object"><img src={sel.url} alt=""/><div><h3>{sel.name}</h3><p>Image layer · {sel.role === "actor" ? "Character" : "Object"}</p></div></div><div className="gw-transform-title"><h4>Transform</h4></div>
            <button className="pill" disabled={sel.locked} onClick={() => onChange(updateProp(scene, sel.id, {x:.5,y:.5,w:.25,rotate:0}))}>Reset transform</button>
            <Slide disabled={sel.locked} label="Position X (%)" min={0} max={100} step={0.1} value={sel.x*100} onChange={v => onChange(updateProp(scene, sel.id, { x: v/100 }))} />
            <Slide disabled={sel.locked} label="Position Y (%)" min={0} max={100} step={0.1} value={sel.y*100} onChange={v => onChange(updateProp(scene, sel.id, { y: v/100 }))} />
            <Slide disabled={sel.locked} label="Width (%)" min={3} max={150} step={0.1} value={sel.w*100} onChange={(v) => onChange(updateProp(scene, sel.id, { w: v/100 }))} />
            <Slide disabled={sel.locked} label="Turn" min={0} max={359} step={1} value={sel.rotate} onChange={(v) => onChange(updateProp(scene, sel.id, { rotate: v }))} />
            <Slide disabled={sel.locked} label="Opacity" min={0.1} max={1} step={0.01} value={sel.opacity} onChange={(v) => onChange(updateProp(scene, sel.id, { opacity: v }))} />
            <Slide disabled={sel.locked} label="Shadow" min={0} max={1} step={0.05} value={propShadow(sel)} onChange={(v) => onChange(updateProp(scene, sel.id, { shadow: v }))} />
            <div className="gs-row">
              <button className={`pill${sel.behind ? " on" : ""}`} aria-pressed={sel.behind} onClick={() => onChange(updateProp(scene, sel.id, { behind: !sel.behind }))}>Behind the actor</button>
              <button className={`pill${sel.flip ? " on" : ""}`} aria-pressed={sel.flip === true} onClick={() => onChange(updateProp(scene, sel.id, { flip: !sel.flip }))}>Flip</button>
            </div>
            {process.env.NEXT_PUBLIC_HOSTED !== "1" && (
              <details className="gw-model-tools"><summary>3D model attachment</summary><div className="gs-row">
                <button className="pill" disabled={busy === "model"} onClick={() => modelPick.current?.click()}>{busy === "model" ? "Adding…" : sel.model ? "Change 3D model" : "Add a 3D model"}</button>
                {sel.model && <button className="plain" onClick={() => onChange(setPropModel(scene, sel.id, null))}>Remove {sel.model.name}</button>}
                <input ref={modelPick} type="file" accept=".glb,.gltf,.obj,.fbx" hidden onChange={(e) => { void uploadModel(e.target.files?.[0], sel.id); e.target.value = ""; }} />
                <small className="gs-soft">For the Blender set only. The picture above is still what you see here.</small>
              </div></details>
            )}
          </div>
        )}
      <details open={compact ? undefined : true}><summary>{sel ? "Swap image, add assets & layers" : "Add an object"}</summary>
        <h3>{task === "actors" ? "Place an actor" : "Furniture & props"}</h3>
        <p className="gs-soft">{task === "actors" ? "Choose a saved character or upload an actor cut-out. Drag to place them, then adjust size and depth. A character sheet stays a flat image; use a transparent single-pose cut-out for compositing." : "Bring in a couch, table, lamp or other saved accessory. Drag to place it. Use a transparent cut-out; a full photograph appears as a rectangle."}</p>
        <p className="gs-soft">{sel ? `Click a thumbnail to swap ${sel.name}, or drag to add another.` : "Click to add. Drag onto the scene to choose its position."}</p>{sel && <button className="pill" onClick={() => onSelect(null)}>Add another instead</button>}
        <div className="gs-shelf">
          {(task === "actors" ? actors : props).map((p) => (
            <button key={p.id} className="gs-prop" title={p.name} draggable onDragStart={e => { e.dataTransfer.setData("application/x-haggs-asset", JSON.stringify({url:p.image!,name:p.name,role:task === "actors" ? "actor" : "object"})); e.dataTransfer.effectAllowed="copy"; }} onClick={() => { const next = sel ? updateProp(scene, sel.id, { name: p.name, url: p.image! }) : addProp(scene, { name: p.name, url: p.image! }); const id = sel?.id ?? next.props!.at(-1)!.id; onChange(updateProp(next, id, { role: task === "actors" ? "actor" : "object" })); onSelect(id); }}>
              <img src={p.image!} alt="" /><span>{p.name}</span>
            </button>
          ))}
          <button className="gs-prop add" disabled={busy === "prop"} onClick={() => propPick.current?.click()}><b>+</b><span>{busy === "prop" ? "Adding…" : task === "actors" ? "Upload actor" : "Upload object"}</span></button>
          <input ref={propPick} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0], "prop"); e.target.value = ""; }} />
        </div>
        {task !== "actors" && <div className="gs-row" aria-label="Furniture prompt starters">{[{ name: "Couch", words: "a contemporary cream boucle sofa, isolated full object" }, { name: "Table", words: "a walnut coffee table, isolated full object" }, { name: "Lamp", words: "a sculptural brass floor lamp, isolated full object" }, { name: "Chair", words: "a mid-century lounge chair, isolated full object" }].map(p => <button className="pill" key={p.name} onClick={() => setWords(p.words)}>{p.name}</button>)}</div>}
        {task !== "actors" && <label className="gs-field">
          Make one from words
          <div className="gs-row">
            <input className="gs-name" type="text" maxLength={200} value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void makeProp(); }} placeholder="a worn leather armchair" />
            <button className="pill on" disabled={busy !== null || !words.trim()} onClick={() => void makeProp()}>{busy === "make" ? "Making…" : "Make it"} <span className="cost">about ${editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }).toFixed(2)}</span></button>
          </div>
          <small>One picture, then the background is cut away. The cut-out is free apart from GPU time.</small>
        </label>
        }
        <BuildLink className="plain" href={task === "actors" ? "/characters" : "/accessories"} label="the Grey Room">{task === "actors" ? "Open character builder" : "Build a couch, table or other accessory"}</BuildLink>
        <p className="gs-soft">A prop is a flat picture, so it can't turn to show another side. Pictures with a clear background sit best.</p>

        {(scene.props ?? []).length > 0 && (
          <ul className="gs-layers" aria-label="Props in the scene">
            {[...(scene.props ?? [])].reverse().map((p) => (
              <li key={p.id} className={p.id === selected ? "on" : ""}>
                <button className="gs-lname" onClick={() => onSelect(p.id === selected ? null : p.id)}>{p.name}{p.behind ? " · behind" : ""}</button>
                <span className="gs-lact">
                  <button aria-label={p.hidden ? "Show" : "Hide"} title={p.hidden ? "Show" : "Hide"} onClick={() => onChange(updateProp(scene, p.id, { hidden: !p.hidden }))}>{p.hidden ? "○" : "●"}</button>
                  <button aria-label={p.locked ? "Unlock" : "Lock"} title={p.locked ? "Unlock" : "Lock"} onClick={() => onChange(updateProp(scene, p.id, { locked: !p.locked }))}>{p.locked ? "🔒" : "🔓"}</button>
                  <button aria-label="Forward" title="Forward" onClick={() => onChange(shiftLayer(scene, p.id, 1))}>↑</button>
                  <button aria-label="Back" title="Back" onClick={() => onChange(shiftLayer(scene, p.id, -1))}>↓</button>
                  <button aria-label="Delete" title="Delete" onClick={() => { onChange(removeProp(scene, p.id)); if (selected === p.id) onSelect(null); }}>×</button>
                </span>
              </li>
            ))}
          </ul>
        )}


      </details></section>}
      {task === "sets" && <SetsPanel scene={scene} others={others} onUse={onReplace} onUseEverywhere={onUseEverywhere} />}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}

export function Slide({ label, min, max, step, value, onChange, disabled = false }: { disabled?: boolean | undefined; label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="gs-slide">
      <span>{label}</span>
      <input disabled={disabled} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <input disabled={disabled} className="gw-number" type="number" aria-label={`${label} value`} min={min} max={max} step={step} value={Number(value.toFixed(3))} onChange={e => { const n=e.target.valueAsNumber; if(Number.isFinite(n)) onChange(Math.max(min,Math.min(max,n))); }} />
    </label>
  );
}
