"use client";
import { useRef, useState } from "react";
import { addRoomReference, removeRoomReference, referenceUses, type GreyScene, type RoomReference } from "../../../../../story/grey-scene";
import { applyTrayReference } from "../../../../../story/grey-tray";
import { uploadFile } from "../../../../upload-client";

export function ReferenceBoard({ scene, selected, onChange, onEdit }: { scene: GreyScene; selected?: string | null; onChange: (scene: GreyScene) => void; onEdit: (id?: string, kind?: "objects" | "surface") => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const live = useRef(scene); live.current = scene;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState("Floor");
  const activeTarget = scene.props?.some(p => p.id === selected) ? `object:${selected}` : scene.surfaces?.some(s => s.id === selected) ? selected! : scene.surfaces?.find(s => s.label === target)?.id ?? target;
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        if ((live.current.references?.length ?? 0) >= 60) throw new Error("This board holds 60 references. Remove a card before adding more.");
        if (!file.type.startsWith("image/")) throw new Error("Choose image references.");
        const result = await uploadFile(file);
        if (!result.ok) throw new Error(result.reason);
        if (result.kind !== "image") throw new Error("Choose image references.");
        const next = addRoomReference(live.current, { url: result.url, name: file.name.replace(/\.[^.]+$/, "") });
        live.current = next; onChange(next);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Upload did not finish."); }
    finally { setBusy(false); }
  }
  async function addSample(ref: { name: string; url: string }) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(ref.url);
      if (!response.ok) throw new Error("The sample could not be loaded.");
      const result = await uploadFile(new File([await response.blob()], `${ref.name}.webp`, { type: "image/webp" }));
      if (!result.ok) throw new Error(result.reason);
      const next = addRoomReference(live.current, { name: ref.name, url: result.url });
      live.current = next; onChange(next);
    } catch (e) { setError(e instanceof Error ? e.message : "The sample could not be added."); }
    finally { setBusy(false); }
  }
  function assign(ref: RoomReference) {
    const result = applyTrayReference(live.current, activeTarget, ref);
    setTarget(result.kind === "surface" ? result.selected : `object:${result.selected}`);
    live.current = result.scene; onChange(result.scene); onEdit(result.selected, result.kind);
  }
  return <section className="gs-sec gs-moodboard" aria-label="Room reference board">
    <div className="gs-surf-head"><div><span className="gs-board-kicker">YOUR CREATIVE DIRECTION</span><h3>Mood board <span className="gs-board-count">{scene.references?.length ?? 0}</span></h3></div><button className="pill on" disabled={busy || (scene.references?.length ?? 0) >= 60} onClick={() => picker.current?.click()}>{busy ? "Adding…" : "+ Add photos"}</button></div>
    <p className="gs-soft">Pick a target once, then click thumbnails to audition looks. Drag a card onto the scene to place it, or onto an object to swap it.</p>
    <input ref={picker} type="file" multiple accept="image/*" hidden onChange={e => { void upload(e.target.files); e.target.value = ""; }} />
    {!scene.references?.length && <div className="gs-board-welcome">
      <img src="/grey-room/room-inspiration.webp" alt="Warm contemporary room with natural materials" />
      <span className="gs-board-example">Style inspiration · AI image</span>
      <div><strong>Start with a feeling.</strong><p>Add a material close-up or a cut-out object. Then assign it to your room.</p><button className="pill on" disabled={busy} onClick={() => picker.current?.click()}>Add your first reference</button></div>
    </div>}
    {!scene.references?.length && <div className="gs-starter-materials"><span>Or try a sample material</span><div>{[{ name: "Smoked oak", url: "/grey-room/smoked-oak.webp" }, { name: "Ivory travertine", url: "/grey-room/travertine.webp" }].map(ref => <button key={ref.url} disabled={busy} onClick={() => void addSample(ref)}><img src={ref.url} alt="" /><span>{ref.name}</span><b aria-hidden="true">+</b></button>)}</div></div>}
    <div className="gs-tray-targets" aria-label="Reference target">
      <span>Apply to</span>
      {[...(scene.surfaces ?? []).map(s => ({id:s.id,name:s.label})), ...[{id:"Floor",name:"Floor"},{id:"Wall",name:"Wall"},{id:"Door",name:"Door"},{id:"Window",name:"Window"}].filter(t => !scene.surfaces?.some(s => s.label === t.name)), {id:"object:",name:"New object"},{id:"actor:",name:"New actor"}].map(t => <button className={`pill${activeTarget === t.id ? " on" : ""}`} key={t.id} aria-pressed={activeTarget === t.id} onClick={() => { setTarget(t.id); onEdit(); }}>{t.name}</button>)}
      {selected && scene.props?.some(p => p.id === selected) && <strong>Swap {scene.props.find(p => p.id === selected)?.name}</strong>}
    </div>
    <div className="gs-reference-cards">{scene.references?.map(ref => {
      const uses = referenceUses(scene, ref.url);
      return <article className={`gs-reference-card${uses.length ? " assigned" : ""}`} key={ref.id}>
        <button className="gs-reference-pick" draggable onDragStart={e => { e.dataTransfer.setData("application/x-haggs-asset", JSON.stringify({url:ref.url,name:ref.name,role:activeTarget === "actor:" ? "actor" : "object"})); e.dataTransfer.effectAllowed="copy"; }} onClick={() => assign(ref)} aria-label={`Use ${ref.name}`}><img src={ref.url} alt="" draggable={false} /><strong>{ref.name}</strong></button>
        <span className="gs-reference-use">{uses.length ? `Used on: ${uses.join(", ")}` : "Click to try · drag to place"}</span>
        <button className="gs-card-remove" title="Remove card (keeps assigned edits)" aria-label={`Remove ${ref.name} from board`} onClick={() => { const next = removeRoomReference(live.current, ref.id); live.current = next; onChange(next); }}>×</button>
      </article>;
    })}</div>
    {error && <p role="alert" className="library-error">{error}</p>}
  </section>;
}
