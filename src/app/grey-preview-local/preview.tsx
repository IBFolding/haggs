"use client";
import { useState } from "react";
import { ReferenceBoard } from "../board/[id]/grey/[shot]/reference-board";
import { SurfacesPanel } from "../board/[id]/grey/[shot]/surfaces-panel";
import { Compositor } from "../board/[id]/grey/[shot]/compositor";
import type { GreyScene } from "../../story/grey-scene";
const room = "/grey-room/room-inspiration.webp";
const oak = "/grey-room/smoked-oak.webp";
const stone = "/grey-room/travertine.webp";
export default function Preview() {
  const [before, showBefore] = useState(false);
  const [scene, setScene] = useState<GreyScene>({
    source: { url: room, kind: "image" },
    references: [{ id: "oak", name: "Smoked oak", url: oak }, { id: "stone", name: "Ivory travertine", url: stone }],
    surfaces: [{ id: "floor", label: "Floor", strength: 0.85, mask: { url: "/grey-room/floor-cutout.webp", kind: "image", at: 1, price: "Prepared example" } }],
  });
  return <main className="gs-demo">
    <header className="gs-demo-head"><div><span className="gs-board-kicker">HAGGS / CREATIVE STUDIO</span><h1>Make room for your ideas.</h1><p>Collect a look. Make it yours.</p></div><span className="gs-demo-badge">Grey Room · Preview</span></header>
    <div className="gs-body"><section className="gs-stage">
      <div className="gs-demo-toolbar"><span>{before ? "Original room" : "Your composition"}</span><button className={`pill${before ? " on" : ""}`} aria-pressed={before} onClick={() => showBefore(!before)}>Compare original</button></div>
      <Compositor scene={before ? {} : scene} footage={scene.source!} actorUrl={null} vertical={false} selected={null} editing={null} time={0} playing={false} seconds={3} onTime={() => {}} onSelect={() => {}} onChange={setScene} />
      <p className="gs-note">Example room · AI-generated imagery with a prepared floor outline. Apply a reference to try a material swap.</p>
    </section><aside className="gs-side"><ReferenceBoard scene={scene} onChange={setScene} onEdit={() => showBefore(false)} /><SurfacesPanel scene={scene} footageUrl={room} isVideo={false} references={(scene.references ?? []).map(r => ({ ...r, image: r.url }))} onChange={setScene} /></aside></div>
  </main>;
}
