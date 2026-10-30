"use client";
import { useEffect, useState } from "react";
import { AssetsPanel, type AssetTab } from "../board/[id]/grey/[shot]/assets-panel";
import { Compositor } from "../board/[id]/grey/[shot]/compositor";
import { Inspector } from "../board/[id]/grey/[shot]/inspector";
import { loadBank } from "../bank-picker";
import type { BankItem } from "../../story/bank";
import type { GreyScene } from "../../story/grey-scene";

const room = "/grey-room/room-inspiration.webp";
const oak = "/grey-room/smoked-oak.webp";
const stone = "/grey-room/travertine.webp";

/** The Grey Room workspace on an example room, with nothing to save or run. Development only. */
export default function Preview() {
  const [bank, setBank] = useState<BankItem[]>([]);
  useEffect(() => { void loadBank().then(setBank); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<AssetTab>("room");
  const [before, showBefore] = useState(false);
  const [scene, setScene] = useState<GreyScene>({
    source: { url: room, kind: "image" },
    references: [{ id: "oak", name: "Smoked oak", url: oak }, { id: "stone", name: "Ivory travertine", url: stone }],
    surfaces: [{ id: "floor", label: "Floor", strength: 0.85, mask: { url: "/grey-room/floor-cutout.webp", kind: "image", at: 1, price: "Prepared example" } }],
  });
  const places = bank.filter((i) => i.kind === "place");
  const props = bank.filter((i) => i.kind === "accessory" && i.image);
  return (
    <main className="gs-demo">
      <header className="gs-demo-head"><div><span className="gs-board-kicker">HAGGS / CREATIVE STUDIO</span><h1>Make room for your ideas.</h1><p>Collect a look. Make it yours.</p></div><span className="gs-demo-badge">Grey Room · Preview</span></header>
      <div className="gw-main">
        <aside className="gw-left" aria-label="Library">
          <AssetsPanel tab={tab} onTab={setTab} scene={scene} places={places} props={props} actors={bank.filter((i) => i.kind === "character" && i.image)} vertical={false} footageUrl={scene.source?.url ?? room} isVideo={false} others={0} selected={selected} onSelect={setSelected} onChange={setScene} onReplace={setScene} onUseEverywhere={() => {}} cutout={null} />
        </aside>
        <section className="gw-center">
          <div className="gs-demo-toolbar"><span>{before ? "Original room" : "Your composition"}</span><button className={`pill${before ? " on" : ""}`} aria-pressed={before} onClick={() => showBefore(!before)}>Compare original</button></div>
          <div className="gw-stage"><Compositor scene={before ? {} : scene} footage={scene.source!} actorUrl={null} vertical={false} selected={selected} editing={before ? null : "all"} time={0} playing={false} seconds={3} onTime={() => {}} onSelect={setSelected} onChange={(next) => setScene(next)} /></div>
          <p className="gs-note">Example room · AI-generated imagery with a prepared floor outline. Apply a reference to try a material swap.</p>
        </section>
        <aside className="gw-right" aria-label="Controls">
          <Inspector scene={scene} selected={selected} onSelect={setSelected} onChange={setScene} footageUrl={scene.source?.url ?? room} isVideo={false} places={places} props={props} />
        </aside>
      </div>
    </main>
  );
}
