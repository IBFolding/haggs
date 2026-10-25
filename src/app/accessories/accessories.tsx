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
import { ACCESSORY_SAMPLES } from "../../samples/starters";
import { ModeTabs } from "../mode-tabs";
import { galleryStill } from "../gallery-log";
import { SiteFooter } from "../site-footer";

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
          <header className="swap-head">
            <h1>Accessories</h1>
            <p>A scarf, glasses, a jacket, a camera. Describe it once, add a picture, and put it on anyone, in any shot, from anywhere in haggs.</p>
          </header>
          <div className="cm-row" aria-label="Samples">
            <span className="muted">Try a sample:</span>
            {ACCESSORY_SAMPLES.map((a) => <button key={a.name} className="pill" onClick={() => { setSaved(null); setName(a.name); setWords(a.words); setPicture(null); setProblem(null); }}>{a.name}</button>)}
          </div>

          {list.length > 0 && (
            <div className="cm-cast" aria-label="Your accessories">
              {list.map((a) => (
                <button key={a.id} className={saved?.id === a.id ? "on" : ""} onClick={() => open(a)}>
                  {a.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.picture} alt="" /> : <span className="cm-noimg">{a.name.slice(0, 1)}</span>}
                  <span>{a.name}</span>
                </button>
              ))}
              <button className="cm-add" onClick={() => { setSaved(null); setName(""); setWords(""); setPicture(null); }}>+ New</button>
            </div>
          )}

          <div className="ac-form">
            <label className="wf-field"><span>Name</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Red scarf" /></label>
            <label className="wf-field"><span>What it looks like</span><textarea rows={2} value={words} maxLength={300} onChange={(e) => setWords(e.target.value)} placeholder="a long bright red wool scarf with tassels" /></label>
            <div className="ac-pic">
              {picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={picture} alt="The accessory" /> : <span>No picture yet</span>}
              <div className="cm-row">
                <button className="pill" disabled={busy !== null || (name.trim().length + words.trim().length) < 3} onClick={() => void makePicture()}>{busy ?? (picture ? "Draw again" : "Draw a picture")} <span className="cost">about ${PRICE.toFixed(2)}</span></button>
                <label className="pill">Add a picture<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} /></label>
              </div>
            </div>
            <div className="cm-row">
              <button className="fire" disabled={!name.trim()} onClick={() => void save()}>{saved ? "Save changes" : "Save accessory"}</button>
              {saved && <button className="plain danger" onClick={() => void store.remove(saved.id).then(async () => { setSaved(null); setName(""); setWords(""); setPicture(null); setList(await store.list()); })}>Delete</button>}
            </div>
            {problem && <p className="library-error" role="alert">{problem}</p>}
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
