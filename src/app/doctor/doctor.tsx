"use client";

import { useRef, useState } from "react";

import type { Finding } from "../../story/doctor";
import { Nav } from "../nav";
import { EXAMPLE_FILM } from "../../samples/example-film";
import { diagnose, summarize } from "../../story/doctor";
import { ModeTabs } from "../mode-tabs";
import { SiteFooter } from "../site-footer";
import { uploadFile } from "../upload-client";

type Report = { metrics: { seconds: number; width: number; height: number; cuts: number }; findings: Finding[]; summary: { score: number; verdict: string; good: number; warn: number; fail: number } };

const MARK: Record<Finding["level"], string> = { good: "Good", warn: "Fix", fail: "Fix first" };
const CHECKS = ["How long it runs", "How fast it opens", "Hard cuts against dissolves", "Whether it builds", "The sound"];

/**
 * The sizzle doctor: add a finished film and it reads the cut itself (length, how fast it opens,
 * hard cuts or dissolves, whether it builds, the sound) and says what to change. Free; nothing is generated.
 */
export function Doctor() {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  function example() {
    const findings = diagnose(EXAMPLE_FILM.metrics);
    const m = EXAMPLE_FILM.metrics;
    setProblem(null);
    setName(EXAMPLE_FILM.name);
    setReport({ metrics: { seconds: m.seconds, width: m.width, height: m.height, cuts: m.hardCuts.length + m.dissolves.length }, findings, summary: summarize(findings) });
  }

  async function check(file: File) {
    setProblem(null);
    setReport(null);
    setName(file.name);
    setBusy("Adding the film…");
    const added = await uploadFile(file);
    if (!added.ok) { setBusy(null); return setProblem(added.reason); }
    if (added.kind !== "video") { setBusy(null); return setProblem("Add a film (mp4, mov or webm)."); }
    setBusy("Reading the cut…");
    const res = await fetch("/api/doctor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: added.url }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as ({ ok: true } & Report) | { ok: false; reason: string } | null;
    setBusy(null);
    if (!body || !body.ok) return setProblem(body && !body.ok ? body.reason : "The check couldn't run.");
    setReport(body);
  }

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/doctor" />
          <div className="cx">
            <aside className="cx-builder" aria-label="Check a film">
              <div className="cx-scroll">
                <span className="eyebrow">Sizzle doctor</span>
                <h1 className="cx-title">Know what to fix before you post.</h1>
                <p className="cx-lede">Add a finished film. haggs reads the cut itself and tells you what to change. Free, and nothing is generated.</p>
                <button
                  className={`rx-drop${over ? " over" : ""}`}
                  disabled={busy !== null}
                  onClick={() => file.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) void check(f); }}
                >
                  <span aria-hidden>▶</span>
                  <b>{busy ?? (report && name !== EXAMPLE_FILM.name ? "Check another film" : "Add your film")}</b>
                  <small>mp4, mov or webm, up to 300 MB. Drop it here or click.</small>
                </button>
                <input ref={file} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void check(f); }} />
                <section className="rx-step">
                  <b>What it reads</b>
                  <ul className="dr-checks">{CHECKS.map((c) => <li key={c}>{c}</li>)}</ul>
                </section>
                {problem && <p className="library-error" role="alert">{problem}</p>}
              </div>
              <div className="cx-foot">
                <button className="cx-shuffle" disabled={busy !== null} onClick={example}>Example</button>
                <button className="fire" disabled={busy !== null} onClick={() => file.current?.click()}>{busy ?? "Check my film"} <span className="cost">free</span></button>
              </div>
            </aside>

            <div className="cx-main">
              {report ? (
                <section className="doctor-report" aria-label="Report">
                  <div className="dr-head">
                    <div className="dr-score" style={{ "--score": report.summary.score } as React.CSSProperties}><b>{report.summary.score}</b></div>
                    <div>
                      <h2>{report.summary.verdict}</h2>
                      <small>{name} · {Math.round(report.metrics.seconds)} seconds · {report.metrics.width}×{report.metrics.height} · {report.metrics.cuts} cuts</small>
                      <div className="dr-tally"><span data-level="fail">{report.summary.fail} fix first</span><span data-level="warn">{report.summary.warn} to fix</span><span data-level="good">{report.summary.good} good</span></div>
                    </div>
                  </div>
                  <ul className="doctor-list">
                    {report.findings.map((f) => (
                      <li key={f.id} data-level={f.level}>
                        <h2>{f.title} <span>{MARK[f.level]}</span></h2>
                        <p>{f.detail}</p>
                        {f.fix && <p className="doctor-fix">{f.fix}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <div className="chars-sheet" aria-live="polite">
                  <div className="wf-result-wait">{busy ?? "Add a film and its report appears here: a score out of 100, then each thing to fix, worst first."}</div>
                </div>
              )}
              {!report && (
                <section className="cx-gallery" aria-label="Example">
                  <span className="eyebrow muted">No film handy?</span>
                  <div className="cx-cards">
                    <button className="cx-card" onClick={example}><span className="cx-mono" aria-hidden>▶</span><span><b>See an example report</b><small>{EXAMPLE_FILM.name}</small></span></button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
