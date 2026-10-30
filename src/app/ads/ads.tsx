"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./ads.module.css";
import { prepareAdHandoff } from "../../brand/ad-handoff";
import { TEMPLATES } from "../../brand/marketing";
import { shrinkPicture, shrinkAll } from "../shrink";
import { useEffect, useMemo, useRef, useState } from "react";

import { AD_FORMATS, adJobs, adPrompt, MAX_BATCH, EMPTY_AD_BRIEF, plannedAdCount, type AdBrief, type AdFormat } from "../../brand/ads";
import { SAMPLES } from "../../brand/samples";
import { createBrandStore, type BrandKit } from "../../brand/brand";
import { multiplierJobs, multiplyPrompt, nearestRatio, swaps, type Swap } from "../../brand/multiplier";
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
import { ProductPhoto } from "../product-photo";
import { creditsText } from "../../story/price-text";

const PRICE = 0.07;

type Made = { key: string; format: AdFormat; product: string; audience: string; prompt?: string; url?: string; problem?: string };

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
  const router = useRouter();
  const [brief, setBrief] = useState<AdBrief>(EMPTY_AD_BRIEF);
  const running = useRef(false);
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
  const AGAIN = { audiences: "", languages: "", product: "", hook: "", cta: "", notes: "" };
  const [again, setAgain] = useState(AGAIN);
  const [sourceShape, setSourceShape] = useState<ReturnType<typeof nearestRatio>>("1:1");
  const [over, setOver] = useState(false);
  const adFile = useRef<HTMLInputElement>(null);
  const [remade, setRemade] = useState<{ key: string; label: string; url?: string; problem?: string }[]>([]);

  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading draft…");
  const [remakeOpen, setRemakeOpen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    void Promise.all([brands.list(), products.list(), idbKv().get<{brief?:AdBrief;kit:BrandKit|null;address:string;chosen:string[];formats:string[];audiences:string;draft:typeof draft;source:string|null;again:typeof again;made:Made[];remade:typeof remade}>("ads:draft:v1")]).then(([k,p,d]) => {
      setKits(k); setList(p);
      if (d) { setBrief({ ...EMPTY_AD_BRIEF, ...d.brief }); setKit(d.kit); setAddress(d.address); setChosen(d.chosen); setFormats(d.formats); setAudiences(d.audiences); setDraft(d.draft); setSource(d.source); setAgain({ ...AGAIN, ...d.again }); setMade(d.made); setRemade(d.remade); }
      else setKit(k[0] ?? null);
      setReady(true);
    }).catch(() => { setProblem("Could not restore the Ads draft. Keep this page open while editing."); setReady(true); });
  }, [brands,products]);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus("Saving draft…");
    writes.current = writes.current.catch(() => undefined).then(() => idbKv().set("ads:draft:v1",{brief,kit,address,chosen,formats,audiences,draft,source,again,made,remade}));
    const current=writes.current;
    void current.then(()=>{if(current===writes.current)setSaveStatus("Draft saved on this device");}).catch(()=>setSaveStatus("Draft could not be saved. Keep this page open."));
  }, [ready,brief,kit,address,chosen,formats,audiences,draft,source,again,made,remade]);

  async function ownBrand() {
    const k = await brands.save({name:"My brand",url:"",logo:null,colors:[],fonts:[],about:"",tone:""});
    setKit(k);setKits(await brands.list());
  }

  const picked = list.filter((p) => chosen.includes(p.id));
  const jobs = adJobs(picked, AD_FORMATS.filter((f) => formats.includes(f.id)), audiences.split("\n"));

  const planned = plannedAdCount(picked.length, formats.length, audiences.split("\n"));
  const directions = TEMPLATES.filter((t) => ["ads-social", "ads-callout", "poster-bold", "poster-minimal"].includes(t.id));

  async function continueAd(url: string, to: "Video" | "Edit", prompt = "") {
    setBusy("Preparing the ad…");
    try {
      const route = await prepareAdHandoff(url, to, prompt, {
        shrink: shrinkPicture, save: (key, value) => sessionStorage.setItem(key, value),
      });
      router.push(route);
    } catch { setProblem("Could not pass the ad to the next studio. Your result is still here; try again."); }
    finally { setBusy(null); }
  }

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
    const p = await products.save({ name: sample.product.name, words: sample.product.words, picture: sample.product.picture ?? null, price: "" });
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
    if (!ready || busy || running.current || !kit || !jobs.length) return;
    running.current = true;
    setProblem(null);
    const stamp = Date.now();
    const batch = jobs.map((j, i) => ({ key: `${stamp}-${i}`, format: j.format, product: j.product.name, audience: j.audience, prompt: adPrompt(j.format, j.product, kit, j.audience, brief) }));
    setMade((old) => [...batch, ...old]);
    try {
      for (const [i, j] of jobs.entries()) {
        setBusy(`Making ad ${i + 1} of ${jobs.length}…`);
        const refs = await shrinkAll(j.product.picture ? [j.product.picture] : []);
        const r = await makeStill(batch[i]!.prompt, j.format.ratio, refs, "");
        galleryStill(batch[i]!.prompt, "Ad")(r);
        setMade((cur) => cur.map((m) => m.key === batch[i]!.key ? (r.ok ? { ...m, url: r.url } : { ...m, problem: r.reason }) : m));
        if (!r.ok) {
          if (r.needsKey) openKeys();
          setMade((cur) => cur.map((m) => batch.slice(i + 1).some((b) => b.key === m.key) ? { ...m, problem: "Not submitted — batch stopped. Review the issue before making another batch." } : m));
          setProblem(r.reason);
          break;
        }
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The batch stopped. Check your library before submitting again.");
      setMade((cur) => cur.map((m) => batch.some((b) => b.key === m.key) && !m.url && !m.problem ? { ...m, problem: "Interrupted — check your library before submitting again." } : m));
    } finally { setBusy(null); running.current = false; }
  }

  const swapIn = list.find((p) => p.id === again.product);
  const swap: Swap = { ...(swapIn ? { product: { name: swapIn.name, words: swapIn.words, picture: Boolean(swapIn.picture) } } : {}), hook: again.hook, cta: again.cta, notes: again.notes };
  const remakes = multiplierJobs(again.audiences.split("\n"), again.languages.split("\n"), swaps(swap));
  useEffect(() => { if (source) void shapeOf(source).then(setSourceShape); }, [source]);

  async function addSource(file: File) {
    setBusy("Adding…");
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProblem(r.ok ? "Add a picture of the ad." : r.reason);
    setSource(r.url);
    setRemade([]);
  }

  async function remake() {
    if (!ready || busy || running.current || !source || !remakes.length) return;
    running.current = true;
    setBusy("Preparing versions…");
    setProblem(null);
    const stamp = Date.now();
    const batch = remakes.map((j, i) => ({ key: `${stamp}-${i}`, label: [j.audience, j.language].filter(Boolean).join(" · ") || "New version" }));
    setRemade(batch);
    try {
      const ratio = await shapeOf(source);
      const refs = await shrinkAll(swapIn?.picture ? [source, swapIn.picture] : [source]);
      for (const [i, j] of remakes.entries()) {
        setBusy(`Remaking ad ${i + 1} of ${remakes.length}…`);
        const prompt = multiplyPrompt(j.audience, j.language, swap);
        const r = await makeStill(prompt, ratio, refs, "");
        galleryStill(prompt, "Ad multiplier")(r);
        setRemade((cur) => cur.map((m) => m.key === batch[i]!.key ? (r.ok ? { ...m, url: r.url } : { ...m, problem: r.reason }) : m));
        if (!r.ok) {
          if (r.needsKey) openKeys();
          setRemade((cur) => cur.map((m) => batch.slice(i + 1).some((b) => b.key === m.key) ? { ...m, problem: "Not submitted — batch stopped." } : m));
          setProblem(r.reason);
          break;
        }
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The batch stopped. Check your library before submitting again.");
      setRemade((cur) => cur.map((m) => batch.some((b) => b.key === m.key) && !m.url && !m.problem ? { ...m, problem: "Interrupted — check your library before submitting again." } : m));
    } finally { setBusy(null); running.current = false; }
  }

  const toggle = (set: (f: (c: string[]) => string[]) => void, id: string) => set((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="app">
      <Nav current="Photos" />
      <div className="canvas">
        <div className={`swap ads-studio ${styles.studio}`}>
          <ModeTabs group="Photos" current="/ads" canEdit={surfaceAvailable("Edit")} />
          <header className={styles.header}>
            <div><span className="eyebrow">Ads studio</span><h1>One brand. Your next campaign.</h1><p>Shape the idea, review every variation, then make it yours.</p></div>
            <Link className="pill" href="/marketing">Explore Marketing templates</Link>
          </header>
          {!remakeOpen && <div className={styles.steps} aria-label="Campaign progress">
            <span data-done={Boolean(kit)}>01 <b>Brand</b><small>{kit?.name || "Import or create"}</small></span>
            <span data-done={picked.length > 0}>02 <b>Products</b><small>{picked.length ? `${picked.length} selected` : "Use your saved products"}</small></span>
            <span data-done={jobs.length > 0}>03 <b>Creative & formats</b><small>{jobs.length ? `${jobs.length} planned ads` : "Build your batch"}</small></span>
            <span data-done={made.some((m) => m.url)}>04 <b>Review & create</b><small>Price before generation</small></span>
          </div>}
          <div className="rx-filter ad-views" role="group" aria-label="Ads tools">
            <button aria-pressed={!remakeOpen} disabled={busy !== null} onClick={() => { setRemakeOpen(false); setProblem(null); }}>Make a batch</button>
            <button aria-pressed={remakeOpen} disabled={busy !== null} onClick={() => { setRemakeOpen(true); setProblem(null); }}>Remake an ad</button>
          </div>
          {!kit && !remakeOpen && (
            <section className="ad-start" aria-label="Start with your brand">
              <span className="eyebrow">Ads</span>
              <h2>Start with what makes you, you.</h2>
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
                <span className="muted">Sample brand setups:</span>
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
                  <span><b>Make a batch of ads</b><small>Choose products, a creative direction and formats. Review the batch before spending.</small><em>Start with your website</em></span>
                </button>
                <button className="ad-tool" onClick={() => { setRemakeOpen(true); setProblem(null); }}>
                  <video src="/templates/product-orbit.mp4" muted loop autoPlay playsInline preload="metadata" />
                  <span><b>Remake an ad that works</b><small>The same product and layout, for new audiences and in other languages.</small><em>Add an ad</em></span>
                </button>
              </div>

              <span className="eyebrow muted">How it works</span>
              <ol className="ad-how">
                <li><i>1</i><b>Your brand, from your website</b><small>Name, logo, colours and tone are read for you. Edit anything. Free.</small></li>
                <li><i>2</i><b>Add what you sell</b><small>A name, a line about how it looks, and a photo if you have one, so the ads show the real thing.</small></li>
                <li><i>3</i><b>Every size at once</b><small>Product shots, posters, listings, social posts and stories in 16:9, 9:16, 1:1 and 4:5, for each audience you name.</small></li>
                <li><i>4</i><b>See the batch, then make it</b><small>Every planned ad is laid out with its price before anything is made. Up to {MAX_BATCH} at a time.</small></li>
              </ol>
            </section>
          )}

          {kit && !remakeOpen && (
          <div className="cx ad-cx">
            <aside className="cx-builder" aria-label="Set up the batch">
              <fieldset disabled={!ready || busy !== null} className="cx-scroll cm-authoring">
                <span className="eyebrow">Campaign setup</span>
                <div className="ad-brand">
                  {kit.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-logo" src={kit.logo} alt={`${kit.name} logo`} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <span className="ad-brand-mono" aria-hidden>{kit.name.slice(0, 1)}</span>}
                  <span><b>{kit.name}</b><small>{kit.about || "No line yet"}</small></span>
                  <span className="ads-swatches" aria-hidden>{kit.colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}</span>
                </div>
                <button className="plain ad-switch" onClick={() => setKit(null)}>Use another brand</button>

                <details className="cx-sec">
                  <summary><b>The brand</b><small>{kit.tone || "edit name, line, tone, colours"}</small></summary>
                  <label className="wf-field"><span>Name</span><input value={kit.name} maxLength={60} onChange={(e) => setKit({ ...kit, name: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
                  <label className="wf-field"><span>What it sells, in a line</span><textarea rows={2} value={kit.about} maxLength={300} onChange={(e) => setKit({ ...kit, about: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
                  <label className="wf-field"><span>Tone</span><input value={kit.tone} maxLength={120} placeholder="warm, handmade, a little playful" onChange={(e) => setKit({ ...kit, tone: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
                  <label className="wf-field"><span>Colours (comma separated)</span><input value={kit.colors.join(", ")} onChange={(e) => setKit({ ...kit, colors: e.target.value.split(/[\s,]+/).filter(Boolean).slice(0, 5) })} onBlur={() => void saveKit(kit)} /></label>
                </details>

                <details className="cx-sec" open>
                  <summary><b>1. The products</b><i>{list.length}</i><small>{picked.length ? picked.map((p) => p.name).join(", ") : "pick or add one"}</small></summary>
                  {list.length > 0 && (
                    <div className="cm-cast" aria-label="Your products">
                      {list.map((p) => (
                        <button key={p.id} className={chosen.includes(p.id) ? "on" : ""} aria-pressed={chosen.includes(p.id)} onClick={() => { toggle(setChosen, p.id); setFocus(p.id); }}>
                          {p.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.picture} alt="" /> : <span className="cm-noimg">{p.name.slice(0, 1)}<em className="pp-none">no photo</em></span>}
                          <span>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const p = list.find((x) => x.id === focus) ?? list.find((x) => chosen.includes(x.id) && !x.picture) ?? null;
                    return p ? <ProductPhoto key={p.id} product={p} onPicture={async (url) => { await products.save({ ...p, picture: url }); setList(await products.list()); }} /> : null;
                  })()}
                  <div className="ad-add">
                    <label className="wf-field"><span>Add a product</span><input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ember mug" /></label>
                    <textarea rows={2} value={draft.words} maxLength={300} onChange={(e) => setDraft({ ...draft, words: e.target.value })} placeholder="What it looks like: a speckled terracotta stoneware mug with a thumb handle" aria-label="What it looks like" />
                    <input value={draft.price} maxLength={80} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Price or offer (optional)" aria-label="Price or offer" />
                    <div className="cm-row">
                      <label className="pill">{draft.picture ? "Change the photo" : "Add a photo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} /></label>
                      {draft.picture && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-thumb" src={draft.picture} alt="The product" />}
                      <button className="pill" disabled={!draft.name.trim()} onClick={() => void addProduct()}>Add it</button>
                    </div>
                  </div>
                </details>

                <details className="cx-sec" open>
                  <summary><b>2. The sizes</b><i>{AD_FORMATS.length}</i><small>{formats.length} chosen</small></summary>
                  <div className="ad-shapes" aria-label="Formats">
                    {AD_FORMATS.map((f) => (
                      <button key={f.id} className={formats.includes(f.id) ? "on" : ""} aria-pressed={formats.includes(f.id)} onClick={() => toggle(setFormats, f.id)}>
                        <i style={{ aspectRatio: f.ratio.replace(":", " / ") }} aria-hidden />
                        <b>{f.name}</b><small>{f.ratio}</small>
                      </button>
                    ))}
                  </div>
                </details>

                <details className="cx-sec" open={audiences.trim().length > 0}>
                  <summary><b>3. Who it is for</b><small>{audiences.split("\n").filter((a) => a.trim()).length || "everyone"}</small></summary>
                  <label className="wf-field"><span>Audiences, one per line: the same ad written for each</span>
                    <textarea rows={3} value={audiences} onChange={(e) => setAudiences(e.target.value)} placeholder={"students on a budget\nnew parents"} />
                  </label>
                </details>
                <details className="cx-sec" open>
                  <summary><b>4. The campaign brief</b><small>optional</small></summary>
                  <label className="wf-field"><span>Headline</span><input maxLength={120} value={brief.headline} onChange={(e) => setBrief({ ...brief, headline: e.target.value })} placeholder="Your message, in your words" /></label>
                  <label className="wf-field"><span>Call to action</span><input maxLength={60} value={brief.cta} onChange={(e) => setBrief({ ...brief, cta: e.target.value })} placeholder="Shop the collection" /></label>
                  <label className="wf-field"><span>Creative notes</span><textarea rows={3} maxLength={400} value={brief.notes} onChange={(e) => setBrief({ ...brief, notes: e.target.value })} placeholder="The occasion, mood and facts the ad should communicate" /></label>
                  <p className="wf-small">Copy and product offers apply to text-based ads. Product shots and listings stay text-free. Check generated lettering and claims before publishing.</p>
                </details>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </fieldset>
              <div className="cx-foot">
                <button className="fire" disabled={!ready || busy !== null || jobs.length === 0} onClick={() => void run()}>{busy ?? (jobs.length ? `Make ${jobs.length} ad${jobs.length === 1 ? "" : "s"}` : !picked.length ? "Pick a product" : "Pick a size")} {jobs.length > 0 && <span className="cost">about {creditsText((jobs.length * PRICE))}</span>}</button>
              </div>
            </aside>

            <div className="cx-main">
              <section className={styles.directions} aria-label="Creative direction">
                <div className={styles.sectionHead}><div><span className="eyebrow">Creative direction</span><h2>Give the campaign a point of view.</h2></div><button className="plain" disabled={busy !== null || !brief.templateId} onClick={() => setBrief({ ...brief, templateId: "", direction: "" })}>Use format defaults</button></div>
                <p>Start with a direction from Marketing. Applies to posters, social and story ads; product shots and listings keep their format direction. Images below are template examples.</p>
                <div className={styles.templates}>{directions.map((t) => <button key={t.id} disabled={busy !== null} aria-pressed={brief.templateId === t.id} onClick={() => setBrief({ ...brief, templateId: t.id, direction: t.direction })}>
                  <img src={t.sample} alt="" loading="lazy" /><span><b>{t.name}</b><small>{brief.templateId === t.id ? "Selected direction" : "Use this direction"}</small></span>
                </button>)}</div>
              </section>
              <div className={styles.summary} role="status"><div><b>{jobs.length} ads in this batch</b><span>{picked.length} products · {formats.length} formats · {Math.max(1, audiences.split("\n").filter((a) => a.trim()).length)} audiences</span></div><strong>{creditsText(jobs.length * PRICE)}<small>estimated total</small></strong></div>
              {planned > MAX_BATCH && <p className="library-error" role="alert">Your selections describe {planned} ads. Only the first {MAX_BATCH} shown below will run; {planned - MAX_BATCH} are excluded. Narrow your selections to include a different mix.</p>}
              {picked.some((p) => !p.picture) && <p className="wf-small">Products without photos are drawn from their descriptions. Add a reference photo for a closer product match.</p>}
              {made.length > 0 && (
                <section className="cx-gallery" aria-label="Your ads">
                  <span className="eyebrow muted">Your ads · {made.filter((m) => m.url).length} of {made.length} made</span>
                  <ul className="ad-wall">
                    {made.map((m) => (
                      <li key={m.key}>
                        <div className="ad-tile" style={{ aspectRatio: m.format.ratio.replace(":", " / ") }}>
                          {m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={`${m.product}, ${m.format.name}`} /> : <span className="ad-tile-wait">{m.problem ?? (busy ? "Making…" : "Interrupted — check your library before making again.")}</span>}
                        </div>
                        <small>{m.product} · {m.format.name}{m.audience ? ` · ${m.audience}` : ""}</small>
                        {m.url && <span className="ad-tile-acts"><a href={m.url} download>Download</a><button className="plain" disabled={busy !== null} onClick={() => void continueAd(m.url!, "Video")}>Animate in Video</button>{surfaceAvailable("Edit") && <button className="plain" disabled={busy !== null} onClick={() => void continueAd(m.url!, "Edit", m.prompt)}>Edit</button>}<button className="plain" disabled={busy !== null} onClick={() => { setSource(m.url!); setRemade([]); setRemakeOpen(true); setProblem(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Remake this</button></span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="cx-gallery" aria-label="Ad batch preview">
                <div className="ad-plan-head">
                  <span className="eyebrow muted">{made.length ? "Next batch" : "Your batch"} · {jobs.length} ad{jobs.length === 1 ? "" : "s"}</span>
                  <small className="wf-small" role="status">{saveStatus}</small>
                </div>
                {jobs.length === 0 ? (
                  <div className="chars-sheet"><div className="wf-result-wait">Pick a product and at least one size. Every ad in the batch is laid out here, at its real shape, before anything is made.</div></div>
                ) : (
                  <ul className="ad-wall">
                    {jobs.map((j, i) => (
                      <li key={i}>
                        <div className="ad-tile plan" style={{ aspectRatio: j.format.ratio.replace(":", " / "), background: `linear-gradient(160deg, ${kit.colors[0] ?? "#1f1f23"}, ${kit.colors[1] ?? kit.colors[0] ?? "#0e0e10"})` }}>
                          {j.product.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={j.product.picture} alt="" /> : <span className="ad-tile-mono">{j.product.name.slice(0, 1)}</span>}
                          <em>Planned</em>
                        </div>
                        <small><b>{j.product.name}</b> · {j.format.name} {j.format.ratio}{j.audience ? ` · ${j.audience}` : ""}</small><details className={styles.prompt}><summary>Review prompt · {creditsText(PRICE)}</summary><p>{adPrompt(j.format, j.product, kit, j.audience, brief)}</p></details>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="wf-small">Tiles are the plan, not artwork: each becomes one picture, about {creditsText(PRICE)}.{jobs.length === MAX_BATCH ? ` A batch is at most ${MAX_BATCH}; choose fewer products, sizes or audiences to change what is in it.` : ""}</p>
              </section>
            </div>
          </div>
          )}

          {remakeOpen && (
          <div className="cx ad-cx">
            <aside className="cx-builder" aria-label="Remake an ad">
              <fieldset disabled={!ready || busy !== null} className="cx-scroll cm-authoring">
                <span className="eyebrow">Remake an ad</span>
                <h2 className="cx-title">One ad that works. Many versions.</h2>
                <p className="cx-lede">Add an ad you like. Keep its layout and look, and change the product, the words, who it speaks to or the language.</p>
                <button
                  className={`rx-drop${over ? " over" : ""}`}
                  onClick={() => adFile.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void addSource(f); }}
                >
                  <span aria-hidden>＋</span>
                  <b>{source ? "Use another ad" : "Add the ad to remake"}</b>
                  <small>A picture: png, jpg or webp. Drop it here or click.</small>
                </button>
                <input ref={adFile} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addSource(f); }} />
                <p className="dw-hint">A video ad? <Link href="/recreate">Recreate it shot by shot</Link> with your own cast.</p>

                <details className="cx-sec" open>
                  <summary><b>Your product instead</b><i>{list.length}</i><small>{swapIn?.name ?? "keep theirs"}</small></summary>
                  <div className="cm-cast" aria-label="Product to swap in">
                    <button className={!again.product ? "on" : ""} aria-pressed={!again.product} onClick={() => setAgain({ ...again, product: "" })}><span className="cm-noimg">=</span><span>Keep theirs</span></button>
                    {list.map((p) => (
                      <button key={p.id} className={again.product === p.id ? "on" : ""} aria-pressed={again.product === p.id} onClick={() => setAgain({ ...again, product: p.id })}>
                        {p.picture ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.picture} alt="" /> : <span className="cm-noimg">{p.name.slice(0, 1)}</span>}
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                  {list.length === 0 && <p className="dw-hint">Add products under Make a batch and they appear here.</p>}
                  {swapIn && !swapIn.picture && <p className="dw-hint">{swapIn.name} has no photo, so it is drawn from its description.</p>}
                </details>

                <details className="cx-sec" open={Boolean(again.hook || again.cta)}>
                  <summary><b>New words</b><small>{again.hook || again.cta ? "changed" : "keep theirs"}</small></summary>
                  <label className="wf-field"><span>Headline</span><input value={again.hook} maxLength={120} onChange={(e) => setAgain({ ...again, hook: e.target.value })} placeholder="Slow mornings, hot coffee" /></label>
                  <label className="wf-field"><span>Call to action</span><input value={again.cta} maxLength={60} onChange={(e) => setAgain({ ...again, cta: e.target.value })} placeholder="Shop the mug" /></label>
                </details>

                <details className="cx-sec" open={Boolean(again.audiences)}>
                  <summary><b>Who it is for</b><small>{again.audiences.split("\n").filter((a) => a.trim()).length || "the same people"}</small></summary>
                  <label className="wf-field"><span>Audiences, one per line: a version for each</span><textarea rows={2} value={again.audiences} onChange={(e) => setAgain({ ...again, audiences: e.target.value })} placeholder={"new parents\nretired hikers"} /></label>
                </details>

                <details className="cx-sec" open={Boolean(again.languages)}>
                  <summary><b>Languages</b><small>{again.languages.split("\n").filter((a) => a.trim()).length || "the same"}</small></summary>
                  <label className="wf-field"><span>One per line: every version in each</span><textarea rows={2} value={again.languages} onChange={(e) => setAgain({ ...again, languages: e.target.value })} placeholder={"Spanish\nFrench"} /></label>
                </details>

                <details className="cx-sec" open={Boolean(again.notes)}>
                  <summary><b>Anything else</b><small>{again.notes ? "noted" : "optional"}</small></summary>
                  <textarea className="dw-prompt" rows={2} maxLength={300} value={again.notes} onChange={(e) => setAgain({ ...again, notes: e.target.value })} placeholder="Make it night; put it on a kitchen counter" aria-label="Anything else to change" />
                </details>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </fieldset>
              <div className="cx-foot">
                <button className="fire" disabled={!ready || busy !== null || !source || remakes.length === 0} onClick={() => void remake()}>{busy ?? (!source ? "Add an ad first" : remakes.length ? `Make ${remakes.length} version${remakes.length === 1 ? "" : "s"}` : "Change something first")} {source && remakes.length > 0 && <span className="cost">about {creditsText((remakes.length * PRICE))}</span>}</button>
              </div>
            </aside>

            <div className="cx-main">
              {!source ? (
                <div className="chars-sheet"><div className="wf-result-wait">Add an ad, or press Remake this on one you made. It appears here with every version you plan beside it.</div></div>
              ) : (
                <section className="cx-gallery" aria-label="The ad and its versions">
                  <span className="eyebrow muted">The ad · and {remade.length ? `${remade.filter((m) => m.url).length} of ${remade.length} versions made` : `${remakes.length} planned version${remakes.length === 1 ? "" : "s"}`}</span>
                  <ul className="ad-wall">
                    <li>
                      <div className="ad-tile" style={{ aspectRatio: sourceShape.replace(":", " / ") }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={source} alt="The ad to remake" /><em>Original</em></div>
                      <small>The ad you added</small>
                    </li>
                    {(remade.length ? remade : remakes.map((j, i) => ({ key: `plan-${i}`, label: [j.audience, j.language].filter(Boolean).join(" · ") || "New version", url: undefined as string | undefined, problem: undefined as string | undefined }))).map((m) => (
                      <li key={m.key}>
                        <div className={`ad-tile${m.url ? "" : " plan"}`} style={{ aspectRatio: sourceShape.replace(":", " / ") }}>
                          {m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.label} /> : <span className="ad-tile-wait">{m.problem ?? (remade.length ? (busy ? "Making…" : "Interrupted — check your library before making again.") : "Planned")}</span>}
                        </div>
                        <small>{m.label}{swapIn ? ` · ${swapIn.name}` : ""}</small>
                        {m.url && <span className="ad-tile-acts"><a href={m.url} download>Download</a></span>}
                      </li>
                    ))}
                  </ul>
                  <p className="wf-small">Each version is one picture, about {creditsText(PRICE)}, the same shape as the ad you added.</p>
                </section>
              )}
            </div>
          </div>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
