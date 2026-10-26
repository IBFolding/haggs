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
import { PLACE_SAMPLES } from "../../samples/starters";
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
          <div className="cm-row" aria-label="Samples">
            <span className="muted">Try a sample:</span>
            {PLACE_SAMPLES.map((p) => <button key={p.name} className="pill" onClick={() => { setCurrent(null); setTraits(p); setReference(null); setPlate(null); setViews([]); setNote(null); setError(null); }}>{p.name}</button>)}
          </div>

          {saved.length > 0 && (
            <div className="chars-shelf" aria-label="Your locations">
              <button className={`chars-new${!current ? " on" : ""}`} onClick={() => open(null)}>+ New</button>
              {saved.map((c) => (
                <button key={c.id} className={`chars-pick${current?.id === c.id ? " on" : ""}`} onClick={() => open(c)} title={c.traits.name}>
                  <img src={c.plate} alt="" />
                  <span>{c.traits.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="chars-body">
            <div className="chars-form">
              <label className="wf-field"><span>Name</span><input value={traits.name} maxLength={60} onChange={(e) => set("name", e.target.value)} /></label>

              <div className="chars-likeness">
                <b>Start from a picture</b>
                <p>Add a photo of a real place and the plate keeps its layout; the choices below change the time, weather and mood.</p>
                <div className="chars-photos">
                  {reference && <span><img src={reference} alt="" /><button aria-label="Remove picture" onClick={() => setReference(null)}>×</button></span>}
                  {!reference && <button className="chars-add" onClick={() => file.current?.click()}>+ Picture</button>}
                </div>
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

              <fieldset className="chars-group">
                <legend>The place</legend>
                {PLACE_ROWS.map((row) => (
                  <div key={row.id} className="chars-row">
                    <span>{row.label}</span>
                    <div role="radiogroup" aria-label={row.label}>
                      {row.options.map((o) => <button key={o} role="radio" aria-checked={traits[row.id] === o} className={traits[row.id] === o ? "on" : ""} onClick={() => set(row.id, o as never)}>{o}</button>)}
                    </div>
                  </div>
                ))}
                <label className="wf-field"><span>Style and materials</span><input value={traits.style} maxLength={200} placeholder="weathered wood and brass, art deco, brutalist concrete" onChange={(e) => set("style", e.target.value)} /></label>
                <label className="wf-field"><span>Details that matter</span><input value={traits.details} maxLength={300} placeholder="a jukebox in the corner, rain on the windows" onChange={(e) => set("details", e.target.value)} /></label>
              </fieldset>
            </div>

            <div className="chars-stage">
              <div className="chars-sheet" aria-live="polite">
                {busy === "plate" ? <div className="wf-result-wait">Building the place…</div> : plate ? <img src={plate} alt={traits.name} /> : <div className="wf-result-wait">Choose the place, then make the plate. An empty establishing shot appears here.</div>}
              </div>
              {error && <p className="library-error" role="alert">{error}</p>}
              {note && <p className="wf-note" role="status">{note}</p>}
              <div className="sheet-row">
                <button className="fire" disabled={busy !== null} onClick={() => void makePlate()}>{plate ? "Roll it again" : "Make the plate"} <span className="cost">{creditsText(PRICE)}</span></button>
                {plate && <button className="pill on" onClick={() => void save()}>{current ? "Save changes" : "Save place"}</button>}
              </div>

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
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
