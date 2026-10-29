"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createAccessoryStore, type Accessory } from "../../accessories/accessory";
import { defaultKv } from "../../story/kv";
import { Nav, openKeys } from "../nav";
import { ReturnBar } from "../return-bar";
import { makeStill } from "../series-actions";
import { surfaceAvailable } from "../studio";
import { uploadFile } from "../upload-client";
import { ACCESSORY_SAMPLES, SAMPLE_PICTURES } from "../../samples/starters";
import { ModeTabs } from "../mode-tabs";
import { galleryStill } from "../gallery-log";
import { SiteFooter } from "../site-footer";
import { creditsText } from "../../story/price-text";

const FINISH = "Product photograph of the single item on a plain light grey background, soft studio light, no person, no text, no watermark.";
const PRICE = 0.07;

/**
 * Accessories: what a character wears or carries. Describe it, add or make a
 * picture, save it. From then on it is one tap away wherever you are choosing
 * who is in a shot.
 */
export function Accessories() {
  const store = useMemo(() => createAccessoryStore(defaultKv()), []);
  const [list, setList] = useState<Accessory[]>([]);
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  const [picture, setPicture] = useState<string | null>(null);
  const [saved, setSaved] = useState<Accessory | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => { void store.list().then(setList); }, [store]);

  async function makePicture() {
    setBusy("Drawing it…");
    setProblem(null);
    const r = await makeStill(`${words.trim() || name.trim()}. ${FINISH}`, "16:9", [], "");
    galleryStill(words.trim() || name.trim(), "Accessory")(r);
    setBusy(null);
    if (!r.ok) { if (r.needsKey) openKeys(); return setProblem(r.reason); }
    setPicture(r.url);
  }

  async function addPicture(file: File) {
    setBusy("Adding…");
    setProblem(null);
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture." : r.reason);
    setPicture(r.url);
  }

  async function save() {
    try {
      const made = await store.save({ ...(saved ? { id: saved.id, createdAt: saved.createdAt } : {}), name, words, picture });
      setSaved(made);
      setList(await store.list());
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That couldn't be saved.");
    }
  }

  function open(a: Accessory) {
    setSaved(a); setName(a.name); setWords(a.words); setPicture(a.picture); setProblem(null);
  }

  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Photos" current="/accessories" canEdit={surfaceAvailable("Edit")} />
          <ReturnBar kind="accessory" savedId={saved?.id} savedName={saved?.name} />
          <div className="cx">
            <aside className="cx-builder" aria-label="Build an accessory">
              <div className="cx-scroll">
                <span className="eyebrow">Accessories</span>
                <h1 className="cx-title">Make a prop once. Use it in every shot.</h1>
                <p className="cx-lede">A scarf, glasses, a jacket, a camera. Describe it, add or draw a picture, and put it on anyone, anywhere in haggs.</p>
                <label className="wf-field"><span>Name</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Red scarf" /></label>
                <label className="wf-field"><span>What it looks like</span><textarea rows={3} value={words} maxLength={300} onChange={(e) => setWords(e.target.value)} placeholder="a long bright red wool scarf with tassels" /></label>
                <label className="cx-upload"><span aria-hidden>＋</span><b>{picture ? "Change the picture" : "Add a picture"}</b><small>optional · or draw one below</small><input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} /></label>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </div>
              <div className="cx-foot">
                <button className="cx-shuffle" disabled={!name.trim()} onClick={() => void save()}>{saved ? "Save changes" : "Save"}</button>
                <button className="fire" disabled={busy !== null || (name.trim().length + words.trim().length) < 3} onClick={() => void makePicture()}>{busy ?? (picture ? "Draw again" : "Draw a picture")} <span className="cost">about {creditsText(PRICE)}</span></button>
              </div>
            </aside>

            <div className="cx-main">
              <div className="chars-stage">
                <div className="chars-sheet ac-stage" aria-live="polite">
                  {picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={picture} alt={name || "The accessory"} /> : <div className="wf-result-wait">Describe it, then draw a picture or add your own. It appears here.</div>}
                </div>
                {saved && (
                  <div className="sheet-row">
                    <button className="plain danger" onClick={() => void store.remove(saved.id).then(async () => { setSaved(null); setName(""); setWords(""); setPicture(null); setList(await store.list()); })}>Delete {saved.name}</button>
                  </div>
                )}
              </div>

              <section className="cx-gallery" aria-label="Accessories to start from">
                {list.length > 0 && (
                  <>
                    <span className="eyebrow muted">Your accessories</span>
                    <div className="cx-cards">
                      <button className={`cx-card cx-new${!saved ? " on" : ""}`} onClick={() => { setSaved(null); setName(""); setWords(""); setPicture(null); }}><b>+ New accessory</b></button>
                      {list.map((a) => (
                        <button key={a.id} className={`cx-card${saved?.id === a.id ? " on" : ""}`} onClick={() => open(a)}>
                          {a.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.picture} alt="" /> : <span className="cx-mono" aria-hidden>{a.name.slice(0, 1)}</span>}
                          <span><b>{a.name}</b><small>Open</small></span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <span className="eyebrow muted">Start from a sample</span>
                <div className="cx-cards">
                  {ACCESSORY_SAMPLES.map((a) => (
                    <button key={a.name} className="cx-card cx-sample" onClick={() => { setSaved(null); setName(a.name); setWords(a.words); setPicture(null); setProblem(null); }}>
                      {SAMPLE_PICTURES[a.name] ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="cx-sample-pic" src={SAMPLE_PICTURES[a.name]} alt="" /> : <span className="cx-mono" aria-hidden>{a.name.slice(0, 1)}</span>}
                      <span><b>{a.name}</b><small>{a.words}</small><em>Use this →</em></span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
