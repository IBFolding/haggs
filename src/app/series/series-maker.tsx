"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { FORMATS, buildSeries, type FormatId, type Series } from "../../series/series";
import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { Nav, openKeys } from "../nav";
import { draftSeries } from "../series-actions";

/**
 * Series: a topic becomes several short vertical videos. Claude writes the
 * episodes (hook, shots, on-screen words); you read them, change anything,
 * and make the project. Pictures and clips come after, priced on the board.
 */
export function SeriesMaker() {
  const router = useRouter();
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const [format, setFormat] = useState<FormatId>("what-if");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    const r = await draftSeries(format, topic, count);
    setBusy(false);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    setSeries(r.series);
  }

  async function make() {
    if (!series) return;
    const project = buildSeries(series, format);
    await store.save(project);
    router.push(`/board/${project.id}?b=${encodeURIComponent(project.boards![0]!.id)}`);
  }

  const change = (e: number, s: number, patch: Partial<Series["episodes"][number]["shots"][number]>) =>
    setSeries((cur) => cur && { ...cur, episodes: cur.episodes.map((ep, i) => (i === e ? { ...ep, shots: ep.shots.map((sh, k) => (k === s ? { ...sh, ...patch } : sh)) } : ep)) });
  const shots = series?.episodes.reduce((n, e) => n + e.shots.length, 0) ?? 0;

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <nav className="modes" aria-label="Video">
            <Link href="/video">Make a clip</Link>
            <Link href="/series" aria-current="page">Series</Link>
          </nav>
          <header className="swap-head">
            <h1>Make a series</h1>
            <p>Give it a topic. Claude writes a run of short vertical videos, each opening on a hook with the words on screen. You read them, change what you like, then make the pictures and clips.</p>
          </header>

          {!series ? (
            <div className="series-form">
              <div className="series-formats" role="radiogroup" aria-label="Format">
                {FORMATS.map((f) => (
                  <button key={f.id} role="radio" aria-checked={format === f.id} className={format === f.id ? "on" : ""} onClick={() => setFormat(f.id)}>
                    <b>{f.label}</b>
                    <span>{f.blurb}</span>
                  </button>
                ))}
              </div>
              <label className="wf-field">
                <span>What is it about?</span>
                <textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1000} placeholder="Strange things that would happen if your body kept doing one thing forever" />
              </label>
              <label className="wf-field wf-field-inline">
                <span>How many videos</span>
                <input type="number" min={1} max={8} value={count} onChange={(e) => setCount(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
              </label>
              {error && <p className="library-error" role="alert">{error}</p>}
              <button className="fire wf-run" disabled={busy || topic.trim().length < 4} onClick={() => void write()}>
                {busy ? "Claude is writing…" : "Write the series"}
              </button>
              <p className="wf-small">Claude writes it on your own Anthropic key. Nothing is made yet, so nothing is spent on pictures or clips.</p>
            </div>
          ) : (
            <div className="series-draft">
              <label className="wf-field">
                <span>Series name</span>
                <input value={series.title} maxLength={80} onChange={(e) => setSeries({ ...series, title: e.target.value })} />
              </label>
              {series.episodes.map((ep, e) => (
                <section key={e} className="series-ep">
                  <h2><span>{e + 1}</span>{ep.hook || `Video ${e + 1}`}</h2>
                  {ep.shots.map((sh, s) => (
                    <div key={s} className="series-shot">
                      <textarea rows={2} value={sh.picture} aria-label={`Video ${e + 1}, shot ${s + 1}: the picture`} onChange={(ev) => change(e, s, { picture: ev.target.value })} />
                      <input value={sh.caption} placeholder="On-screen words" aria-label={`Video ${e + 1}, shot ${s + 1}: on-screen words`} maxLength={120} onChange={(ev) => change(e, s, { caption: ev.target.value })} />
                      <small>{sh.seconds}s</small>
                    </div>
                  ))}
                </section>
              ))}
              <div className="sheet-row">
                <button className="fire" onClick={() => void make()}>Make the project · {series.episodes.length} videos, {shots} shots</button>
                <button className="plain" onClick={() => setSeries(null)}>Start again</button>
              </div>
              <p className="wf-small">Next, on the board: Make pictures (about 7¢ each), then Animate stills (about 52¢ each).</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
