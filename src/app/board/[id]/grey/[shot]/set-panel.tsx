"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { propCutoutPrompt, propPrompt, PROP_INPUT } from "../../../../../comfy/prop-cutout";
import { editEstimate } from "../../../../../providers/cloud-edits";
import { run } from "../../../../actions";
import { openKeys } from "../../../../nav";
import { runWorkflow } from "../../../../workflow-actions";
import { uploadFile } from "../../../../upload-client";
import { BuildLink } from "../../../../return-bar";
import type { BankItem } from "../../../../../story/bank";
import { SetsPanel } from "./sets-panel";
import { SurfacesPanel } from "./surfaces-panel";
import type { SavedSet } from "../../../../../story/set-bank";
import { MODEL_EXT, addProp, propShadow, removeProp, setPropModel, shiftLayer, updateProp, type GreyScene } from "../../../../../story/grey-scene";

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

export function SetPanel({ scene, places, props, selected, vertical, footageUrl, isVideo, others, onSelect, onChange, onReplace, onUseEverywhere }: {
  scene: GreyScene;
  places: BankItem[];
  /** Props you can drop in: your saved accessories with a picture. */
  props: BankItem[];
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
  const [task, setTask] = useState<"surface" | "background" | "objects" | "sets">("surface");
  useEffect(() => { if (selected) setTask("objects"); }, [selected]);
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
    else onChange(addProp(now, { name: file.name.replace(/\.[^.]+$/, ""), url: r.url }));
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
    <div className="gs-panel">
      <div className="gs-edit-choices" role="group" aria-label="What would you like to change?">
        {([ ["surface", "Floor or wall"], ["background", "Background"], ["objects", "Add an object"], ["sets", "Saved looks"] ] as const).map(([id, label]) => <button key={id} className={`pill${task === id ? " on" : ""}`} aria-pressed={task === id} onClick={() => setTask(id)}>{label}</button>)}
      </div>
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

      {task === "surface" && <SurfacesPanel scene={scene} footageUrl={footageUrl} isVideo={isVideo} references={[...places, ...props]} onChange={onChange} />}

      {task === "objects" && <section className="gs-sec">
        <h3>Add an object</h3>
        <p className="gs-soft">Choose a cut-out object to place in the scene. A full photograph becomes a rectangular layer; it does not replace a floor or wall. Use Floor or wall for material changes.</p>
        <div className="gs-shelf">
          {props.map((p) => (
            <button key={p.id} className="gs-prop" title={p.name} onClick={() => { const next = addProp(scene, { name: p.name, url: p.image! }); onChange(next); onSelect(next.props!.at(-1)!.id); }}>
              <img src={p.image!} alt="" /><span>{p.name}</span>
            </button>
          ))}
          <button className="gs-prop add" disabled={busy === "prop"} onClick={() => propPick.current?.click()}><b>+</b><span>{busy === "prop" ? "Adding…" : "Add a flat layer"}</span></button>
          <input ref={propPick} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0], "prop"); e.target.value = ""; }} />
        </div>
        <label className="gs-field">
          Make one from words
          <div className="gs-row">
            <input className="gs-name" type="text" maxLength={200} value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void makeProp(); }} placeholder="a worn leather armchair" />
            <button className="pill on" disabled={busy !== null || !words.trim()} onClick={() => void makeProp()}>{busy === "make" ? "Making…" : "Make it"} <span className="cost">about ${editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }).toFixed(2)}</span></button>
          </div>
          <small>One picture, then the background is cut away. The cut-out is free apart from GPU time.</small>
        </label>
        <BuildLink className="plain" href="/accessories" label="the Grey Room">Or build a prop to keep</BuildLink>
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

        {sel && (
          <div className="gs-sliders" aria-label={`${sel.name} controls`}>
            <Slide label="Size" min={0.03} max={1.5} step={0.01} value={sel.w} onChange={(v) => onChange(updateProp(scene, sel.id, { w: v }))} />
            <Slide label="Turn" min={0} max={359} step={1} value={sel.rotate} onChange={(v) => onChange(updateProp(scene, sel.id, { rotate: v }))} />
            <Slide label="Opacity" min={0.1} max={1} step={0.01} value={sel.opacity} onChange={(v) => onChange(updateProp(scene, sel.id, { opacity: v }))} />
            <Slide label="Shadow" min={0} max={1} step={0.05} value={propShadow(sel)} onChange={(v) => onChange(updateProp(scene, sel.id, { shadow: v }))} />
            <div className="gs-row">
              <button className={`pill${sel.behind ? " on" : ""}`} aria-pressed={sel.behind} onClick={() => onChange(updateProp(scene, sel.id, { behind: !sel.behind }))}>Behind the actor</button>
              <button className={`pill${sel.flip ? " on" : ""}`} aria-pressed={sel.flip === true} onClick={() => onChange(updateProp(scene, sel.id, { flip: !sel.flip }))}>Flip</button>
            </div>
            {process.env.NEXT_PUBLIC_HOSTED !== "1" && (
              <div className="gs-row">
                <button className="pill" disabled={busy === "model"} onClick={() => modelPick.current?.click()}>{busy === "model" ? "Adding…" : sel.model ? "Change 3D model" : "Add a 3D model"}</button>
                {sel.model && <button className="plain" onClick={() => onChange(setPropModel(scene, sel.id, null))}>Remove {sel.model.name}</button>}
                <input ref={modelPick} type="file" accept=".glb,.gltf,.obj,.fbx" hidden onChange={(e) => { void uploadModel(e.target.files?.[0], sel.id); e.target.value = ""; }} />
                <small className="gs-soft">For the Blender set only. The picture above is still what you see here.</small>
              </div>
            )}
          </div>
        )}
      </section>}
      {task === "sets" && <SetsPanel scene={scene} others={others} onUse={onReplace} onUseEverywhere={onUseEverywhere} />}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}

export function Slide({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="gs-slide">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
