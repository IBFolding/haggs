"use client";

import { useState } from "react";

import type { BankItem } from "../../../../../story/bank";
import { addUploadedLayer } from "../../../../../story/grey-tray";
import { addProp, type GreyScene } from "../../../../../story/grey-scene";
import { DropZone } from "../../../../drop-zone";
import { uploadFile } from "../../../../upload-client";
import { Collapsible } from "./collapsible";

/** Everything in the picture, in one list: pick one to work on it. Plus a spot to drop in more images. */
export function LayersPanel({ scene, selected, onSelect, onChange, accessories }: { scene: GreyScene; selected: string | null; onSelect: (id: string | null) => void; onChange: (next: GreyScene) => void; accessories: BankItem[] }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rows: { id: string; name: string; kind: string }[] = [
    ...(scene.props ?? []).map((p) => ({ id: p.id, name: p.name, kind: p.role === "actor" ? "Actor" : "Object" })),
    ...(scene.lights ?? []).map((l) => ({ id: l.id, name: `${l.kind[0]!.toUpperCase()}${l.kind.slice(1)} light`, kind: "Light" })),
    ...(scene.backdrop ? [{ id: "backdrop", name: `Background · ${scene.backdrop.name}`, kind: "Room" }] : []),
  ];
  async function addFile(file: File) {
    setBusy(true); setProblem(null);
    try {
      const r = await uploadFile(file);
      if (!r.ok) throw new Error(r.reason);
      if (r.kind !== "image") throw new Error("Add a picture.");
      const result = addUploadedLayer(scene, { name: file.name.replace(/\.[^.]+$/, ""), url: r.url }, "object");
      onChange(result.scene); onSelect(result.selected);
    } catch (e) { setProblem(e instanceof Error ? e.message : "The picture could not be added."); }
    finally { setBusy(false); }
  }
  return (
    <div className="gw-layers">
      <Collapsible id="layers" title="Layers">
        {rows.length === 0 ? <p className="gs-soft">Nothing placed yet. Add a picture below.</p> : (
          <ul className="gw-layer-list" aria-label="Layers in the picture">
            {rows.map((r) => (
              <li key={r.id}><button type="button" className={r.id === selected ? "on" : ""} aria-pressed={r.id === selected} onClick={() => onSelect(r.id === selected ? null : r.id)}><i>{r.kind}</i><span>{r.name}</span></button></li>
            ))}
          </ul>
        )}
      </Collapsible>
      <Collapsible id="assets" title="Assets">
        <DropZone rules={{ kinds: ["image"] }} busy={busy} onFiles={(files) => void addFile(files[0]!)} label="Drop images here" hint="or click to browse" />
        {problem && <p className="library-error" role="alert">{problem}</p>}
        {accessories.length > 0 && (
          <div className="gw-quick" role="group" aria-label="Your saved props">
            {accessories.slice(0, 6).map((a) => <button key={a.id} type="button" title={`Add ${a.name}`} aria-label={`Add ${a.name}`} onClick={() => { const next = addProp(scene, { name: a.name, url: a.image! }); onChange(next); onSelect(next.props!.at(-1)!.id); }}><img src={a.image!} alt="" /></button>)}
          </div>
        )}
      </Collapsible>
    </div>
  );
}
