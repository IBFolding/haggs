"use client";
import { useRef, useState } from "react";
import { addRoomReference, assignObjectReference, assignSurfaceReference, removeRoomReference, referenceUses, updateProp, type GreyScene, type RoomReference } from "../../../../../story/grey-scene";
import { uploadFile } from "../../../../upload-client";

export function ReferenceBoard({ scene, onChange, onEdit }: { scene: GreyScene; onChange: (scene: GreyScene) => void; onEdit: (objectId?: string) => void }) {
  const picker = useRef<HTMLInputElement>(null);
  const live = useRef(scene); live.current = scene;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
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
    const target = targets[ref.id] ?? "Floor";
    const actor = target === "actor:";
    const object = target.startsWith("object:") || actor;
    let next = object ? assignObjectReference(live.current, actor ? null : target.slice(7) || null, ref) : assignSurfaceReference(live.current, target, ref);
    if (actor) next = updateProp(next, next.props!.at(-1)!.id, { role: "actor" });
    live.current = next; onChange(next); onEdit(object ? (target.slice(7) || next.props!.at(-1)!.id) : undefined);
  }
  return <section className="gs-sec gs-moodboard" aria-label="Room reference board">
    <div className="gs-surf-head"><div><span className="gs-board-kicker">YOUR CREATIVE DIRECTION</span><h3>Mood board <span className="gs-board-count">{scene.references?.length ?? 0}</span></h3></div><button className="pill on" disabled={busy || (scene.references?.length ?? 0) >= 60} onClick={() => picker.current?.click()}>{busy ? "Adding…" : "+ Add photos"}</button></div>
    <p className="gs-soft">Your references. One room. Choose where each idea belongs.</p>
    <input ref={picker} type="file" multiple accept="image/*" hidden onChange={e => { void upload(e.target.files); e.target.value = ""; }} />
    {!scene.references?.length && <div className="gs-board-welcome">
      <img src="/grey-room/room-inspiration.webp" alt="Warm contemporary room with natural materials" />
      <span className="gs-board-example">Style inspiration · AI image</span>
      <div><strong>Start with a feeling.</strong><p>Add a material close-up or a cut-out object. Then assign it to your room.</p><button className="pill on" disabled={busy} onClick={() => picker.current?.click()}>Add your first reference</button></div>
    </div>}
    {!scene.references?.length && <div className="gs-starter-materials"><span>Or try a sample material</span><div>{[{ name: "Smoked oak", url: "/grey-room/smoked-oak.webp" }, { name: "Ivory travertine", url: "/grey-room/travertine.webp" }].map(ref => <button key={ref.url} disabled={busy} onClick={() => void addSample(ref)}><img src={ref.url} alt="" /><span>{ref.name}</span><b aria-hidden="true">+</b></button>)}</div></div>}
    <div className="gs-board-steps" aria-label="Mood board steps"><span><b>1</b> Collect</span><span><b>2</b> Assign</span><span><b>3</b> Review</span></div>
    <div className="gs-reference-cards">{scene.references?.map(ref => {
      const uses = referenceUses(scene, ref.url);
      return <article className={`gs-reference-card${uses.length ? " assigned" : ""}`} key={ref.id}>
        <div className="gs-reference-image"><img src={ref.url} alt={ref.name} /><button className="gs-card-remove" title="Remove card (keeps assigned edits)" aria-label={`Remove ${ref.name} from board`} onClick={() => { const next = removeRoomReference(live.current, ref.id); live.current = next; onChange(next); }}>×</button></div><strong>{ref.name}</strong>
        <span className="gs-reference-use">{uses.length ? `Used on: ${uses.join(", ")}` : "Ready to assign"}</span>
        <label>Use on<select aria-label={`Use ${ref.name} on`} value={targets[ref.id] ?? "Floor"} onChange={e => setTargets({ ...targets, [ref.id]: e.target.value })}>
          {(scene.surfaces ?? []).map(s => <option key={s.id} value={s.id}>{s.label} · swap material</option>)}
          {(scene.props ?? []).map(p => <option key={p.id} value={`object:${p.id}`}>{p.name} · swap object image</option>)}
          <option value="object:">New furniture / object layer</option><option value="actor:">New actor layer</option>
          <option value="Floor">Floor</option><option value="Wall">Wall</option><option value="Door">Door</option><option value="Window">Window</option><option value="Sofa">Sofa upholstery</option><option value="Table">Table surface</option><option value="Other surface">Another surface</option>
        </select></label>
        <button className="pill" onClick={() => assign(ref)}>Apply reference <span aria-hidden="true">↗</span></button>
        {(["object:", "actor:"].some(prefix => (targets[ref.id] ?? "").startsWith(prefix))) && <small>Use a transparent cut-out. A full photo appears as a rectangular layer.</small>}
      </article>;
    })}</div>
    {error && <p role="alert" className="library-error">{error}</p>}
  </section>;
}
