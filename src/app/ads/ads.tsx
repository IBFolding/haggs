"use client";

import { useEffect, useMemo, useState } from "react";

import { AD_FORMATS, adJobs, adPrompt, MAX_BATCH, type AdFormat } from "../../brand/ads";
import { createBrandStore, type BrandKit } from "../../brand/brand";
import { multiplierJobs, multiplyPrompt, nearestRatio } from "../../brand/multiplier";
import { createProductStore, type SavedProduct } from "../../brand/product";
import { defaultKv } from "../../story/kv";
import { readBrand } from "../brand-actions";
import { galleryStill } from "../gallery-log";
import { ModeTabs } from "../mode-tabs";
import { Nav, openKeys } from "../nav";
import { makeStill } from "../series-actions";
import { SiteFooter } from "../site-footer";
import { surfaceAvailable } from "../studio";
import { uploadFile } from "../upload-client";

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

  useEffect(() => {
    void brands.list().then((k) => { setKits(k); setKit((cur) => cur ?? k[0] ?? null); });
    void products.list().then(setList);
  }, [brands, products]);

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
        <div className="swap">
          <ModeTabs group="Photos" current="/ads" canEdit={surfaceAvailable("Edit")} />
          <header className="swap-head">
            <h1>Ads</h1>
            <p>Give haggs a company&apos;s website and it reads the brand: name, logo, colours, fonts. Add the products, pick the formats, and make a batch of ads that look like they belong to that company.</p>
          </header>

          <h2 className="ads-h">1. The brand</h2>
          <div className="cm-row">
            <input aria-label="Website address" className="ads-url" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="kiln.example" />
            <button className="pill" disabled={busy !== null || address.trim().length < 3} onClick={() => void read()}>Read the site <span className="cost">free</span></button>
          </div>
          {kits.length > 1 && (
            <div className="cm-cast" aria-label="Your brands">
              {kits.map((k) => <button key={k.id} className={kit?.id === k.id ? "on" : ""} onClick={() => setKit(k)}><span>{k.name}</span></button>)}
            </div>
          )}
          {kit && (
            <div className="ac-form">
              <label className="wf-field"><span>Name</span><input value={kit.name} maxLength={60} onChange={(e) => setKit({ ...kit, name: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>What it sells, in a line</span><textarea rows={2} value={kit.about} maxLength={300} onChange={(e) => setKit({ ...kit, about: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>Tone</span><input value={kit.tone} maxLength={120} placeholder="warm, handmade, a little playful" onChange={(e) => setKit({ ...kit, tone: e.target.value })} onBlur={() => void saveKit(kit)} /></label>
              <label className="wf-field"><span>Colours (comma separated)</span><input value={kit.colors.join(", ")} onChange={(e) => setKit({ ...kit, colors: e.target.value.split(/[\s,]+/).filter(Boolean).slice(0, 5) })} onBlur={() => void saveKit(kit)} /></label>
              <div className="ads-swatches" aria-hidden>{kit.colors.map((c) => <i key={c} style={{ background: c }} title={c} />)}</div>
              {kit.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-logo" src={kit.logo} alt={`${kit.name} logo`} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            </div>
          )}

          <h2 className="ads-h">2. The products</h2>
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
            <div className="cm-row">
              <label className="pill">{draft.picture ? "Change the photo" : "Add a photo"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} /></label>
              {draft.picture && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-thumb" src={draft.picture} alt="The product" />}
              <button className="fire" disabled={!draft.name.trim()} onClick={() => void addProduct()}>Add product</button>
            </div>
          </div>

          <h2 className="ads-h">3. The ads</h2>
          <div className="cm-cast" aria-label="Formats">
            {AD_FORMATS.map((f) => <button key={f.id} className={formats.includes(f.id) ? "on" : ""} aria-pressed={formats.includes(f.id)} onClick={() => toggle(setFormats, f.id)}><span>{f.name} <small>{f.ratio}</small></span></button>)}
          </div>
          <label className="wf-field"><span>Audiences, one per line (optional): the same ad for each</span>
            <textarea rows={2} value={audiences} onChange={(e) => setAudiences(e.target.value)} placeholder={"students on a budget\nnew parents"} />
          </label>
          <p><button className="fire" disabled={busy !== null || jobs.length === 0} onClick={() => void run()}>{busy ?? `Make ${jobs.length} ad${jobs.length === 1 ? "" : "s"}`} {jobs.length > 0 && <span className="cost">about ${(jobs.length * PRICE).toFixed(2)}</span>}</button></p>
          {jobs.length === MAX_BATCH && <p className="muted">A batch is at most {MAX_BATCH}. Choose fewer products, formats or audiences to change what is in it.</p>}
          {problem && <p className="library-error" role="alert">{problem}</p>}

          {made.length > 0 && (
            <ul className="ads-grid" aria-label="Your ads">
              {made.map((m) => (
                <li key={m.key}>
                  {m.url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={`${m.product}, ${m.format.name}`} /> : <div className="ads-wait">{m.problem ?? "Waiting…"}</div>}
                  <small>{m.product} · {m.format.name}{m.audience ? ` · ${m.audience}` : ""}</small>
                  {m.url && <a href={m.url} download>Download</a>}
                  {m.url && <button className="plain" onClick={() => { setSource(m.url!); setProblem(null); }}>Remake this</button>}
                </li>
              ))}
            </ul>
          )}

          <h2 className="ads-h">4. Remake an ad</h2>
          <p className="muted">Have an ad that works? Add it (or press Remake this on one above) and get it back for other audiences and in other languages, with the same product and layout.</p>
          <div className="cm-row">
            <label className="pill">{source ? "Change the ad" : "Add an ad"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addSource(f); }} /></label>
            {source && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ads-thumb" src={source} alt="The ad to remake" />}
          </div>
          <div className="ac-form">
            <label className="wf-field"><span>Audiences, one per line (optional)</span><textarea rows={2} value={again.audiences} onChange={(e) => setAgain({ ...again, audiences: e.target.value })} placeholder={"new parents\nretired hikers"} /></label>
            <label className="wf-field"><span>Languages, one per line (optional)</span><textarea rows={2} value={again.languages} onChange={(e) => setAgain({ ...again, languages: e.target.value })} placeholder={"Spanish\nFrench"} /></label>
          </div>
          <p><button className="fire" disabled={busy !== null || !source || remakes.length === 0} onClick={() => void remake()}>{busy ?? `Remake ${remakes.length} time${remakes.length === 1 ? "" : "s"}`} {remakes.length > 0 && <span className="cost">about ${(remakes.length * PRICE).toFixed(2)}</span>}</button></p>
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
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
