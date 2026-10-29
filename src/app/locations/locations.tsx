"use client";

import { shrinkAll } from "../shrink";
import { galleryEdit } from "../gallery-log";
import { track as inHeader } from "../../activity/activity";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PLACE_ROWS, blankPlace, createPlaceStore, placeLock, placePrompt, type Place, type SavedPlace } from "../../locations/location";
import { defaultKv } from "../../story/kv";
import type { PictureRun as Run } from "../../story/runs";
import { runEdit } from "../actions";
import { Nav, openKeys } from "../nav";
import { surfaceAvailable } from "../studio";
import { ReturnBar } from "../return-bar";
import { ReshootPanel } from "../reshoot-panel";
import { SaveToProject } from "../save-to-project";
import { makeStill } from "../series-actions";
import { PLACE_SAMPLES, SAMPLE_PICTURES } from "../../samples/starters";
import { ChipRow } from "../chip-row";
import { PictureRow, SWATCHES, SwatchRow } from "../characters/swatches";
import { PLACE_PICTURED, placePicture } from "../../characters/trait-pictures";
import { ModeTabs } from "../mode-tabs";
import { SiteFooter } from "../site-footer";
import { creditsText } from "../../story/price-text";

/**
 * Locations: describe a place or start from a picture of a real one, make an
 * empty plate, change anything about it, then walk the camera around it for
 * more views. From here the place goes to a project as the look of every
 * shot set there.
 */

const PRICE = 0.0686;

async function shrink(file: File): Promise<string> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("That picture couldn't be read."));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That isn't a picture."));
    i.src = url;
  });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Every choice picked at random from its usual options, keeping the name, the picture and the words you wrote. */
function shuffledPlace(t: Place): Place {
  const next = { ...t };
  for (const row of PLACE_ROWS) (next as Record<string, unknown>)[row.id] = row.options[Math.floor(Math.random() * row.options.length)];
  return next;
}

export function Locations() {
  const store = useMemo(() => createPlaceStore(defaultKv()), []);
  const file = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [current, setCurrent] = useState<SavedPlace | null>(null);
  const [traits, setTraits] = useState<Place>(blankPlace());
  const [reference, setReference] = useState<string | null>(null);
  const [plate, setPlate] = useState<string | null>(null);
  const [views, setViews] = useState<string[]>([]);
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState<"plate" | "change" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState<Run | null>(null);

  useEffect(() => {
    void store.list().then(setSaved);
  }, [store]);
  const set = <K extends keyof Place>(k: K, v: Place[K]) => setTraits((t) => ({ ...t, [k]: v }));

  function open(c: SavedPlace | null) {
    setCurrent(c);
    setTraits(c?.traits ?? blankPlace());
    setReference(c?.reference ?? null);
    setPlate(c?.plate ?? null);
    setViews(c?.views ?? []);
    setNote(null);
    setError(null);
  }

  async function makePlate() {
    setBusy("plate");
    setError(null);
    const r = await makeStill(placePrompt(traits, reference !== null), "16:9", reference ? await shrinkAll([reference]) : []);
    setBusy(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setPlate(r.url);
  }

  async function changePlate() {
    if (!plate || !change.trim()) return;
    setBusy("change");
    setError(null);
    const r = await inHeader({ label: `Changing a place`, href: window.location.pathname + window.location.search, failure: (x) => (x.ok ? null : x.reason), after: galleryEdit(change.trim()) }, () => runEdit({ tool: "kontext", frame: plate, prompt: `${change.trim()}. Keep the place itself, its layout and architecture the same, and keep it empty of people.`, ratio: "16:9" }));
    setBusy(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setPlate(r.url);
    setChange("");
  }

  async function save(nextViews = views) {
    if (!plate) return;
    const c = await store.save({ ...(current ? { id: current.id, createdAt: current.createdAt } : {}), traits, plate, views: nextViews, reference });
    setCurrent(c);
    setSaved(await store.list());
    setNote(`Saved ${c.traits.name}.`);
  }

  const asRun = (url: string): Run => ({ id: current?.id ?? "place", modelId: "location", modelName: "Location builder", prompt: placeLock(traits), settings: {}, url, kind: "image", usd: null, at: Date.now() });

  return (
    <div className="app">
      <Nav current="Photos" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}
      <div className="canvas">
        <div className="chars">
          <ModeTabs group="Photos" current="/locations" canEdit={surfaceAvailable("Edit")} />
          <h1 className="sr-only">Locations</h1>
          <ReturnBar kind="place" savedId={current?.id} savedName={current?.traits.name} />
          <div className="cx">
            <aside className="cx-builder" aria-label="Build a location">
              <div className="cx-scroll">
                <span className="eyebrow">Locations</span>
                <h1 className="cx-title">Build a place you can shoot from any side.</h1>
                <label className="wf-field"><span>Name</span><input value={traits.name} maxLength={60} onChange={(e) => set("name", e.target.value)} /></label>

                <div className="cx-likeness">
                  {!reference ? (
                    <button className="cx-upload" onClick={() => file.current?.click()}><span aria-hidden>＋</span><b>Start from a picture</b><small>optional · keeps its layout</small></button>
                  ) : (
                    <div className="chars-photos"><span><img src={reference} alt="" /><button aria-label="Remove picture" onClick={() => setReference(null)}>×</button></span></div>
                  )}
                  <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      setReference(await shrink(f));
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "That picture couldn't be added.");
                    }
                  }} />
                </div>

                {PLACE_ROWS.map((row, i) => (
                  <details key={row.id} className="cx-sec" open={i < 2 || row.id in SWATCHES}>
                    <summary><b>{row.label}</b><i>· {row.options.length}</i><small>{traits[row.id]}</small></summary>
                    {row.id in SWATCHES
                      ? <SwatchRow id={row.id} label={row.label} options={row.options} value={traits[row.id]} onChange={(v) => set(row.id, v as never)} />
                      : (PLACE_PICTURED as readonly string[]).includes(row.id) ? <PictureRow id={row.id} label={row.label} options={row.options} value={traits[row.id]} onChange={(v) => set(row.id, v as never)} src={placePicture} wide />
                      : <ChipRow label={row.label} options={row.options} value={traits[row.id]} onChange={(v) => set(row.id, v as never)} />}
                  </details>
                ))}
                <details className="cx-sec">
                  <summary><b>Style and details</b><small>{[traits.style, traits.details].filter(Boolean).join(" · ") || "none yet"}</small></summary>
                  <label className="wf-field"><span>Style and materials</span><input value={traits.style} maxLength={200} placeholder="weathered wood and brass, art deco, brutalist concrete" onChange={(e) => set("style", e.target.value)} /></label>
                  <label className="wf-field"><span>Details that matter</span><input value={traits.details} maxLength={300} placeholder="a jukebox in the corner, rain on the windows" onChange={(e) => set("details", e.target.value)} /></label>
                </details>
              </div>
              <div className="cx-foot">
                <button className="cx-shuffle" title="Shuffle every choice (keeps the name and picture)" aria-label="Shuffle every choice" onClick={() => setTraits((t) => shuffledPlace(t))}>Shuffle</button>
                <button className="fire" disabled={busy !== null} onClick={() => void makePlate()}>{busy === "plate" ? "Building…" : plate ? "Roll it again" : "Make the plate"} <span className="cost">{creditsText(PRICE)}</span></button>
              </div>
            </aside>

            <div className="cx-main">
            <div className="chars-stage">
              <div className="chars-sheet" aria-live="polite">
                {busy === "plate" ? <div className="wf-result-wait">Building the place…</div> : plate ? <img src={plate} alt={traits.name} /> : <div className="wf-result-wait">Choose the place, then make the plate. An empty establishing shot appears here.</div>}
              </div>
              {error && <p className="library-error" role="alert">{error}</p>}
              {note && <p className="wf-note" role="status">{note}</p>}
              {plate && <div className="sheet-row"><button className="pill on" onClick={() => void save()}>{current ? "Save changes" : "Save place"}</button></div>}

              {plate && (
                <>
                  <label className="wf-field">
                    <span>Change this picture</span>
                    <div className="chars-change">
                      <input value={change} placeholder="make it snow, add a neon sign, empty the shelves" onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void changePlate()} />
                      <button className="pill" disabled={busy !== null || !change.trim()} onClick={() => void changePlate()}>{busy === "change" ? "Changing…" : "Change · 4 credits"}</button>
                    </div>
                  </label>

                  <ReshootPanel
                    source={{ url: plate, kind: "image", at: 0, beat: traits.name }}
                    onKeep={(made) => {
                      const next = [...views, ...made.map((m) => m.url)];
                      setViews(next);
                      void save(next);
                    }}
                  />
                  {views.length > 0 && (
                    <div className="chars-views" aria-label="Views of this place">
                      {views.map((v) => <img key={v} src={v} alt="" />)}
                    </div>
                  )}

                  <div className="chars-use">
                    <b>Use {traits.name}</b>
                    <button className="pill" onClick={() => setSaving(asRun(plate))}>In a project</button>
                    <a className="pill" href={plate} download>Download</a>
                  </div>
                  <p className="wf-small">In a project, it becomes a place&rsquo;s look: every shot set there sends this picture, so it stays the same place.</p>
                </>
              )}
            </div>

            <section className="cx-gallery" aria-label="Places to start from">
              {saved.length > 0 && (
                <>
                  <span className="eyebrow muted">Your locations</span>
                  <div className="cx-cards">
                    <button className={`cx-card cx-new${!current ? " on" : ""}`} onClick={() => open(null)}><b>+ New location</b></button>
                    {saved.map((c) => (
                      <button key={c.id} className={`cx-card${current?.id === c.id ? " on" : ""}`} onClick={() => open(c)} title={c.traits.name}>
                        <img src={c.plate} alt="" />
                        <span><b>{c.traits.name}</b><small>Open</small></span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <span className="eyebrow muted">Start from a sample</span>
              <div className="cx-cards">
                {PLACE_SAMPLES.map((p) => (
                  <button key={p.name} className="cx-card cx-sample" onClick={() => { setCurrent(null); setTraits(p); setReference(null); setPlate(null); setViews([]); setNote(null); setError(null); }}>
                    {SAMPLE_PICTURES[p.name] ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="cx-sample-pic" src={SAMPLE_PICTURES[p.name]} alt="" /> : <span className="cx-mono" aria-hidden style={{ background: SWATCHES.timeOfDay?.[p.timeOfDay] }} />}
                    <span><b>{p.name}</b><small>{p.setting} · {p.timeOfDay} · {p.weather}</small><em>Use this →</em></span>
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
