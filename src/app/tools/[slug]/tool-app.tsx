"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { COLOR_METHODS, CUT_EVERY, EXPORT_PRESETS, REMOVE_MODELS, type ColorMethod, type DetectMode, type ExportPreset, type Shot, type VideoTool } from "../../../tools/video-tools";
import { uploadFile } from "../../upload-client";
import styles from "../tools.module.css";

type Result = { ok: true; url?: string; extra?: string; before?: number; after?: number; shots?: Shot[]; stills?: string[]; bpm?: number; beats?: number[]; cuts?: number[] } | { ok: false; reason: string };
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

export function ToolApp({ tool }: { tool: VideoTool }) {
  const [here, setHere] = useState<"checking" | "local" | "hosted">("checking");
  const [installed, setInstalled] = useState(false);
  const [source, setSource] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [preset, setPreset] = useState<ExportPreset>("web");
  const [mode, setMode] = useState<DetectMode>("content");
  const [sensitivity, setSensitivity] = useState(27);
  const [threshold, setThreshold] = useState(-35);
  const [margin, setMargin] = useState(0.1);
  const [every, setEvery] = useState(4);
  const [method, setMethod] = useState<ColorMethod>("mkl");
  const [model, setModel] = useState<string>("u2net");
  const [reference, setReference] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    void fetch("/api/tools/run", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { installed?: Record<string, boolean> } | null) => {
        setHere(b ? "local" : "hosted");
        setInstalled(!!b?.installed?.[tool.id]);
      })
      .catch(() => setHere("hosted"));
  }, [tool.id]);

  async function add(file: File | undefined) {
    if (!file) return;
    setProblem(""); setResult(null);
    const up = await uploadFile(file);
    if (!up.ok) return setProblem(up.reason);
    if (up.kind !== "video" && !(tool.input === "video-or-audio" && up.kind === "audio")) return setProblem(tool.input === "video-or-audio" ? "Add a video or a song." : "Add a video clip.");
    setSource({ url: up.url, name: up.name });
  }

  async function addReference(file: File | undefined) {
    if (!file) return;
    setProblem("");
    const up = await uploadFile(file);
    if (!up.ok) return setProblem(up.reason);
    if (up.kind !== "image") return setProblem("Add a picture as the reference.");
    setReference({ url: up.url, name: up.name });
  }

  async function go() {
    if (!source) return;
    setBusy(true); setProblem(""); setResult(null);
    const res = await fetch("/api/tools/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: tool.id, url: source.url, preset, mode, sensitivity, threshold, margin, every, method, model, reference: reference?.url }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Result | null;
    setBusy(false);
    if (body?.ok) setResult(body);
    else setProblem(body && !body.ok ? body.reason : "That didn't run.");
  }

  const cutList = () => {
    if (result?.ok && result.cuts) void navigator.clipboard?.writeText(["cut,seconds", ...result.cuts.map((c, i) => `${i + 1},${c}`)].join("\n"));
  };
  const csv = () => {
    if (result?.ok && result.shots) void navigator.clipboard?.writeText(["shot,start,end,length", ...result.shots.map((s) => `${s.number},${s.start},${s.end},${s.length}`)].join("\n"));
  };

  return (
    <main className={styles.page}>
      <p><Link href="/tools">← Video tools</Link></p>
      <header className={styles.head}>
        <span className={styles.kicker}>FREE · NO CREDITS · RUNS ON YOUR MACHINE</span>
        <h1>{tool.name}</h1>
        <p>{tool.does}</p>
      </header>

      <section className={styles.credit} aria-label="Credit and licence">
        <div><small>Made by</small><b>{tool.creator}</b></div>
        <div><small>GitHub</small><a href={tool.github} target="_blank" rel="noreferrer">{tool.github.replace("https://github.com/", "")} ↗</a></div>
        <div><small>Licence</small><a href={tool.licenceUrl} target="_blank" rel="noreferrer">{tool.licence} ↗</a></div>
        <div><small>Tested</small><span>{tool.tested}</span></div>
      </section>

      {here === "hosted" && <p className={styles.note} role="status">This tool runs on your own computer, so it can&apos;t run on the website. Run HAGGS locally with <code>HAGGS_LOCAL_MEDIA</code> set to a folder, then open this page there.</p>}
      {here === "local" && !installed && <p className={styles.note} role="status">{tool.command} isn&apos;t installed here yet. Needs: {tool.needs}</p>}

      <section className={styles.run}>
        <label className={styles.file}>
          <span>{source ? source.name : tool.input === "video-or-audio" ? "Choose a video or a song" : "Choose a video"}</span>
          <input type="file" accept={tool.input === "video-or-audio" ? "video/*,audio/*" : "video/*"} disabled={here !== "local"} onChange={(e) => void add(e.target.files?.[0])} />
        </label>
        {tool.id === "ffmpeg-export" && (
          <label>Export<select value={preset} onChange={(e) => setPreset(e.target.value as ExportPreset)}>{Object.entries(EXPORT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        )}
        {tool.id === "scene-detect" && (<>
          <label>Detector<select value={mode} onChange={(e) => { const m = e.target.value as DetectMode; setMode(m); setSensitivity(m === "content" ? 27 : m === "adaptive" ? 3 : 12); }}><option value="content">Content (hard cuts)</option><option value="adaptive">Adaptive (fast camera moves)</option><option value="threshold">Threshold (fades to black)</option></select></label>
          <label>Threshold {sensitivity}<input type="range" min={mode === "adaptive" ? 1 : mode === "threshold" ? 0 : 5} max={mode === "adaptive" ? 10 : mode === "threshold" ? 255 : 60} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} /></label>
        </>)}
        {tool.id === "auto-editor" && (<>
          <label>Quieter than {threshold} dB is cut<input type="range" min={-60} max={-10} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label>
          <label>Keep {margin.toFixed(2)} s around speech<input type="range" min={0} max={1} step={0.05} value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
        </>)}
        {tool.id === "beat-cuts" && (
          <label>Cut every<select value={every} onChange={(e) => setEvery(Number(e.target.value))}>{CUT_EVERY.map((n) => <option key={n} value={n}>{n === 1 ? "beat" : `${n} beats`}</option>)}</select></label>
        )}
        {tool.id === "color-match" && (<>
          <label className={styles.file}><span>{reference ? reference.name : "Choose the reference picture"}</span><input type="file" accept="image/*" disabled={here !== "local"} onChange={(e) => void addReference(e.target.files?.[0])} /></label>
          <label>Method<select value={method} onChange={(e) => setMethod(e.target.value as ColorMethod)}>{Object.entries(COLOR_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </>)}
        {tool.id === "remove-bg" && (
          <label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{REMOVE_MODELS.map((m) => <option key={m} value={m}>{m}{m === "u2netp" ? " (smaller, faster)" : ""}</option>)}</select></label>
        )}
        <button className={styles.go} onClick={() => void go()} disabled={!source || (tool.id === "color-match" && !reference) || busy || here !== "local" || !installed}>{busy ? "Working…" : "Run"}</button>
        {problem && <p role="alert" className={styles.problem}>{problem}</p>}
      </section>

      {result?.ok && (
        <section className={styles.result} aria-label="Result">
          {result.before !== undefined && result.after !== undefined && <p><b>Before</b> {fmt(result.before)} → <b>After</b> {fmt(result.after)}{result.after < result.before ? ` (${fmt(result.before - result.after)} removed)` : ""}</p>}
          {result.bpm !== undefined && result.beats && (<>
            <p><b>{result.bpm} BPM</b> · {result.beats.length} beats · {result.cuts?.length ?? 0} cut points every {every === 1 ? "beat" : `${every} beats`} · <button className="plain" onClick={cutList}>Copy cut list</button></p>
            <p className={styles.cuts}>{result.cuts?.map((c) => fmt(c)).join(" · ")}</p>
          </>)}
          {result.url && (tool.id === "beat-cuts" && !result.url.endsWith(".mp4") ? <audio src={result.url} controls /> : <video src={result.url} controls preload="metadata" className={tool.id === "remove-bg" ? styles.alpha : undefined} />)}
          {result.url && <p><a href={result.url} download>Download{tool.id === "remove-bg" ? " WebM" : ""}</a>{result.extra && tool.id === "remove-bg" && <> · <a href={result.extra} download>Download ProRes 4444 (.mov)</a></>}</p>}
          {tool.id === "remove-bg" && result.stills?.[0] && <p><a href={result.stills[0]} download>Download still (PNG)</a></p>}
          {result.shots && tool.id === "scene-detect" && (<>
            <p><b>{result.shots.length} shots</b> in {fmt(result.before ?? 0)} · <button className="plain" onClick={csv}>Copy as CSV</button></p>
            <div className={styles.shots}>
              {result.shots.map((s, i) => <figure key={s.number}>{result.stills?.[i] && <img src={result.stills[i]} alt={`Shot ${s.number}`} loading="lazy" />}<figcaption>{s.number} · {fmt(s.start)} – {fmt(s.end)}</figcaption></figure>)}
            </div>
          </>)}
        </section>
      )}

      <details className={styles.setup}>
        <summary>Install</summary>
        <p>{tool.needs}</p>
        <pre>{tool.install.join("\n")}</pre>
        <p>HAGGS does not bundle or redistribute {tool.name === "FFmpeg export" ? "FFmpeg" : tool.creator.split(" (")[0] + "'s code"}; it runs the copy you installed. Then restart HAGGS with <code>HAGGS_LOCAL_MEDIA</code> pointing at a folder.</p>
      </details>
    </main>
  );
}
