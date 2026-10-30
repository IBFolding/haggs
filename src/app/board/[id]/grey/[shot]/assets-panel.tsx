"use client";

import { useRef, useState } from "react";

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
import type { SavedSet } from "../../../../../story/set-bank";
import { addProp, replaceRoomSource, updateProp, type GreyScene } from "../../../../../story/grey-scene";
import { LightsTab } from "./light-panel";
import { ReferenceBoard } from "./reference-board";
import { SetsPanel } from "./sets-panel";
import { SurfacesPanel } from "./surfaces-panel";

export type AssetTab = "room" | "objects" | "actors" | "surfaces" | "lights";
export const ASSET_TABS: { id: AssetTab; label: string }[] = [
  { id: "room", label: "Room" },
  { id: "objects", label: "Objects" },
  { id: "actors", label: "Actors" },
  { id: "surfaces", label: "Areas" },
  { id: "lights", label: "Lights" },
];

/** How many frame-widths wide a picture must be to fill the whole frame, so a wide room in a tall frame doesn't leave bars. */
export async function coverScale(url: string, vertical: boolean): Promise<number> {
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

const STARTERS = [
  { name: "Couch", words: "a contemporary cream boucle sofa, isolated full object" },
  { name: "Table", words: "a walnut coffee table, isolated full object" },
  { name: "Lamp", words: "a sculptural brass floor lamp, isolated full object" },
  { name: "Chair", words: "a mid-century lounge chair, isolated full object" },
];

/**
 * The shelf on the left: everything you can bring into the picture, one tab per kind.
 * It stays mounted while you change tabs, so an upload or a prop being made is never lost.
 */
export function AssetsPanel({ tab, onTab, scene, places, props, actors, vertical, footageUrl, isVideo, others, selected, onSelect, onChange, onReplace, onUseEverywhere, cutout }: {
  tab: AssetTab;
  onTab: (t: AssetTab) => void;
  scene: GreyScene;
  places: BankItem[];
  /** Props you can drop in: your saved accessories with a picture. */
  props: BankItem[];
  actors: BankItem[];
  vertical: boolean;
  footageUrl: string | null;
  isVideo: boolean;
  others: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: GreyScene) => void;
  /** Swaps the whole set at once, without keyframing it. */
  onReplace: (next: GreyScene) => void;
  onUseEverywhere: (set: SavedSet) => void;
  /** The cut-out controls, shown at the top of the Actors tab. */
  cutout: React.ReactNode;
}) {
  const sourcePick = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const propPick = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [words, setWords] = useState("");
  // An upload finishes after the scene may have changed, so it builds on the scene as it is then.
  const live = useRef(scene);
  live.current = scene;
  const bd = scene.backdrop;
  const sel = scene.props?.find((p) => p.id === selected) ?? null;
  const kind = tab === "actors" ? "actor" : "object";

  async function uploadRoom(file: File | undefined) {
    if (!file) return;
    setBusy("room"); setProblem(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choose a room photo.");
      const result = await uploadFile(file);
      if (!result.ok) throw new Error(result.reason);
      onReplace(replaceRoomSource(live.current, { url: result.url, kind: "image" }));
      onTab("surfaces"); onSelect(null);
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
    if (as === "backdrop") { onChange({ ...now, backdrop: { url: r.url, name: file.name.replace(/\.[^.]+$/, ""), scale: await coverScale(r.url, vertical), x: 0.5, y: 0.5, blur: 0 } }); onSelect("backdrop"); }
    else { const result = addUploadedLayer(now, { name: file.name.replace(/\.[^.]+$/, ""), url: r.url }, kind); onChange(result.scene); onSelect(result.selected); }
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

  function shelf() {
    const items = kind === "actor" ? actors : props;
    return (
      <section className="gs-sec">
        <h3>{kind === "actor" ? "Place an actor" : "Furniture & props"}</h3>
        <p className="gs-soft">{kind === "actor" ? "Choose a saved character or upload an actor cut-out. Drag to place them, then adjust size and depth. A character sheet stays a flat image; use a transparent single-pose cut-out for compositing." : "Bring in a couch, table, lamp or other saved accessory. Drag to place it. Use a transparent cut-out; a full photograph appears as a rectangle."}</p>
        <p className="gs-soft">{sel ? `Click a thumbnail to swap ${sel.name}, or drag to add another.` : "Click to add. Drag onto the scene to choose its position."}</p>
        {sel && <button className="pill" onClick={() => onSelect(null)}>Add another instead</button>}
        <div className="gs-shelf">
          {items.map((p) => (
            <button key={p.id} className="gs-prop" title={p.name} draggable onDragStart={(e) => { e.dataTransfer.setData("application/x-haggs-asset", JSON.stringify({ url: p.image!, name: p.name, role: kind })); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => { const next = sel ? updateProp(scene, sel.id, { name: p.name, url: p.image! }) : addProp(scene, { name: p.name, url: p.image! }); const id = sel?.id ?? next.props!.at(-1)!.id; onChange(updateProp(next, id, { role: kind })); onSelect(id); }}>
              <img src={p.image!} alt="" /><span>{p.name}</span>
            </button>
          ))}
          <button className="gs-prop add" disabled={busy === "prop"} onClick={() => propPick.current?.click()}><b>+</b><span>{busy === "prop" ? "Adding…" : kind === "actor" ? "Upload actor" : "Upload object"}</span></button>
          <input ref={propPick} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0], "prop"); e.target.value = ""; }} />
        </div>
        {kind !== "actor" && <div className="gs-row" aria-label="Furniture prompt starters">{STARTERS.map((p) => <button className="pill" key={p.name} onClick={() => setWords(p.words)}>{p.name}</button>)}</div>}
        {kind !== "actor" && (
          <label className="gs-field">
            Make one from words
            <div className="gs-row">
              <input className="gs-name" type="text" maxLength={200} value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void makeProp(); }} placeholder="a worn leather armchair" />
              <button className="pill on" disabled={busy !== null || !words.trim()} onClick={() => void makeProp()}>{busy === "make" ? "Making…" : "Make it"} <span className="cost">about ${editEstimate({ tool: "flux3", seconds: 0, resolution: "1K" }).toFixed(2)}</span></button>
            </div>
            <small>One picture, then the background is cut away. The cut-out is free apart from GPU time.</small>
          </label>
        )}
        <BuildLink className="plain" href={kind === "actor" ? "/characters" : "/accessories"} label="the Grey Room">{kind === "actor" ? "Open character builder" : "Build a couch, table or other accessory"}</BuildLink>
        <p className="gs-soft">A prop is a flat picture, so it can't turn to show another side. Pictures with a clear background sit best.</p>
      </section>
    );
  }

  const board = <ReferenceBoard selected={selected} scene={scene} onChange={onChange} onEdit={(id, k) => { onTab(k === "objects" ? (scene.props?.find((p) => p.id === id)?.role === "actor" ? "actors" : "objects") : "surfaces"); onSelect(id ?? null); }} />;

  return (
    <div className="gw-assets">
      <div className="gw-tabs" role="tablist" aria-label="Library">
        {ASSET_TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => onTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="gw-assets-body gs-panel">
        {tab === "room" && (
          <>
            <section className="gs-sec gs-source-tools">
              <div className="gs-surf-head"><h3>Your starting image</h3><button className="pill" disabled={busy !== null} onClick={() => sourcePick.current?.click()}>{busy === "room" ? "Adding…" : footageUrl ? "Change photo" : "Upload a photo"}</button></div>
              <p className="gs-soft">Bring your own room or scene. Changing the photo clears old outlines; your reference cards and placed layers stay.</p>
              <input ref={sourcePick} type="file" accept="image/*" hidden onChange={(e) => { void uploadRoom(e.target.files?.[0]); e.target.value = ""; }} />
            </section>
            <section className="gs-sec">
              <h3>Background</h3>
              <p className="gs-soft">Choose the place around your subject. Cut out the subject first to reveal this background.</p>
              {places.length > 0 && (
                <ul className="gs-places">
                  {places.filter((p) => p.image).map((p) => (
                    <li key={p.id}>
                      <button className={`gs-place${scene.place === p.id ? " on" : ""}`} aria-pressed={scene.place === p.id} onClick={async () => { if (scene.place === p.id) { onChange({ ...scene, place: undefined as never, backdrop: undefined as never }); onSelect(null); } else { onChange({ ...scene, place: p.id, backdrop: { url: p.image!, name: p.name, scale: await coverScale(p.image!, vertical), x: 0.5, y: 0.5, blur: 0 } }); onSelect("backdrop"); } }}>
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
              {bd && <div className="gs-row"><button className={`pill${selected === "backdrop" ? " on" : ""}`} onClick={() => onSelect(selected === "backdrop" ? null : "backdrop")}>Zoom and position</button><button className="plain" onClick={() => { onChange({ ...scene, backdrop: undefined as never, place: undefined as never }); if (selected === "backdrop") onSelect(null); }}>Remove the background</button></div>}
              {!scene.matte && bd && <p className="gs-soft">Use Cut out first to see them in this place.</p>}
            </section>
            <SetsPanel scene={scene} others={others} onUse={onReplace} onUseEverywhere={onUseEverywhere} />
          </>
        )}

        {tab === "objects" && (
          <>
            {shelf()}
            {board}
          </>
        )}

        {tab === "actors" && (
          <>
            {cutout}
            {shelf()}
          </>
        )}

        {tab === "surfaces" && (
          <>
            <SurfacesPanel mode="list" scene={scene} footageUrl={footageUrl} isVideo={isVideo} references={[]} onChange={onChange} selected={selected} onSelect={onSelect} />
            {board}
          </>
        )}

        {tab === "lights" && <LightsTab scene={scene} selected={selected} onSelect={onSelect} onChange={onChange} />}

        {problem && <p className="library-error" role="alert">{problem}</p>}
      </div>
    </div>
  );
}
