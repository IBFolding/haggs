"use client";
import { useState, useEffect } from "react";
import { SetPanel } from "../board/[id]/grey/[shot]/set-panel";
import { SceneItems } from "../board/[id]/grey/[shot]/scene-items";
import { loadBank } from "../bank-picker";
import type { BankItem } from "../../story/bank";
import { Compositor } from "../board/[id]/grey/[shot]/compositor";
import type { GreyScene } from "../../story/grey-scene";
const room = "/grey-room/room-inspiration.webp";
const oak = "/grey-room/smoked-oak.webp";
const stone = "/grey-room/travertine.webp";
export default function Preview() {
  const [bank, setBank] = useState<BankItem[]>([]);
  useEffect(() => { void loadBank().then(setBank); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [before, showBefore] = useState(false);
  const [scene, setScene] = useState<GreyScene>({
    source: { url: room, kind: "image" },
    references: [{ id: "oak", name: "Smoked oak", url: oak }, { id: "stone", name: "Ivory travertine", url: stone }],
    surfaces: [{ id: "floor", label: "Floor", strength: 0.85, mask: { url: "/grey-room/floor-cutout.webp", kind: "image", at: 1, price: "Prepared example" } }],
  });
  return <main className="gs-demo">
    <header className="gs-demo-head"><div><span className="gs-board-kicker">HAGGS / CREATIVE STUDIO</span><h1>Make room for your ideas.</h1><p>Collect a look. Make it yours.</p></div><span className="gs-demo-badge">Example only · not your cut</span></header>
    <div className="gs-body"><section className="gs-stage">
      <div className="gs-demo-toolbar"><span>{before ? "Original room" : "Your composition"}</span><button className={`pill${before ? " on" : ""}`} aria-pressed={before} onClick={() => showBefore(!before)}>Compare original</button></div>
      <Compositor scene={before ? {} : scene} footage={scene.source!} actorUrl={null} vertical={false} selected={selected} editing={before ? null : "scene"} time={0} playing={false} seconds={3} onTime={() => {}} onSelect={setSelected} onChange={setScene} />
      <SceneItems scene={scene} selected={selected} onSelect={setSelected} />
      <p className="gs-note">Example room · AI-generated imagery with a prepared floor outline. Apply a reference to try a material swap.</p>
    </section><aside className="gs-side"><SetPanel scene={scene} places={bank.filter(i => i.kind === "place")} props={bank.filter(i => i.kind === "accessory" && i.image)} actors={bank.filter(i => i.kind === "character" && i.image)} selected={selected} vertical={false} footageUrl={scene.source?.url ?? room} isVideo={false} others={0} onSelect={setSelected} onChange={next => { setScene(next); showBefore(false); }} onReplace={next => { setScene(next); showBefore(false); }} onUseEverywhere={() => {}} /></aside></div>
  </main>;
}
