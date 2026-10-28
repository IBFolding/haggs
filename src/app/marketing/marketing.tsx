"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createBrandStore, type BrandKit } from "../../brand/brand";
import { MODES, TEMPLATES, marketingPrompt, templatesFor, type MarketingTemplate, type ModeId, type Ratio } from "../../brand/marketing";
import { createProductStore, type SavedProduct } from "../../brand/product";
import { createCharacterStore, identityLock, type Character } from "../../characters/character";
import { defaultKv, idbKv } from "../../story/kv";
import { creditsText } from "../../story/price-text";
import { BrandKitDialog, BrandMark } from "../brand-kit";
import { galleryStill } from "../gallery-log";
import { ModeTabs } from "../mode-tabs";
import { Nav, openKeys } from "../nav";
import { makeStill } from "../series-actions";
import { shrinkAll, shrinkPicture } from "../shrink";
import { SiteFooter } from "../site-footer";
import { surfaceAvailable } from "../studio";
import { uploadFile } from "../upload-client";

const PRICE = 0.07;
const HANDOFF_KEY = "haggs.handoff";
const RATIOS: Ratio[] = ["9:16", "4:5", "1:1", "16:9"];
const isVideo = (src: string) => /\.mp4$/.test(src);

type Made = { key: string; ratio: Ratio; label: string; url?: string; problem?: string };
type Draft = { words: string; mode: ModeId | "all"; templateId: string | null; ratio: Ratio; count: number; kitId: string | null; productId: string | null; personId: string | null; made: Made[] };

/** A template's tile: our own sample, or its name drawn on the brand's colours when we have none. */
function TemplateArt({ t, kit }: { t: MarketingTemplate; kit: BrandKit | null }) {
  if (t.sample) return isVideo(t.sample)
    ? <video src={t.sample} muted loop playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)} onMouseLeave={(e) => e.currentTarget.pause()} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={t.sample} alt="" loading="lazy" />;
  const [a, b] = [kit?.colors[0] ?? "#1f3a2c", kit?.colors[1] ?? kit?.colors[0] ?? "#0e0e10"];
  return <span className="ms-drawn" style={{ background: `radial-gradient(120% 90% at 80% 10%, ${a}, ${b})` }}><b>{t.name}</b></span>;
}

/**
 * Marketing studio: pick a kind of content, pull in a brand kit, a person and a product, choose one of our
 * templates (or write your own), and make it. Pictures are made here with the price on the button; a video
 * goes to Video with the prompt and the product photo, where the video price is shown. A template that a
 * ready-made app does end to end opens that app.
 */
export function Marketing() {
  const router = useRouter();
  const brands = useMemo(() => createBrandStore(defaultKv()), []);
  const [ready, setReady] = useState(false);
  const [d, setD] = useState<Draft>({ words: "", mode: "all", templateId: null, ratio: "4:5", count: 1, kitId: null, productId: null, personId: null, made: [] });
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [people, setPeople] = useState<Character[]>([]);
  const [makes, setMakes] = useState<"all" | "image" | "video">("all");
  const [slot, setSlot] = useState<"brand" | "person" | "product" | null>(null);
  const [newProduct, setNewProduct] = useState({ name: "", words: "", price: "", picture: null as string | null });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([brands.list(), createProductStore(defaultKv()).list(), createCharacterStore(defaultKv()).list(), idbKv().get<Draft>("marketing:draft:v1")])
      .then(([k, p, c, saved]) => { setKits(k); setProducts(p); setPeople(c); if (saved) setD((cur) => ({ ...cur, ...saved })); })
      .catch(() => setProblem("Could not load your brands, products and characters. Reload to try again."))
      .finally(() => setReady(true));
  }, [brands]);
  useEffect(() => { if (ready) void idbKv().set("marketing:draft:v1", d).catch(() => undefined); }, [ready, d]);

  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));
  const kit = kits.find((k) => k.id === d.kitId) ?? null;
  const product = products.find((p) => p.id === d.productId) ?? null;
  const person = people.find((c) => c.id === d.personId) ?? null;
  const template = TEMPLATES.find((t) => t.id === d.templateId) ?? null;
  const video = template?.makes === "video";
  const prompt = marketingPrompt({ words: d.words, template, product, kit, person: person ? identityLock(person.traits) : null });
  const canMake = d.words.trim().length >= 4 || Boolean(template);
  const shown = templatesFor(d.mode, makes);

  function pick(t: MarketingTemplate) {
    set({ templateId: d.templateId === t.id ? null : t.id, ratio: t.ratio, mode: t.mode });
    setProblem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addProduct() {
    try {
      const p = await createProductStore(defaultKv()).save(newProduct);
      setProducts(await createProductStore(defaultKv()).list());
      set({ productId: p.id });
      setNewProduct({ name: "", words: "", price: "", picture: null });
      setSlot(null);
    } catch (e) { setProblem(e instanceof Error ? e.message : "That couldn't be saved."); }
  }

  async function addPhoto(file: File) {
    setBusy("Adding the photo…");
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture." : r.reason);
    setNewProduct((n) => ({ ...n, picture: r.url }));
  }

  async function make() {
    setProblem(null);
    if (video) {
      const start = product?.picture ? await shrinkPicture(product.picture, 1536) : "";
      try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: start, to: "Video", prompt })); } catch { return setProblem("This browser wouldn't hold the brief for the next page."); }
      return router.push("/video");
    }
    const stamp = Date.now();
    const jobs = Array.from({ length: d.count }, (_, i) => ({ key: `${stamp}-${i}`, ratio: d.ratio, label: template?.name ?? "Your prompt" }));
    set({ made: [...jobs, ...d.made].slice(0, 40) });
    const refs = await shrinkAll([product?.picture, person?.sheet].filter((x): x is string => Boolean(x)));
    for (const [i, j] of jobs.entries()) {
      setBusy(`Making ${i + 1} of ${jobs.length}…`);
      const r = await makeStill(prompt, d.ratio, refs, "");
      galleryStill(prompt, "Marketing")(r);
      if (!r.ok && r.needsKey) { openKeys(); setBusy(null); return setProblem(r.reason); }
      setD((cur) => ({ ...cur, made: cur.made.map((m) => (m.key === j.key ? (r.ok ? { ...m, url: r.url } : { ...m, problem: r.reason }) : m)) }));
    }
    setBusy(null);
  }

  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className="swap ms">
          <ModeTabs group="Photos" current="/marketing" canEdit={surfaceAvailable("Edit")} />
          <section className="ms-hero">
            <span className="eyebrow">Marketing studio</span>
            <div className="ms-modes" role="tablist" aria-label="What to make">
              {MODES.map((m) => {
                const first = TEMPLATES.find((t) => t.mode === m.id && t.sample);
                return (
                  <button key={m.id} role="tab" aria-selected={d.mode === m.id} className={`ms-mode${d.mode === m.id ? " on" : ""}`} onClick={() => set({ mode: d.mode === m.id ? "all" : m.id })} title={m.says}>
                    {first?.sample && (isVideo(first.sample) ? <video src={first.sample} muted loop autoPlay playsInline preload="metadata" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={first.sample} alt="" />)}
                    <b>{m.label}</b>
                  </button>
                );
              })}
            </div>
            <h1>Turn any product into <b>ready-to-post content.</b></h1>
          </section>

          <div className="ms-bar">
            <div className="ms-say">
              {template && <span className="ms-chosen">{template.name} <button className="plain" aria-label="Clear the template" onClick={() => set({ templateId: null })}>×</button></span>}
              <textarea value={d.words} onChange={(e) => set({ words: e.target.value })} rows={2} placeholder={template ? "Add anything: the season, the offer, the mood… (optional)" : "Describe what you want to make, or pick a template below"} aria-label="Describe it" />
              <div className="ms-opts">
                <select value={d.ratio} onChange={(e) => set({ ratio: e.target.value as Ratio })} aria-label="Shape" disabled={video}>{RATIOS.map((r) => <option key={r}>{r}</option>)}</select>
                {!video && <span className="ms-count"><button className="plain" aria-label="Fewer" disabled={d.count <= 1} onClick={() => set({ count: d.count - 1 })}>−</button><b>{d.count}</b><button className="plain" aria-label="More" disabled={d.count >= 4} onClick={() => set({ count: d.count + 1 })}>+</button></span>}
                <details className="ms-words"><summary>Prompt</summary><p>{prompt}</p></details>
              </div>
            </div>
            <div className="ms-slots">
              <button className={`ms-slot${kit ? " set" : ""}`} onClick={() => setSlot("brand")}>{kit ? <BrandMark kit={kit} size={46} /> : <span className="ms-plus">+</span>}<small>{kit?.name ?? "Brand"}</small></button>
              <button className={`ms-slot${person ? " set" : ""}`} onClick={() => setSlot(slot === "person" ? null : "person")}>{person ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={person.sheet} alt="" /> : <span className="ms-plus">+</span>}<small>{person?.traits.name ?? (template?.person ? "Person · needed" : "Person")}</small></button>
              <button className={`ms-slot${product ? " set" : ""}`} onClick={() => setSlot(slot === "product" ? null : "product")}>{product?.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={product.picture} alt="" /> : product ? <span className="ms-plus">{product.name.slice(0, 1)}</span> : <span className="ms-plus">+</span>}<small>{product?.name ?? "Product"}</small></button>
            </div>
            {template?.app ? (
              <Link className="fire ms-go" href={`/workflows/build?quick=${template.app}`}>Open the app <span className="cost">price there</span></Link>
            ) : (
              <button className="fire ms-go" disabled={!ready || busy !== null || !canMake} onClick={() => void make()}>{busy ?? (video ? "Make the video" : `Make ${d.count}`)} <span className="cost">{video ? "priced on Video" : `about ${creditsText(d.count * PRICE)}`}</span></button>
            )}
          </div>
          {problem && <p className="library-error" role="alert">{problem}</p>}

          {slot === "person" && (
            <div className="ms-pop" aria-label="Pick a person">
              <button className={!person ? "on" : ""} onClick={() => { set({ personId: null }); setSlot(null); }}><span className="ms-plus">∅</span><small>Nobody</small></button>
              {people.map((c) => <button key={c.id} className={person?.id === c.id ? "on" : ""} onClick={() => { set({ personId: c.id }); setSlot(null); }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={c.sheet} alt="" /><small>{c.traits.name}</small></button>)}
              <Link className="ms-pop-add" href="/characters">+ Make a character</Link>
            </div>
          )}
          {slot === "product" && (
            <div className="ms-pop" aria-label="Pick a product">
              <button className={!product ? "on" : ""} onClick={() => { set({ productId: null }); setSlot(null); }}><span className="ms-plus">∅</span><small>None</small></button>
              {products.map((p) => <button key={p.id} className={product?.id === p.id ? "on" : ""} onClick={() => { set({ productId: p.id }); setSlot(null); }}>{p.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.picture} alt="" /> : <span className="ms-plus">{p.name.slice(0, 1)}</span>}<small>{p.name}</small></button>)}
              <form className="ms-pop-new" onSubmit={(e) => { e.preventDefault(); if (newProduct.name.trim()) void addProduct(); }}>
                <input value={newProduct.name} maxLength={60} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="New product: Ember mug" aria-label="Product name" />
                <input value={newProduct.words} maxLength={300} onChange={(e) => setNewProduct({ ...newProduct, words: e.target.value })} placeholder="What it looks like" aria-label="What it looks like" />
                <label className="pill">{newProduct.picture ? "Photo added" : "Add a photo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPhoto(f); }} /></label>
                <button className="pill" disabled={!newProduct.name.trim() || busy !== null}>Save</button>
              </form>
            </div>
          )}
          {slot === "brand" && <BrandKitDialog chosen={d.kitId} onPick={(k) => { set({ kitId: k?.id ?? null }); void brands.list().then(setKits); }} onClose={() => setSlot(null)} />}

          {d.made.length > 0 && (
            <section className="cx-gallery" aria-label="What you made">
              <span className="eyebrow muted">Made here · {d.made.filter((m) => m.url).length} of {d.made.length}</span>
              <ul className="ad-wall">
                {d.made.map((m) => (
                  <li key={m.key}>
                    <div className="ad-tile" style={{ aspectRatio: m.ratio.replace(":", " / ") }}>{m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.label} /> : <span className="ad-tile-wait">{m.problem ?? "Making…"}</span>}</div>
                    <small>{m.label}</small>
                    {m.url && <span className="ad-tile-acts"><a href={m.url} download>Download</a></span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="ms-explore" aria-label="Templates">
            <div className="ms-explore-head">
              <h2>Explore templates</h2>
              <div className="rx-filter" role="tablist" aria-label="Kind">
                {(["all", "image", "video"] as const).map((k) => <button key={k} role="tab" aria-selected={makes === k} onClick={() => setMakes(k)}>{k === "all" ? "All" : k === "image" ? "Pictures" : "Videos"}</button>)}
              </div>
            </div>
            <div className="rx-filter ms-cats" role="tablist" aria-label="Category">
              <button role="tab" aria-selected={d.mode === "all"} onClick={() => set({ mode: "all" })}>All</button>
              {MODES.map((m) => <button key={m.id} role="tab" aria-selected={d.mode === m.id} onClick={() => set({ mode: m.id })}>{m.label}</button>)}
            </div>
            <div className="ms-grid">
              {shown.map((t) => (
                <button key={t.id} className={`ms-tile${d.templateId === t.id ? " on" : ""}`} onClick={() => pick(t)} aria-pressed={d.templateId === t.id}>
                  <span className="ms-art" style={{ aspectRatio: t.ratio.replace(":", " / ") }}><TemplateArt t={t} kit={kit} /></span>
                  <span className="ms-meta"><small>{MODES.find((m) => m.id === t.mode)?.label} · {t.makes === "video" ? "Video" : "Picture"}{t.app ? " · app" : ""}</small><b>{t.name}</b></span>
                </button>
              ))}
            </div>
            <p className="wf-small">Templates are haggs&rsquo;s own directions for open models. Tiles with a picture show a sample from our library; the rest are drawn in your brand&rsquo;s colours until you make one.</p>
          </section>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}

