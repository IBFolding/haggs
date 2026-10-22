"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Field } from "../../../comfy/apps";
import { defaultKv } from "../../../story/kv";
import { createRunStore, type Run } from "../../../story/runs";
import { appFile, createAppStore, type Cover, type SavedApp } from "../../../story/apps";
import type { Recipe } from "../../../comfy/recipe";
import { Nav, openKeys } from "../../nav";
import { SaveToProject } from "../../save-to-project";
import { openWorkflow, quoteWorkflow, runWorkflow, type Graph, type OpenedApp, type Quote, type Source, type WorkflowResult } from "../../workflow-actions";

/**
 * One Comfy workflow as an app: drop your files where its examples are,
 * change its words and a few settings, press Run. The Nodes tab shows the
 * graph it runs, as its author laid it out.
 */

const keyOf = (f: Field) => `${f.node}/${f.input}`;

async function addFile(file: File): Promise<string> {
  // In development the file goes to the local media folder; otherwise it travels with the run.
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
  if (body?.ok && body.url) return body.url;
  if (file.size > 20 * 1024 * 1024) throw new Error("Files over 20 MB need the local media folder (npm run dev with HAGGS_LOCAL_MEDIA).");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

function MediaDrop({ field, value, onChange }: { field: Extract<Field, { kind: "media" }>; value: string | undefined; onChange: (url: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = value ?? field.sample;
  const accept = field.media === "image" ? "image/*" : field.media === "video" ? "video/*" : "audio/*";

  async function take(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith(field.media)) return setError(`This needs ${field.media === "image" ? "a picture" : field.media === "video" ? "a video" : "a sound"}.`);
    setBusy(true);
    setError(null);
    try {
      onChange(await addFile(file));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file couldn't be added.");
    } finally {
      setBusy(false);
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
      </span>
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

export function WorkflowApp({ name, file, recipe, saved: savedApp, onBack }: { name: string; file?: string; recipe?: Recipe; saved?: SavedApp; onBack?: () => void }) {
  const source: Source = useMemo(() => (file ? { file } : { template: name }), [name, file]);
  const [opened, setOpened] = useState<OpenedApp | null>(null);
  const [tab, setTab] = useState<"app" | "nodes">("app");
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [saving, setSaving] = useState<Run | null>(null);
  const [kept, setKept] = useState<Run | null>(null);
  const runs = useMemo(() => createRunStore(defaultKv()), []);
  const apps = useMemo(() => createAppStore(defaultKv()), []);
  const [mine, setMine] = useState<SavedApp | null>(savedApp ?? null);
  const [appNote, setAppNote] = useState<string | null>(null);

  /** Save this workflow as one of your apps; the latest result becomes its cover. */
  async function saveApp() {
    if (!opened?.ok) return;
    const title = window.prompt("Name your app:", mine?.name ?? (opened.title === "your workflow" ? name : opened.title));
    if (!title?.trim()) return;
    const cover: Cover | undefined = result?.ok && result.kind !== "audio" ? { url: result.url, kind: result.kind } : mine?.cover;
    const workflow = file ?? opened.workflow;
    const app = await apps.save({ ...(mine ? { id: mine.id, createdAt: mine.createdAt } : {}), name: title.trim().slice(0, 80), description: (mine?.description ?? opened.description ?? "").slice(0, 400), workflow, ...(recipe ?? mine?.recipe ? { recipe: (recipe ?? mine?.recipe)! } : {}), ...(cover ? { cover } : {}) });
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
    void openWorkflow(source).then((o) => {
      if (!live) return;
      setOpened(o);
      if (o.ok) setQuote({ label: o.price, min: 0, max: 0, perSecond: false });
      if (!o.ok && o.needsKey) openKeys();
    });
    return () => {
      live = false;
    };
  }, [source]);

  // Re-price when a setting changes; the words never change the price, but resolution and length do.
  useEffect(() => {
    if (!opened?.ok) return;
    const timer = setTimeout(() => void quoteWorkflow(source, values).then(setQuote), 300);
    return () => clearTimeout(timer);
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
  const money = (n: number) => (n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);
  const price = !quote ? null : quote.perSecond && seconds && quote.min > 0
    ? `about ${money(quote.min * seconds)} for ${Math.round(seconds)}s`
    : quote.label;

  async function run() {
    if (!opened?.ok) return;
    setRunning(true);
    setResult(null);
    setKept(null);
    const r = await runWorkflow(source, values, files);
    setRunning(false);
    setResult(r);
    if (!r.ok && r.needsKey) openKeys();
    if (r.ok && r.kind !== "audio") {
      const text = opened.app.fields.find((f) => f.kind === "text");
      const words = text ? String(values[keyOf(text)] ?? (text.kind === "text" ? text.value : "")) : opened.title;
      setKept(await runs.record({ modelId: `comfy:${name}`, modelName: opened.title, prompt: words.slice(0, 2000), settings: {}, url: r.url, kind: r.kind, usd: null }));
    }
  }

  if (!opened) return <div className="app"><Nav current="Workflows" /><div className="canvas"><div className="wf"><p className="wf-note" role="status">Opening the workflow…</p></div></div></div>;
  if (!opened.ok) {
    return (
      <div className="app">
        <Nav current="Workflows" />
        <div className="canvas"><div className="wf">
          <p className="library-error" role="alert">{opened.reason}</p>
          <Link className="pill" href="/workflows">Back to workflows</Link>
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
              {onBack ? <button className="wf-back plain" onClick={onBack}>← Back to the steps</button> : <Link className="wf-back" href="/workflows">Workflows</Link>}
              <h1>{opened.title}</h1>
              {opened.description && <p>{opened.description}</p>}
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
              output={{ node: opened.app.output, url: result?.ok ? result.url : opened.thumb }}
            />
          ) : (
            <div className="wf-body">
              <div className="wf-form">
                {opened.app.fields.filter((f) => f.kind === "media").length > 0 && (
                  <div className="wf-drops">
                    {opened.app.fields.map((f) => f.kind === "media" && (
                      <MediaDrop key={keyOf(f)} field={f} value={files[keyOf(f)]} onChange={(url) => setFiles((prior) => { const next = { ...prior }; if (url) next[keyOf(f)] = url; else delete next[keyOf(f)]; return next; })} />
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
                <button className="fire wf-run" disabled={running || Boolean(blocked)} onClick={() => void run()}>
                  {running ? "Running on Comfy Cloud…" : "Run"} <span className="cost">{price ?? "···"}</span>
                </button>
                <p className="wf-small">Priced from each node&rsquo;s own rate on Comfy, billed to your Comfy credits. An estimate, not an invoice.</p>
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
                  <figure className="wf-example"><img src={opened.thumb} alt="" /><figcaption>The example result. Yours appears here.</figcaption></figure>
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
