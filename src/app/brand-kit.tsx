"use client";

import { useEffect, useMemo, useState } from "react";

import { createBrandStore, type BrandKit, type NewBrandKit } from "../brand/brand";
import { defaultKv } from "../story/kv";
import { readBrand } from "./brand-actions";

const BLANK: NewBrandKit = { name: "", url: "", logo: null, colors: [], fonts: [], about: "", tone: "" };

/** A brand's face: its logo, or its initial on its own colour. */
export function BrandMark({ kit, size = 40 }: { kit: BrandKit; size?: number }) {
  return kit.logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="bk-logo" src={kit.logo} alt="" style={{ width: size, height: size }} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    : <span className="bk-mono" style={{ width: size, height: size, background: kit.colors[0] ?? "#2a2a2f" }} aria-hidden>{kit.name.slice(0, 1)}</span>;
}

/**
 * Brand kits: paste a website and haggs reads its name, logo, colours, fonts and tone (free), or make one by hand.
 * Every kit is saved on this device, and any page can pull one in.
 */
export function BrandKitDialog({ chosen, onPick, onClose }: { chosen: string | null; onPick: (kit: BrandKit | null) => void; onClose: () => void }) {
  const store = useMemo(() => createBrandStore(defaultKv()), []);
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [editing, setEditing] = useState<NewBrandKit | null>(null);

  useEffect(() => { void store.list().then(setKits).catch(() => setKits([])); }, [store]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  async function read() {
    setBusy(true); setProblem(null);
    const r = await readBrand(address).catch(() => ({ ok: false as const, reason: "The site could not be reached." }));
    setBusy(false);
    if (!r.ok) return setProblem(r.reason);
    const saved = await store.save(r.kit);
    setKits(await store.list());
    setAddress("");
    onPick(saved);
  }

  async function save() {
    if (!editing) return;
    try {
      const saved = await store.save({ ...editing, colors: editing.colors.filter(Boolean) });
      setKits(await store.list());
      setEditing(null);
      onPick(saved);
    } catch (e) { setProblem(e instanceof Error ? e.message : "That couldn't be saved."); }
  }

  return (
    <div className="vk-scrim" onClick={onClose}>
      <div className="vk-modal bk" role="dialog" aria-modal="true" aria-label="Brand kits" onClick={(e) => e.stopPropagation()}>
        <header className="bk-head">
          <div>
            <h2>Your brand kits</h2>
            <p>Paste your website and haggs reads your name, logo, colours, fonts and tone. Free. Or make one by hand.</p>
            <form className="bk-url" onSubmit={(e) => { e.preventDefault(); if (address.trim().length >= 3) void read(); }}>
              <span aria-hidden>◍</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="www.yourwebsite.com" aria-label="Website address" disabled={busy} />
              <button className="fire" disabled={busy || address.trim().length < 3}>{busy ? "Reading…" : "Read it"} <span className="cost">free</span></button>
            </form>
            <span className="bk-or">or <button className="pill" onClick={() => { setEditing({ ...BLANK }); setProblem(null); }}>Create by hand</button></span>
            {problem && <p className="library-error" role="alert">{problem}</p>}
          </div>
          <button className="vk-x" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="vk-body bk-body">
          {editing ? (
            <div className="bk-edit">
              <label className="wf-field"><span>Name</span><input value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Kiln & Co." /></label>
              <label className="wf-field"><span>Website (optional)</span><input value={editing.url} maxLength={300} onChange={(e) => setEditing({ ...editing, url: e.target.value })} /></label>
              <label className="wf-field"><span>What it sells, in a line</span><textarea rows={2} value={editing.about} maxLength={300} onChange={(e) => setEditing({ ...editing, about: e.target.value })} /></label>
              <label className="wf-field"><span>Tone</span><input value={editing.tone} maxLength={120} onChange={(e) => setEditing({ ...editing, tone: e.target.value })} placeholder="warm, handmade, a little playful" /></label>
              <div className="wf-field"><span>Colours</span>
                <div className="bk-colors">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <input key={i} type="color" aria-label={`Colour ${i + 1}`} value={editing.colors[i] ?? "#2a2a2f"} onChange={(e) => { const c = [...editing.colors]; c[i] = e.target.value; setEditing({ ...editing, colors: c.slice(0, 5) }); }} className={editing.colors[i] ? "on" : ""} />
                  ))}
                </div>
              </div>
              <label className="wf-field"><span>Fonts (comma separated)</span><input value={editing.fonts.join(", ")} onChange={(e) => setEditing({ ...editing, fonts: e.target.value.split(",").map((f) => f.trim()).filter(Boolean).slice(0, 3) })} placeholder="Inter, Playfair Display" /></label>
              <div className="cm-row">
                <button className="fire" disabled={!editing.name.trim()} onClick={() => void save()}>Save the kit</button>
                <button className="plain" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : kits && kits.length === 0 ? (
            <div className="bk-empty"><div aria-hidden className="bk-stack"><i /><i /><i /></div><b>No brand kit yet</b><small>Paste a link or create one by hand to get started.</small></div>
          ) : (
            <div className="bk-grid">
              {(kits ?? []).map((k) => (
                <article key={k.id} className={`bk-card${chosen === k.id ? " on" : ""}`}>
                  <button className="bk-pick" onClick={() => { onPick(k); onClose(); }} aria-pressed={chosen === k.id}>
                    <span className="bk-top"><BrandMark kit={k} /><span><b>{k.name}</b><small>{k.url ? k.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "made by hand"}</small></span></span>
                    <span className="bk-type" style={{ fontFamily: k.fonts.length ? `${k.fonts.map((f) => `"${f}"`).join(", ")}, var(--ui)` : undefined }}>Aa <i>{k.fonts[0] ?? "no font yet"}</i></span>
                    <span className="bk-swatches">{k.colors.length ? k.colors.map((c) => <i key={c} style={{ background: c }} title={c} />) : <small>no colours yet</small>}</span>
                    {(k.about || k.tone) && <small className="bk-about">{[k.about, k.tone].filter(Boolean).join(" · ")}</small>}
                  </button>
                  <span className="bk-acts">
                    {chosen === k.id ? <b>In use</b> : <button className="plain" onClick={() => { onPick(k); onClose(); }}>Use</button>}
                    <button className="plain" onClick={() => setEditing({ ...k })}>Edit</button>
                    <button className="plain danger" onClick={() => void store.remove(k.id).then(async () => { if (chosen === k.id) onPick(null); setKits(await store.list()); })}>Delete</button>
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
        <footer>
          <p>Kits are saved on this device. Pick one and its name, colours, fonts and tone go into every prompt you make with it.</p>
          {chosen && <button className="plain" onClick={() => onPick(null)}>Use no brand</button>}
          <button className="fire" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}
