"use client";

import { contestVariant } from "../../../comfy/contest-lab";
import { haggsPreview } from "../../../comfy/haggs-preview";
import { ltxWorkflow } from "../../../comfy/ltx";
import { track } from "../../../activity/activity";
import { BankPicker, useReturnedPick } from "../../bank-picker";
import type { BankItem } from "../../../story/bank";
import { uploadFile } from "../../upload-client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Field } from "../../../comfy/apps";
import { defaultKv } from "../../../story/kv";
import { createRunStore, type PictureRun, type Run } from "../../../story/runs";
import { appFile, createAppStore, type Cover, type SavedApp } from "../../../story/apps";
import type { Canvas } from "../../../comfy/canvas";
import type { Recipe } from "../../../comfy/recipe";
import { chargeRun, refundRun } from "../../../community/community";
import { dbOf } from "../../../community/supabase-db";
import { Nav, openKeys } from "../../nav";
import { supabase } from "../../session";
import { SaveToProject } from "../../save-to-project";
import { preflightWorkflow, type Preflight, openWorkflow, quoteWorkflow, runWorkflow, type Graph, type OpenedApp, type Quote, type Source, type WorkflowResult } from "../../workflow-actions";
import { creditsText } from "../../../story/price-text";

/**
 * One Comfy workflow as an app: drop your files where its examples are,
 * change its words and a few settings, press Run. The Nodes tab shows the
 * graph it runs, as its author laid it out.
 */

const keyOf = (f: Field) => `${f.node}/${f.input}`;

async function addFile(file: File): Promise<string> {
  // In development the file goes to the local media folder; otherwise it travels with the run.
  const added = await uploadFile(file);
  if (added.ok) return added.url;
  // Hosted, a file can't travel inside the request (Vercel allows 4.5 MB), so a failed upload is the end of it.
  if (process.env.NEXT_PUBLIC_HOSTED === "1") throw new Error(added.reason);
  if (file.size > 20 * 1024 * 1024) throw new Error(added.reason);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

function MediaDrop({ field, value, onChange, onBusy }: { field: Extract<Field, { kind: "media" }>; value: string | undefined; onChange: (url: string | undefined) => void; onBusy?: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState(false);
  const shown = value ?? field.sample;
  const accept = field.media === "image" ? "image/*" : field.media === "video" ? "video/*" : "audio/*";

  async function take(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith(field.media)) return setError(`This needs ${field.media === "image" ? "a picture" : field.media === "video" ? "a video" : "a sound"}.`);
    setBusy(true);
    onBusy?.(true);
    setError(null);
    try {
      onChange(await addFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file couldn't be added.");
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  return (
    <div
      className={`wf-drop${over ? " over" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
    >
      <span className="wf-drop-label">{field.label}</span>
      <button className="wf-drop-face" onClick={() => input.current?.click()} aria-label={`Choose ${field.label.toLowerCase()}`}>
        {shown ? (
          field.media === "image" ? <img src={shown} alt="" /> : field.media === "video" ? <video src={shown} muted loop autoPlay playsInline /> : <audio src={shown} controls />
        ) : (
          <span className="wf-drop-empty">Drop {field.media === "image" ? "a picture" : field.media === "video" ? "a video" : "a sound"} here</span>
        )}
      </button>
      <span className="wf-drop-foot">
        {busy ? "Adding…" : value ? <>Yours · <button className="plain" onClick={() => onChange(undefined)}>use the example</button></> : field.sample ? "The example — drop your own" : "Choose or drop a file"}
        {field.media === "image" && <> · <button className="plain" onClick={() => setBank(true)}>From your bank</button></>}
      </span>
      {bank && <BankPicker kinds={["character", "place", "accessory"]} label="this workflow" onClose={() => setBank(false)} onPick={(item) => { if (item.image) onChange(item.image); else setError("That one has no picture yet. Open it and add one."); }} />}
      {error && <span className="library-error" role="alert">{error}</span>}
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
    </div>
  );
}

const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video/");

/** The graph as its author laid it out: each node a card, its file or result inside, wires between them. */
function Nodes({ graph, media, output }: { graph: Graph; media: Record<string, string>; output: { node: string | null; url: string | null } }) {
  const box = useMemo(() => {
    if (!graph.nodes.length) return { x: 0, y: 0, w: 800, h: 400 };
    const x = Math.min(...graph.nodes.map((n) => n.x)) - 40;
    const y = Math.min(...graph.nodes.map((n) => n.y)) - 40;
    return { x, y, w: Math.max(...graph.nodes.map((n) => n.x + n.w)) - x + 40, h: Math.max(...graph.nodes.map((n) => n.y + n.h)) - y + 40 };
  }, [graph]);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div className="wf-nodes">
      <div className="wf-nodes-stage" style={{ aspectRatio: `${box.w} / ${box.h}` }}>
        <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="none" aria-hidden="true">
          {graph.links.map((l, i) => {
            const a = byId.get(l.from)!;
            const b = byId.get(l.to)!;
            const x1 = a.x + a.w, y1 = a.y + 26, x2 = b.x, y2 = b.y + 26;
            const bend = Math.max(60, Math.abs(x2 - x1) / 2);
            return <path key={i} d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`} className="wf-wire" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {graph.nodes.map((n) => {
          const shown = n.id === output.node ? output.url : (media[n.id] ?? n.media);
          return (
            <div key={n.id} className={`wf-card${n.id === output.node ? " out" : ""}`} style={{ left: pct(n.x - box.x, box.w), top: pct(n.y - box.y, box.h), width: pct(n.w, box.w), height: pct(n.h, box.h) }}>
              <span className="wf-card-title">{n.title}</span>
              {shown ? (isVideo(shown) ? <video src={shown} muted loop autoPlay playsInline /> : <img src={shown} alt="" />) : n.note ? <p className="wf-card-note">{n.note}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A file as a data URI, so an app's cover travels inside its file. Covers over 8 MB are left out. */
async function embed(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
  if (!blob || blob.size > 8 * 1024 * 1024) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export function WorkflowApp({ name, file, recipe, canvas, saved: savedApp, onBack }: { name: string; file?: string; recipe?: Recipe; canvas?: Canvas; saved?: SavedApp; onBack?: () => void }) {
  const [destination, setDestination] = useState<"local" | "cloud">("local");
  const source: Source = useMemo(() => ({...(file ? { file } : { template: name }), destination}), [name, file, destination]);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkVersion,setCheckVersion] = useState(0);

  const [opened, setOpened] = useState<OpenedApp | null>(null);
  const [tab, setTab] = useState<"app" | "nodes">("app");
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [adding, setAdding] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [saving, setSaving] = useState<PictureRun | null>(null);
  const [kept, setKept] = useState<PictureRun | null>(null);
  const runs = useMemo(() => createRunStore(defaultKv()), []);
  const apps = useMemo(() => createAppStore(defaultKv()), []);
  const [mine, setMine] = useState<SavedApp | null>(savedApp ?? null);
  const [appNote, setAppNote] = useState<string | null>(null);
  const destinationPicker = <div className="wf-field"><label>Run location<select value={destination} disabled={running} onChange={e=>{setPreflight(null);setOpened(null);setResult(null);setDestination(e.target.value as "local"|"cloud");}}><option value="local">Your GPU</option><option value="cloud">Comfy Cloud</option></select></label><span>Your GPU requires ComfyUI reachable from the Haggs server. Cloud GPU time may be charged.</span><button className="plain" onClick={()=>openKeys()}>Connection settings</button></div>;
  // Back from building a character, place or accessory: it goes into the first empty picture slot.
  const [returned, setReturned] = useState<BankItem | null>(null);
  useReturnedPick(["character", "place", "accessory"], setReturned);
  useEffect(() => {
    if (!returned || !opened?.ok) return;
    const slot = opened.app.fields.find((f) => f.kind === "media" && f.media === "image" && !files[keyOf(f)]);
    if (slot && returned.image) setFiles((prior) => ({ ...prior, [keyOf(slot)]: returned.image! }));
    setReturned(null);
  }, [returned, opened, files]);

  /** Save this workflow as one of your apps; the latest result becomes its cover. */
  async function saveApp() {
    if (!opened?.ok) return;
    const title = window.prompt("Name your app:", mine?.name ?? (opened.title === "your workflow" ? name : opened.title));
    if (!title?.trim()) return;
    const cover: Cover | undefined = result?.ok && result.kind !== "audio" ? { url: result.url, kind: result.kind } : mine?.cover;
    const workflow = file ?? opened.workflow;
    const app = await apps.save({ ...(mine ? { id: mine.id, createdAt: mine.createdAt } : {}), name: title.trim().slice(0, 80), description: (mine?.description ?? opened.description ?? "").slice(0, 400), workflow, ...(recipe ?? mine?.recipe ? { recipe: (recipe ?? mine?.recipe)! } : {}), ...(canvas ?? mine?.canvas ? { canvas: (canvas ?? mine?.canvas)! } : {}), ...(cover ? { cover } : {}) });
    setMine(app);
    setAppNote(cover ? "Saved to your apps, with this result as its cover." : "Saved to your apps. Run it and save again to give it a cover.");
  }

  /** The app as one file anyone can open in haggs, its cover inside. */
  async function shareApp() {
    if (!mine) return;
    const cover = mine.cover ? await embed(mine.cover.url) : null;
    const text = appFile({ ...mine, ...(cover && mine.cover ? { cover: { url: cover, kind: mine.cover.kind } } : { cover: undefined }) } as SavedApp);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mine.name.replace(/[^\w.-]+/g, "-") || "app"}.haggs-app.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setAppNote(cover || !mine.cover ? "App file downloaded. Anyone can open it in haggs: Workflows → Open your own." : "App file downloaded without its cover (the cover is over 8 MB).");
  }

  useEffect(() => {
    let live = true;
    setOpened(null);
    setQuote(null);
    void openWorkflow(source).then((o) => {
      if (!live) return;
      setOpened(o);
      if (o.ok) setQuote({ label: o.price, min: 0, max: 0, perSecond: false });
    });
    return () => {
      live = false;
    };
  }, [source, checkVersion]);

  useEffect(() => {
    let live = true;
    setPreflight(null);
    setChecking(true);
    const timer = setTimeout(() => { void preflightWorkflow(source,values).then(r=>{if(live)setPreflight(r);}).catch(()=>{if(live)setPreflight({ok:false,destination,connection:"Check failed",cost:"Unknown",issues:["Connection check failed. Retry or update settings."],notes:[]});}).finally(()=>{if(live)setChecking(false);}); },300);
    return ()=>{live=false;clearTimeout(timer);};
  },[source,values,destination,checkVersion]);

  // Re-price when a setting changes; the words never change the price, but resolution and length do.
  useEffect(() => {
    if (!opened?.ok) return;
    let live = true;
    const timer = setTimeout(() => { void quoteWorkflow(source, values).then(q=>{if(live)setQuote(q);}).catch(()=>{if(live)setQuote(null);}); }, 300);
    return () => {live=false;clearTimeout(timer);};
  }, [values, opened, source]);

  // A per-second price becomes a total once the source video's length is known.
  const video = opened?.ok ? opened.app.fields.find((f) => f.kind === "media" && f.media === "video") : undefined;
  const videoUrl = video ? (files[keyOf(video)] ?? (video.kind === "media" ? video.sample : undefined)) : undefined;
  useEffect(() => {
    setSeconds(null);
    if (!videoUrl) return;
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => Number.isFinite(el.duration) && setSeconds(el.duration);
    el.src = videoUrl;
    return () => {
      el.removeAttribute("src");
    };
  }, [videoUrl]);
  const money = (n: number) => creditsText(n);
  const price = preflight?.cost ?? (!quote ? null : quote.perSecond && seconds && quote.min > 0
    ? `about ${money(quote.min * seconds)} for ${Math.round(seconds)}s`
    : quote.label);

  async function run() {
    if (!opened?.ok || !preflight?.ok || checking) return;
    setRunning(true);
    setResult(null);
    setKept(null);
    // A community app takes its creator's fee first, and gives it back if the run fails.
    let paid: string | null = null;
    const sb = savedApp?.community ? supabase() : null;
    if (savedApp?.community) {
      if (!sb) { setRunning(false); return setResult({ ok: false, reason: "Sign in to run community apps." }); }
      try {
        paid = (await chargeRun(dbOf(sb), savedApp!.community!.id)).run;
      } catch (caught) {
        setRunning(false);
        return setResult({ ok: false, reason: caught instanceof Error ? caught.message : "The run couldn't be charged." });
      }
    }
    const r = await track({ label: `Running ${opened.title}`, href: window.location.pathname + window.location.search, failure: (r) => (r.ok ? null : r.reason) }, () => runWorkflow(source, values, files));
    if (!r.ok && paid && sb) await refundRun(dbOf(sb), paid).catch(() => undefined);
    setRunning(false);
    setResult(r);
    if (!r.ok && r.needsKey) openKeys();
    if (r.ok && r.kind !== "audio") {
      const text = opened.app.fields.find((f) => f.kind === "text");
      const words = text ? String(values[keyOf(text)] ?? (text.kind === "text" ? text.value : "")) : opened.title;
      setKept((await runs.record({ modelId: `comfy:${name}`, modelName: opened.title, prompt: words.slice(0, 2000), settings: {}, url: r.url, kind: r.kind, usd: null })) as PictureRun);
    }
  }

  if (!opened) return <div className="app"><Nav current="Workflows" /><div className="canvas"><div className="wf">{destinationPicker}<p className="wf-note" role="status">Opening the workflow…</p></div></div></div>;
  if (!opened.ok) {
    return (
      <div className="app">
        <Nav current="Workflows" />
        <div className="canvas"><div className="wf">
          {destinationPicker}
          <p role="alert">{opened.reason}</p>
          <button onClick={()=>setCheckVersion(v=>v+1)}>Check again</button>
          {opened.needsKey ? (
            <div className="key-callout">
              <b>{contestVariant(name) || haggsPreview(name) ? "Connect local ComfyUI first." : "Choose how to run this first."}</b>
              <span>{contestVariant(name) || haggsPreview(name) ? "This Haggs workflow needs the matching custom nodes installed on your local ComfyUI. A cloud key or plan credits alone will not run it." : "Looking around is free. To open and run a workflow, buy credits, add your Comfy key or connect your own GPU."}</span>
              <button className="ph-go" onClick={() => openKeys()}>{contestVariant(name) || haggsPreview(name) ? "Connect local ComfyUI" : "Choose how to run"}</button>
            </div>
          ) : null}
          {onBack ? <button className="pill" onClick={onBack}>Back to choices</button> : <Link className="pill" href="/workflows">Back to workflows</Link>}
        </div></div>
      </div>
    );
  }

  const blocked = opened.problems[0];
  return (
    <div className="app">
      <Nav current="Workflows" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}
      <div className="canvas">
        <div className="wf wf-one">
          <header className="wf-head">
            <div>
              {onBack ? <button className="wf-back plain" onClick={onBack}>← Back to choices</button> : <Link className="wf-back" href="/workflows">Workflows</Link>}
              <h1>{opened.title === "your workflow" ? name : opened.title}</h1>
              {opened.description && <p>{opened.description}</p>}
              {ltxWorkflow(opened.name) && <p>Requires current ComfyUI, ComfyUI-LTXVideo and the named model weights. Live generation remains unverified. <a href="/workflows/ltx/README.txt">Setup and licenses</a></p>}
            </div>
            <div className="wf-appbar">
              <button className="pill" onClick={() => void saveApp()}>{mine ? "Save app" : "Save as my app"}</button>
              {mine && <button className="pill" onClick={() => void shareApp()}>Share app file</button>}
            </div>
            <div className="wf-tabs" role="tablist" aria-label="View">
              <button role="tab" aria-selected={tab === "app"} className={tab === "app" ? "on" : ""} onClick={() => setTab("app")}>App</button>
              <button role="tab" aria-selected={tab === "nodes"} className={tab === "nodes" ? "on" : ""} onClick={() => setTab("nodes")}>Nodes · {opened.graph.nodes.length}</button>
            </div>
          </header>

          {appNote && <p className="wf-note" role="status">{appNote}</p>}
          {tab === "nodes" ? (
            <Nodes
              graph={opened.graph}
              media={Object.fromEntries(opened.app.fields.flatMap((f) => (f.kind === "media" && (files[keyOf(f)] ?? f.sample) ? [[f.node, (files[keyOf(f)] ?? f.sample)!]] : [])))}
              output={{ node: opened.app.output, url: result?.ok ? result.url : (ltxWorkflow(opened.name) || contestVariant(opened.name) || haggsPreview(opened.name)) ? null : opened.thumb }}
            />
          ) : (
            <div className="wf-body">
              <div className="wf-form">
                {destinationPicker}
                <section aria-live="polite"><h2>Before you generate</h2>
                {checking ? <p>Checking connection, nodes, models, GPU and charges…</p> : preflight && <><p>{preflight.destination} · {preflight.connection}</p><p>{preflight.cost}</p>{preflight.issues.map((issue,i)=><p role="alert" key={i}>{issue}</p>)}{preflight.notes.map((note,i)=><p key={i}>{note}</p>)}</>}
                <button className="pill" disabled={checking || running} onClick={()=>setCheckVersion(v=>v+1)}>Check again</button></section>
                {opened.app.fields.filter((f) => f.kind === "media").length > 0 && (
                  <div className="wf-drops">
                    {opened.app.fields.map((f) => f.kind === "media" && (
                      <MediaDrop key={keyOf(f)} field={f} value={files[keyOf(f)]} onBusy={(b) => setAdding((n) => Math.max(0, n + (b ? 1 : -1)))} onChange={(url) => setFiles((prior) => { const next = { ...prior }; if (url) next[keyOf(f)] = url; else delete next[keyOf(f)]; return next; })} />
                    ))}
                  </div>
                )}
                {opened.app.fields.map((f) => {
                  const k = keyOf(f);
                  if (f.kind === "text") return (
                    <label key={k} className="wf-field">
                      <span>{f.label}</span>
                      <textarea rows={4} value={String(values[k] ?? f.value)} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
                    </label>
                  );
                  if (f.kind === "choice") return (
                    <label key={k} className="wf-field wf-field-inline">
                      <span>{f.label}</span>
                      <select value={String(values[k] ?? f.value)} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  );
                  if (f.kind === "number") return (
                    <label key={k} className="wf-field wf-field-inline">
                      <span>{f.label}</span>
                      <input type="number" value={Number(values[k] ?? f.value)} min={f.min} max={f.max} step={f.step ?? 1} onChange={(e) => setValues((v) => ({ ...v, [k]: Number(e.target.value) }))} />
                    </label>
                  );
                  return null;
                })}
                {blocked && <p className="library-error" role="alert">This one can&rsquo;t run here yet: {blocked}</p>}
                <button className="fire wf-run" disabled={running || checking || !preflight?.ok || adding > 0 || Boolean(blocked)} onClick={() => void run()}>
                  {running ? `Running on ${preflight?.destination ?? "Comfy"}…` : "Run"} <span className="cost">{price ?? "···"}</span>
                </button>
                <p className="wf-small">Your selected location is checked again before submission. No automatic fallback to another provider.</p>
              </div>

              <div className="wf-result" aria-live="polite">
                {running ? (
                  <div className="wf-result-wait">Running. Video can take a few minutes; you can leave this page open and keep working elsewhere.</div>
                ) : result?.ok ? (
                  <>
                    {result.kind === "video" ? <video src={result.url} controls autoPlay loop playsInline /> : result.kind === "image" ? <img src={result.url} alt="The result" /> : <audio src={result.url} controls autoPlay />}
                    <div className="sheet-row">
                      {kept && <button className="pill on" onClick={() => setSaving(kept)}>Save to project</button>}
                      <button className="pill" onClick={() => void saveApp()}>{mine ? "Save app with this cover" : "Save as my app"}</button>
                      <a className="pill" href={result.url} download>Download</a>
                      <button className="pill" onClick={() => void run()}>Run again</button>
                    </div>
                  </>
                ) : result && !result.ok ? (
                  <p className="library-error" role="alert">{result.reason}</p>
                ) : opened.thumb ? (
                  <figure className="wf-example"><img src={opened.thumb} alt="" /><figcaption>{(ltxWorkflow(opened.name) || contestVariant(opened.name) || haggsPreview(opened.name)) ? "Illustrative example made with image generation, not a verified workflow output. Yours appears here after a successful run." : "The example result. Yours appears here."}</figcaption></figure>
                ) : (
                  <div className="wf-result-wait">Your result appears here.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
