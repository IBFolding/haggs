"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AD_FORMATS, adJobs, adPrompt, MAX_BATCH, type AdFormat } from "../../brand/ads";
import { SAMPLES } from "../../brand/samples";
import { createBrandStore, type BrandKit } from "../../brand/brand";
import { multiplierJobs, multiplyPrompt, nearestRatio } from "../../brand/multiplier";
import { createProductStore, type SavedProduct } from "../../brand/product";
import { idbKv, defaultKv } from "../../story/kv";
import { readBrand } from "../brand-actions";
import { galleryStill } from "../gallery-log";
import { ModeTabs } from "../mode-tabs";
import { Nav, openKeys } from "../nav";
import { makeStill } from "../series-actions";
import { SiteFooter } from "../site-footer";
import { surfaceAvailable } from "../studio";
import { uploadFile } from "../upload-client";
import { creditsText } from "../../story/price-text";

const PRICE = 0.07;

type Made = { key: string; format: AdFormat; product: string; audience: string; url?: string; problem?: string };

/** The shape of a picture, read from the picture itself. */
function shapeOf(url: string): Promise<ReturnType<typeof nearestRatio>> {
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => done(nearestRatio(img.naturalWidth, img.naturalHeight));
    img.onerror = () => done("1:1");
    img.src = url;
  });
}

/**
 * Ads: a brand kit read from a company's website, the products you sell, and a batch of ad pictures in the
 * formats that sell them (product shot, poster, marketplace listing, social post, story). Choose several
 * audiences to get the same ad written for each.
 */
/** Sample results from the ready-made apps, shown as the kind of thing this makes. */
const AD_EXAMPLES = ["/quick/product-ad.webp", "/quick/swap-ad.webp", "/quick/poster.webp", "/quick/product-grid.webp", "/quick/flat-lay.webp", "/quick/mockups.webp", "/quick/ugc-hand.webp", "/quick/product-in-hand.webp", "/quick/product-sequence.webp", "/templates/product-hero.webp", "/samples/ad-kettle.jpg"];

export function Ads() {
  const brands = useMemo(() => createBrandStore(defaultKv()), []);
  const products = useMemo(() => createProductStore(defaultKv()), []);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [address, setAddress] = useState("");
  const [list, setList] = useState<SavedProduct[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [formats, setFormats] = useState<string[]>(["product", "poster"]);
  const [audiences, setAudiences] = useState("");
  const [draft, setDraft] = useState({ name: "", words: "", price: "", picture: null as string | null });
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<Made[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [again, setAgain] = useState({ audiences: "", languages: "" });
  const [remade, setRemade] = useState<{ key: string; label: string; url?: string; problem?: string }[]>([]);

  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading draft…");
  const [remakeOpen, setRemakeOpen] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    void Promise.all([brands.list(), products.list(), idbKv().get<{kit:BrandKit|null;address:string;chosen:string[];formats:string[];audiences:string;draft:typeof draft;source:string|null;again:typeof again;made:Made[];remade:typeof remade}>("ads:draft:v1")]).then(([k,p,d]) => {
      setKits(k); setList(p);
      if (d) { setKit(d.kit); setAddress(d.address); setChosen(d.chosen); setFormats(d.formats); setAudiences(d.audiences); setDraft(d.draft); setSource(d.source); setAgain(d.again); setMade(d.made); setRemade(d.remade); }
      else setKit(k[0] ?? null);
      setReady(true);
    }).catch(() => { setProblem("Could not restore the Ads draft. Keep this page open while editing."); setReady(true); });
  }, [brands,products]);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Saving draft…");
    writes.current = writes.current.catch(() => undefined).then(() => idbKv().set("ads:draft:v1",{kit,address,chosen,formats,audiences,draft,source,again,made,remade}));
    const current=writes.current;
    void current.then(()=>{if(current===writes.current)setSaveStatus("Draft saved on this device");}).catch(()=>setSaveStatus("Draft could not be saved. Keep this page open."));
  }, [ready,kit,address,chosen,formats,audiences,draft,source,again,made,remade]);

  async function ownBrand() {
    const k = await brands.save({name:"My brand",url:"",logo:null,colors:[],fonts:[],about:"",tone:""});
    setKit(k);setKits(await brands.list());
  }

  const picked = list.filter((p) => chosen.includes(p.id));
  const jobs = adJobs(picked, AD_FORMATS.filter((f) => formats.includes(f.id)), audiences.split("\n"));

  async function read() {
    setBusy("Reading the site…");
    setProblem(null);
    const r = await readBrand(address);
    setBusy(null);
    if (!r.ok) return setProblem(r.reason);
    const saved = await brands.save(r.kit);
    setKit(saved);
    setKits(await brands.list());
  }

  async function useSample(id: string) {
    const sample = SAMPLES.find((x) => x.id === id);
    if (!sample) return;
    if ((kit || draft.name || chosen.length || audiences) && !window.confirm("Use this sample’s brand, product, formats and audiences? Cancel to keep your current setup. Saved products and completed ads stay.")) return;
    setProblem(null);
    setKit(await brands.save(sample.brand));
    setKits(await brands.list());
    const p = await products.save({ ...sample.product, picture: null, price: "" });
    setList(await products.list());
    setChosen([p.id]);
    setFormats(sample.formats);
    setAudiences(sample.audiences.join("\n"));
  }

  async function saveKit(next: BrandKit) {
    setKit(next);
    const saved = await brands.save(next);
    setKit(saved);
    setKits(await brands.list());
  }

  async function addProduct() {
    try {
      const p = await products.save(draft);
      setList(await products.list());
      setChosen((c) => [...c, p.id]);
      setDraft({ name: "", words: "", price: "", picture: null });
      setProblem(null);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That couldn't be saved.");
    }
  }

  async function addPicture(file: File) {
    setBusy("Adding…");
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture." : r.reason);
    setDraft((d) => ({ ...d, picture: r.url }));
  }

  async function run() {
    setProblem(null);
    const stamp = Date.now();
    setMade(jobs.map((j, i) => ({ key: `${stamp}-${i}`, format: j.format, product: j.product.name, audience: j.audience })));
    for (const [i, j] of jobs.entries()) {
      setBusy(`Making ad ${i + 1} of ${jobs.length}…`);
      const prompt = adPrompt(j.format, j.product, kit, j.audience);
      const r = await makeStill(prompt, j.format.ratio, j.product.picture ? [j.product.picture] : [], "");
      galleryStill(prompt, "Ad")(r);
      if (!r.ok && r.needsKey) { openKeys(); setBusy(null); return setProblem(r.reason); }
      setMade((cur) => cur.map((m) => (m.key === `${stamp}-${i}` ? (r.ok ? { ...m, url: r.url } : { ...m, problem: r.reason }) : m)));
    }
    setBusy(null);
  }

  const remakes = multiplierJobs(again.audiences.split("\n"), again.languages.split("\n"));

  async function addSource(file: File) {
    setBusy("Adding…");
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture of the ad." : r.reason);
    setSource(r.url);
  }

  async function remake() {
    if (!source) return;
    setProblem(null);
    const stamp = Date.now();
    const ratio = await shapeOf(source);
    setRemade(remakes.map((j, i) => ({ key: `${stamp}-${i}`, label: [j.audience, j.language].filter(Boolean).join(" · ") })));
    for (const [i, j] of remakes.entries()) {
      setBusy(`Remaking ad ${i + 1} of ${remakes.length}…`);
      const prompt = multiplyPrompt(j.audience, j.language);
      const r = await makeStill(prompt, ratio, [source], "");
      galleryStill(prompt, "Ad multiplier")(r);
      if (!r.ok && r.needsKey) { openKeys(); setBusy(null); return setProblem(r.reason); }
      setRemade((cur) => cur.map((m) => (m.key === `${stamp}-${i}` ? (r.ok ? { ...m, url: r.url } : { ...m, problem: r.reason }) : m)));
    }
    setBusy(null);
  }

  const toggle = (set: (f: (c: string[]) => string[]) => void, id: string) => set((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className="swap ads-studio">
          <ModeTabs group="Photos" current="/ads" canEdit={surfaceAvailable("Edit")} />
          {!kit && (
            <section className="ad-start" aria-label="Start with your brand">
              <span className="eyebrow">Ads</span>
              <h1>Ads that look like your brand.</h1>
              <p>Enter your website. haggs reads your name, logo, colours and tone, then makes a batch of ads for your products, up to {MAX_BATCH} at a time.</p>
              <form className="ad-url" onSubmit={(e) => { e.preventDefault(); if (address.trim().length >= 3) void read(); }}>
                <span aria-hidden>◍</span>
                <input ref={urlRef} aria-label="Website address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="www.yourwebsite.com" disabled={!ready || busy !== null} />
                <button className="fire" disabled={!ready || busy !== null || address.trim().length < 3}>{busy ?? "Read my brand"} <span className="cost">free</span></button>
              </form>
              <div className="ad-alt">
                <button className="plain" disabled={!ready || busy !== null} onClick={() => void ownBrand()}>Create a brand by hand</button>
                {kits.length > 0 && <span className="muted">or open one of yours:</span>}
                {kits.map((k) => <button key={k.id} className="pill" onClick={() => setKit(k)}>{k.name}</button>)}
              </div>
              <div className="ad-alt">
                <span className="muted">Try a sample:</span>
                {SAMPLES.map((x) => <button key={x.id} className="pill" disabled={!ready || busy !== null} onClick={() => void useSample(x.id)}>{x.label}</button>)}
              </div>
              {problem && <p className="library-error" role="alert">{problem}</p>}

              <div className="ad-strip" aria-label="Examples from the ready-made apps">
                <div className="ad-strip-row" aria-hidden>
                  {[...AD_EXAMPLES, ...AD_EXAMPLES].map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}
                </div>
              </div>

              <span className="eyebrow muted">Start with a tool</span>
              <div className="ad-tools">
                <button className="ad-tool" onClick={() => urlRef.current?.focus()}>
                  <video src="/templates/product-placement.mp4" muted loop autoPlay playsInline preload="metadata" />
                  <span><b>Make a batch of ads</b><small>Your products in every format, for every audience, in your colours.</small><em>Start with your website</em></span>
                </button>
                <button className="ad-tool" onClick={() => { setRemakeOpen(true); setTimeout(() => document.querySelector(".ads-remake")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>
                  <video src="/templates/product-orbit.mp4" muted loop autoPlay playsInline preload="metadata" />
                  <span><b>Remake an ad that works</b><small>The same product and layout, for new audiences and in other languages.</small><em>Add an ad</em></span>
                </button>
              </div>
            </section>
          )}

          {kit && (
          <div className="ads-workbench"><div className="ads-inputs"><fieldset disabled={!ready || busy !== null} className="cm-authoring">
          <div className="ad-brand">
            {kit.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-logo" src={kit.logo} alt={`${kit.name} logo`} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="ad-brand-mono" aria-hidden>{kit.name.slice(0, 1)}</span>}
            <span><b>{kit.name}</b><small>{kit.about || "No line yet"}</small></span>
            <span className="ads-swatches" aria-hidden>{kit.colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}</span>
            <button className="plain" onClick={() => setKit(null)}>Use another brand</button>
          </div>
          <details className="ad-brand-edit">
            <summary>Edit the brand</summary>
            <div className="ac-form">
              <label className="wf-field"><span>Name</span><input value={kit.name} maxLength={60} onChange={(e) => setKit({ ...kit, name: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>What it sells, in a line</span><textarea rows={2} value={kit.about} maxLength={300} onChange={(e) => setKit({ ...kit, about: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>Tone</span><input value={kit.tone} maxLength={120} placeholder="warm, handmade, a little playful" onChange={(e) => setKit({ ...kit, tone: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>Colours (comma separated)</span><input value={kit.colors.join(", ")} onChange={(e) => setKit({ ...kit, colors: e.target.value.split(/[\s,]+/).filter(Boolean).slice(0, 5) })} onBlur={() => void saveKit(kit)} /></label>
            </div>
          </details>

          <h2 className="ads-h">1. The products</h2>
          {list.length > 0 && (
            <div className="cm-cast" aria-label="Your products">
              {list.map((p) => (
                <button key={p.id} className={chosen.includes(p.id) ? "on" : ""} aria-pressed={chosen.includes(p.id)} onClick={() => toggle(setChosen, p.id)}>
                  {p.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.picture} alt="" /> : <span className="cm-noimg">{p.name.slice(0, 1)}</span>}
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="ac-form">
            <label className="wf-field"><span>Product name</span><input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ember mug" /></label>
            <label className="wf-field"><span>What it looks like</span><textarea rows={2} value={draft.words} maxLength={300} onChange={(e) => setDraft({ ...draft, words: e.target.value })} placeholder="a speckled terracotta stoneware mug with a thumb handle" /></label>
            <label className="wf-field"><span>Price or offer (optional)</span><input value={draft.price} maxLength={80} onChange={(e) => setDraft({...draft,price:e.target.value})} /></label>
            <div className="cm-row">
              <label className="pill">{draft.picture ? "Change the photo" : "Add a photo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} /></label>
              {draft.picture && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-thumb" src={draft.picture} alt="The product" />}
              <button className="fire" disabled={!draft.name.trim()} onClick={() => void addProduct()}>Add product</button>
            </div>
          </div>

          <h2 className="ads-h">2. The ads</h2>
          <div className="cm-cast" aria-label="Formats">
            {AD_FORMATS.map((f) => <button key={f.id} className={formats.includes(f.id) ? "on" : ""} aria-pressed={formats.includes(f.id)} onClick={() => toggle(setFormats, f.id)}><span>{f.name} <small>{f.ratio}</small></span></button>)}
          </div>
          <label className="wf-field"><span>Audiences, one per line (optional): the same ad for each</span>
            <textarea rows={2} value={audiences} onChange={(e) => setAudiences(e.target.value)} placeholder={"students on a budget\nnew parents"} />
          </label>
          </fieldset></div>
          <aside className="ads-preview" aria-label="Ad batch preview">
            <h2>Review your batch</h2><p className="wf-small" role="status">{saveStatus}</p>
            <p><b>{kit?.name || "Your brand"}</b> · {picked.length} product{picked.length === 1 ? "" : "s"} · {formats.length} formats</p>
            {picked[0]?.picture && <img className="ads-preview-product" src={picked[0].picture} alt={picked[0].name} />}
            <p className="wf-small">Planning preview, not generated artwork. {jobs.length ? "Check these combinations before making the batch." : "Add and select a product, then choose at least one format."}</p>
            <ol className="ads-plan">{jobs.map((j,i)=><li key={i}><b>{j.product.name}</b> · {j.format.name} · {j.format.ratio}{j.audience ? ` · ${j.audience}` : ""}</li>)}</ol>
          <p><button className="fire" disabled={busy !== null || jobs.length === 0} onClick={() => void run()}>{busy ?? `Make ${jobs.length} ad${jobs.length === 1 ? "" : "s"}`} {jobs.length > 0 && <span className="cost">about {creditsText((jobs.length * PRICE))}</span>}</button></p>
          {jobs.length === MAX_BATCH && <p className="muted">A batch is at most {MAX_BATCH}. Choose fewer products, formats or audiences to change what is in it.</p>}
          {problem && <p className="library-error" role="alert">{problem}</p>}

          </aside></div>
          )}

          {made.length > 0 && (
            <ul className="ads-grid" aria-label="Your ads">
              {made.map((m) => (
                <li key={m.key}>
                  {m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={`${m.product}, ${m.format.name}`} /> : <div className="ads-wait">{m.problem ?? "Waiting…"}</div>}
                  <small>{m.product} · {m.format.name}{m.audience ? ` · ${m.audience}` : ""}</small>
                  {m.url && <a href={m.url} download>Download</a>}
                  {m.url && <button className="plain" onClick={() => { setSource(m.url!); setRemakeOpen(true); setProblem(null); }}>Remake this</button>}
                </li>
              ))}
            </ul>
          )}

          <details className="ads-remake" open={remakeOpen} onToggle={(e) => setRemakeOpen(e.currentTarget.open)}><summary>Remake an existing ad · optional</summary>
          <h2 className="ads-h">Remake an ad</h2>
          <p className="muted">Have an ad that works? Add it (or press Remake this on one above) and get it back for other audiences and in other languages, with the same product and layout.</p>
          <div className="cm-row">
            <label className="pill">{source ? "Change the ad" : "Add an ad"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addSource(f); }} /></label>
            {source && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-thumb" src={source} alt="The ad to remake" />}
          </div>
          <div className="ac-form">
            <label className="wf-field"><span>Audiences, one per line (optional)</span><textarea rows={2} value={again.audiences} onChange={(e) => setAgain({ ...again, audiences: e.target.value })} placeholder={"new parents\nretired hikers"} /></label>
            <label className="wf-field"><span>Languages, one per line (optional)</span><textarea rows={2} value={again.languages} onChange={(e) => setAgain({ ...again, languages: e.target.value })} placeholder={"Spanish\nFrench"} /></label>
          </div>
          <p><button className="fire" disabled={busy !== null || !source || remakes.length === 0} onClick={() => void remake()}>{busy ?? `Remake ${remakes.length} time${remakes.length === 1 ? "" : "s"}`} {remakes.length > 0 && <span className="cost">about {creditsText((remakes.length * PRICE))}</span>}</button></p>
          {remade.length > 0 && (
            <ul className="ads-grid" aria-label="Your remade ads">
              {remade.map((m) => (
                <li key={m.key}>
                  {m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.label} /> : <div className="ads-wait">{m.problem ?? "Waiting…"}</div>}
                  <small>{m.label}</small>
                  {m.url && <a href={m.url} download>Download</a>}
                </li>
              ))}
            </ul>
          )}
          </details>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
