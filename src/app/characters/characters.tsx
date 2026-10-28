"use client";

import { galleryEdit } from "../gallery-log";
import { track as inHeader } from "../../activity/activity";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { TRAIT_ROWS, blank, changeNote, characterPrompt, createCharacterStore, identityLock, type Character, type Traits } from "../../characters/character";
import { defaultKv } from "../../story/kv";
import type { PictureRun as Run } from "../../story/runs";
import { runEdit } from "../actions";
import { Nav, openKeys } from "../nav";
import { surfaceAvailable } from "../studio";
import { ReturnBar } from "../return-bar";
import { SaveToProject } from "../save-to-project";
import { makeStill } from "../series-actions";
import { CHARACTER_SAMPLES, SAMPLE_PICTURES, SAMPLE_PICTURES_BY } from "../../samples/starters";
import { ChipRow } from "../chip-row";
import { SWATCHES, SwatchRow } from "./swatches";
import { ModeTabs } from "../mode-tabs";
import { SiteFooter } from "../site-footer";
import { creditsText } from "../../story/price-text";

/**
 * Characters: change anything about a person and see them, or drop photos
 * of someone and keep their face. The sheet is three views of the same
 * person; from here they go to a project as its face for every shot, into
 * Swap, or into any workflow as a reference.
 */

const GROUPS = [["who", "Who"], ["body", "Body"], ["face", "Face and hair"], ["style", "Style"]] as const;
const SHEET_PRICE = 0.0686;
const CHANGE_PRICE = 0.04;

/** Every trait picked at random from its usual choices, keeping the name, age range sensible and words you wrote. */
function shuffled(t: Traits): Traits {
  const next = { ...t, age: 18 + Math.floor(Math.random() * 52) };
  for (const row of TRAIT_ROWS) (next as Record<string, unknown>)[row.id] = row.options[Math.floor(Math.random() * row.options.length)];
  // A girl or a boy gets a child's age, and no beard.
  if (next.gender === "girl" || next.gender === "boy") { next.age = 7 + Math.floor(Math.random() * 9); next.facialHair = "none"; }
  return next;
}

const asData = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That photo couldn't be read."));
    r.readAsDataURL(file);
  });

/** A photo shrunk to something Comfy will take quickly: at most 1280px, as JPEG. */
async function shrink(file: File): Promise<string> {
  const url = await asData(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That isn't a photo."));
    i.src = url;
  });
  const k = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

export function Characters() {
  const store = useMemo(() => createCharacterStore(defaultKv()), []);
  const photo = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Character[]>([]);
  const [current, setCurrent] = useState<Character | null>(null);
  const [traits, setTraits] = useState<Traits>(blank());
  const [likeness, setLikeness] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [made, setMade] = useState<Traits | null>(null);
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState<"sheet" | "change" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState<Run | null>(null);

  useEffect(() => {
    void store.list().then(setSaved);
  }, [store]);

  const set = <K extends keyof Traits>(k: K, v: Traits[K]) => setTraits((t) => ({ ...t, [k]: v }));
  const stale = sheet && made ? changeNote(made, traits) : "";

  function open(c: Character) {
    setCurrent(c);
    setTraits(c.traits);
    setLikeness(c.likeness);
    setSheet(c.sheet);
    setMade(c.traits);
    setNote(null);
    setError(null);
  }

  async function makeSheet() {
    setBusy("sheet");
    setError(null);
    setNote(null);
    const r = await makeStill(characterPrompt(traits, likeness.length > 0), "16:9", likeness);
    setBusy(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setSheet(r.url);
    setMade(traits);
  }

  async function changeSheet() {
    if (!sheet || !change.trim()) return;
    setBusy("change");
    setError(null);
    const r = await inHeader({ label: `Changing a character`, href: window.location.pathname + window.location.search, failure: (x) => (x.ok ? null : x.reason), after: galleryEdit(change.trim()) }, () => runEdit({ tool: "kontext", frame: sheet, prompt: `${change.trim()}. Keep everything else exactly the same: the same person, the same three views, outfit, pose and background.`, ratio: "16:9" }));
    setBusy(null);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setSheet(r.url);
    setChange("");
    setNote("Changed. The traits on the left describe the version before this edit; save it to keep this picture.");
  }

  async function save() {
    if (!sheet) return;
    const c = await store.save({ ...(current ? { id: current.id, createdAt: current.createdAt } : {}), traits, sheet, likeness });
    setCurrent(c);
    setSaved(await store.list());
    setNote(`Saved ${c.traits.name}.`);
  }

  const asRun = (): Run => ({ id: current?.id ?? "character", modelId: "character", modelName: "Character builder", prompt: identityLock(traits), settings: {}, url: sheet!, kind: "image", usd: null, at: Date.now() });

  return (
    <div className="app">
      <Nav current="Photos" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}
      <div className="canvas">
        <div className="chars">
          <ModeTabs group="Photos" current="/characters" canEdit={surfaceAvailable("Edit")} />
          <h1 className="sr-only">Characters</h1>
          <ReturnBar kind="character" savedId={current?.id} savedName={current?.traits.name} />
          <div className="cx">
            <aside className="cx-builder" aria-label="Build a character">
              <div className="cx-scroll">
                <span className="eyebrow">Characters</span>
                <h1 className="cx-title">Build a person who stays the same.</h1>
                <div className="cx-name">
                  <label className="wf-field"><span>Name</span><input value={traits.name} maxLength={60} onChange={(e) => set("name", e.target.value)} /></label>
                  <label className="wf-field chars-age"><span>Age · {traits.age}</span><input type="range" min={6} max={90} value={traits.age} onChange={(e) => set("age", Number(e.target.value))} aria-label="Age" /></label>
                </div>

                <div className="cx-likeness">
                  {likeness.length === 0 ? (
                    <button className="cx-upload" onClick={() => photo.current?.click()}><span aria-hidden>＋</span><b>Upload a photo</b><small>optional · keeps their face</small></button>
                  ) : (
                    <div className="chars-photos">
                      {likeness.map((u, i) => (
                        <span key={i}><img src={u} alt="" /><button aria-label="Remove photo" onClick={() => setLikeness((l) => l.filter((_, k) => k !== i))}>×</button></span>
                      ))}
                      {likeness.length < 4 && <button className="chars-add" onClick={() => photo.current?.click()}>+ Photo</button>}
                    </div>
                  )}
                  <input ref={photo} type="file" accept="image/*" multiple hidden onChange={async (e) => {
                    const files = [...(e.target.files ?? [])].slice(0, 4 - likeness.length);
                    e.target.value = "";
                    try {
                      const urls = await Promise.all(files.map(shrink));
                      setLikeness((l) => [...l, ...urls].slice(0, 4));
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "That photo couldn't be added.");
                    }
                  }} />
                  {likeness.length > 0 && <small>Use photos of someone who has said you may. Their face is sent to Comfy to make the sheet.</small>}
                </div>

                {TRAIT_ROWS.map((row, i) => (
                  <details key={row.id} className="cx-sec" open={i === 0 || row.id in SWATCHES}>
                    <summary><b>{row.label}</b><i>· {row.options.length}</i><small>{String(traits[row.id])}</small></summary>
                    {row.id in SWATCHES
                      ? <SwatchRow id={row.id} label={row.label} options={row.options} value={String(traits[row.id])} onChange={(v) => set(row.id, v as never)} />
                      : <ChipRow label={row.label} options={row.options} value={String(traits[row.id])} onChange={(v) => set(row.id, v as never)} />}
                  </details>
                ))}
                <details className="cx-sec">
                  <summary><b>Wardrobe and marks</b><small>{[traits.wardrobe, traits.marks].filter(Boolean).join(" · ") || "none yet"}</small></summary>
                  <label className="wf-field"><span>Wardrobe</span><input value={traits.wardrobe} maxLength={200} onChange={(e) => set("wardrobe", e.target.value)} /></label>
                  <label className="wf-field"><span>Marks and details</span><input value={traits.marks} maxLength={200} placeholder="a small scar through the left eyebrow, freckles" onChange={(e) => set("marks", e.target.value)} /></label>
                </details>
              </div>
              <div className="cx-foot">
                <button className="cx-shuffle" title="Shuffle every trait (keeps the name and photos)" aria-label="Shuffle every trait" onClick={() => setTraits((t) => shuffled(t))}>Shuffle</button>
                <button className="fire" disabled={busy !== null} onClick={() => void makeSheet()}>
                  {busy === "sheet" ? "Making…" : sheet ? (stale ? "Remake with these changes" : "Roll the sheet again") : "Make the sheet"} <span className="cost">{creditsText(SHEET_PRICE)}</span>
                </button>
              </div>
            </aside>

            <div className="cx-main">
            <div className="chars-stage">
              <div className="chars-sheet" aria-live="polite">
                {busy === "sheet" ? <div className="wf-result-wait">Making the sheet…</div> : sheet ? <img src={sheet} alt={`${traits.name}: front, three-quarter and profile`} /> : <div className="wf-result-wait">Set who they are, then make the sheet. Three views of the same person appear here.</div>}
              </div>
              {error && <p className="library-error" role="alert">{error}</p>}
              {note && <p className="wf-note" role="status">{note}</p>}
              {sheet && <div className="sheet-row"><button className="pill on" onClick={() => void save()}>{current ? "Save changes" : "Save character"}</button></div>}
              {stale && <p className="wf-small">Changed since this sheet: {stale}. Remake the sheet to see it.</p>}

              {sheet && (
                <>
                  <label className="wf-field">
                    <span>Change this picture</span>
                    <div className="chars-change">
                      <input value={change} placeholder="give her silver hair, make him heavier, add round glasses" onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void changeSheet()} />
                      <button className="pill" disabled={busy !== null || !change.trim()} onClick={() => void changeSheet()}>{busy === "change" ? "Changing…" : `Change · ${creditsText(CHANGE_PRICE)}`}</button>
                    </div>
                  </label>
                  <div className="chars-use">
                    <b>Use {traits.name}</b>
                    <button className="pill" onClick={() => setSaving(asRun())}>In a project</button>
                    <Link className="pill" href={`/swap?face=${encodeURIComponent(sheet)}`}>Swap into a video</Link>
                    <a className="pill" href={sheet} download>Download</a>
                  </div>
                  <p className="wf-small">In a project, they become a character&rsquo;s face: every shot they&rsquo;re in sends this sheet, so they stay the same person.</p>
                </>
              )}
            </div>

            <section className="cx-gallery" aria-label="Characters to start from">
              {saved.length > 0 && (
                <>
                  <span className="eyebrow muted">Your characters</span>
                  <div className="cx-cards">
                    <button className={`cx-card cx-new${!current ? " on" : ""}`} onClick={() => { setCurrent(null); setTraits(blank()); setLikeness([]); setSheet(null); setMade(null); setNote(null); }}><b>+ New character</b></button>
                    {saved.map((c) => (
                      <button key={c.id} className={`cx-card${current?.id === c.id ? " on" : ""}`} onClick={() => open(c)} title={c.traits.name}>
                        <img src={c.sheet} alt="" />
                        <span><b>{c.traits.name}</b><small>Open</small></span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <span className="eyebrow muted">Start from a sample</span>
              <div className="cx-cards">
                {CHARACTER_SAMPLES.map((t) => (
                  <button key={t.name} className="cx-card cx-sample" onClick={() => { setCurrent(null); setTraits(t); setLikeness([]); setSheet(null); setMade(null); setNote(null); setError(null); }}>
                    {SAMPLE_PICTURES[t.name] ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="cx-sample-pic" src={SAMPLE_PICTURES[t.name]} alt="" title={SAMPLE_PICTURES_BY} /> : <span className="cx-mono" aria-hidden>{t.name.replace(/^(Professor|Dr\.?)\s+/, "").slice(0, 1)}</span>}
                    <span><b>{t.name}</b><small>{t.age} · {t.hairColor} {t.hairStyle} hair · {t.wardrobe || t.build}</small><em>Use this →</em></span>
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
