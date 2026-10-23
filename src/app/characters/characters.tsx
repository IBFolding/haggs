"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { TRAIT_ROWS, blank, changeNote, characterPrompt, createCharacterStore, identityLock, type Character, type Traits } from "../../characters/character";
import { defaultKv } from "../../story/kv";
import type { Run } from "../../story/runs";
import { runEdit } from "../actions";
import { Nav, openKeys } from "../nav";
import { SaveToProject } from "../save-to-project";
import { makeStill } from "../series-actions";

/**
 * Characters: change anything about a person and see them, or drop photos
 * of someone and keep their face. The sheet is three views of the same
 * person; from here they go to a project as its face for every shot, into
 * Swap, or into any workflow as a reference.
 */

const GROUPS = [["who", "Who"], ["body", "Body"], ["face", "Face and hair"], ["style", "Style"]] as const;
const SHEET_PRICE = 0.0686;
const CHANGE_PRICE = 0.04;

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
    const r = await runEdit({ tool: "kontext", frame: sheet, prompt: `${change.trim()}. Keep everything else exactly the same: the same person, the same three views, outfit, pose and background.`, ratio: "16:9" });
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
          <nav className="modes" aria-label="Photos">
            <Link href="/photos">Make</Link>
            <Link href="/edit">Edit a photo</Link>
            <Link href="/characters" aria-current="page">Characters</Link>
            <Link href="/locations">Locations</Link>
          </nav>

          {saved.length > 0 && (
            <div className="chars-shelf" aria-label="Your characters">
              <button className={`chars-new${!current ? " on" : ""}`} onClick={() => { setCurrent(null); setTraits(blank()); setLikeness([]); setSheet(null); setMade(null); setNote(null); }}>+ New</button>
              {saved.map((c) => (
                <button key={c.id} className={`chars-pick${current?.id === c.id ? " on" : ""}`} onClick={() => open(c)} title={c.traits.name}>
                  <img src={c.sheet} alt="" />
                  <span>{c.traits.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="chars-body">
            <div className="chars-form">
              <label className="wf-field"><span>Name</span><input value={traits.name} maxLength={60} onChange={(e) => set("name", e.target.value)} /></label>
              <label className="wf-field chars-age"><span>Age · {traits.age}</span><input type="range" min={6} max={90} value={traits.age} onChange={(e) => set("age", Number(e.target.value))} aria-label="Age" /></label>

              <div className="chars-likeness">
                <b>Look like someone</b>
                <p>Add photos of a person and the sheet keeps their face; the traits below change everything else.</p>
                <div className="chars-photos">
                  {likeness.map((u, i) => (
                    <span key={i}><img src={u} alt="" /><button aria-label="Remove photo" onClick={() => setLikeness((l) => l.filter((_, k) => k !== i))}>×</button></span>
                  ))}
                  {likeness.length < 4 && <button className="chars-add" onClick={() => photo.current?.click()}>+ Photo</button>}
                </div>
                <input ref={photo} type="file" accept="image/*" multiple hidden onChange={async (e) => {
                  const files = [...(e.target.files ?? [])].slice(0, 4 - likeness.length);
                  e.target.value = "";
                  try {
                    setLikeness((l) => l);
                    const urls = await Promise.all(files.map(shrink));
                    setLikeness((l) => [...l, ...urls].slice(0, 4));
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "That photo couldn't be added.");
                  }
                }} />
                {likeness.length > 0 && <small>Use photos of someone who has said you may. Their face is sent to Comfy to make the sheet.</small>}
              </div>

              {GROUPS.map(([id, label]) => (
                <fieldset key={id} className="chars-group">
                  <legend>{label}</legend>
                  {TRAIT_ROWS.filter((r) => r.group === id).map((row) => (
                    <div key={row.id} className="chars-row">
                      <span>{row.label}</span>
                      <div role="radiogroup" aria-label={row.label}>
                        {row.options.map((o) => (
                          <button key={o} role="radio" aria-checked={traits[row.id] === o} className={traits[row.id] === o ? "on" : ""} onClick={() => set(row.id, o as never)}>{o}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {id === "style" && (
                    <>
                      <label className="wf-field"><span>Wardrobe</span><input value={traits.wardrobe} maxLength={200} onChange={(e) => set("wardrobe", e.target.value)} /></label>
                      <label className="wf-field"><span>Marks and details</span><input value={traits.marks} maxLength={200} placeholder="a small scar through the left eyebrow, freckles" onChange={(e) => set("marks", e.target.value)} /></label>
                    </>
                  )}
                </fieldset>
              ))}
            </div>

            <div className="chars-stage">
              <div className="chars-sheet" aria-live="polite">
                {busy === "sheet" ? <div className="wf-result-wait">Making the sheet…</div> : sheet ? <img src={sheet} alt={`${traits.name}: front, three-quarter and profile`} /> : <div className="wf-result-wait">Set who they are, then make the sheet. Three views of the same person appear here.</div>}
              </div>
              {error && <p className="library-error" role="alert">{error}</p>}
              {note && <p className="wf-note" role="status">{note}</p>}
              <div className="sheet-row">
                <button className="fire" disabled={busy !== null} onClick={() => void makeSheet()}>
                  {sheet ? (stale ? "Remake with these changes" : "Roll the sheet again") : "Make the sheet"} <span className="cost">${SHEET_PRICE.toFixed(2)}</span>
                </button>
                {sheet && <button className="pill on" onClick={() => void save()}>{current ? "Save changes" : "Save character"}</button>}
              </div>
              {stale && <p className="wf-small">Changed since this sheet: {stale}. Remake the sheet to see it.</p>}

              {sheet && (
                <>
                  <label className="wf-field">
                    <span>Change this picture</span>
                    <div className="chars-change">
                      <input value={change} placeholder="give her silver hair, make him heavier, add round glasses" onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void changeSheet()} />
                      <button className="pill" disabled={busy !== null || !change.trim()} onClick={() => void changeSheet()}>{busy === "change" ? "Changing…" : `Change · $${CHANGE_PRICE.toFixed(2)}`}</button>
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
          </div>
        </div>
      </div>
    </div>
  );
}
