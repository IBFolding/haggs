"use client";

import { useState } from "react";

import type { Finding } from "../../story/doctor";
import { Nav } from "../nav";
import { EXAMPLE_FILM } from "../../samples/example-film";
import { diagnose, summarize } from "../../story/doctor";
import { ModeTabs } from "../mode-tabs";
import { SiteFooter } from "../site-footer";
import { uploadFile } from "../upload-client";

type Report = { metrics: { seconds: number; width: number; height: number; cuts: number }; findings: Finding[]; summary: { score: number; verdict: string; good: number; warn: number; fail: number } };

const MARK: Record<Finding["level"], string> = { good: "Good", warn: "Fix", fail: "Fix first" };

/**
 * The sizzle doctor: add a finished film and it reads the cut itself (length, how fast it opens,
 * hard cuts or dissolves, whether it builds, the sound) and says what to change. Free; nothing is generated.
 */
export function Doctor() {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [name, setName] = useState("");

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
          <header className="swap-head">
            <h1>Sizzle doctor</h1>
            <p>Add a finished film. haggs reads the cut itself: its length, how fast it opens, hard cuts against dissolves, whether it builds, and the sound. It tells you what to change before you post. Free, and nothing is generated.</p>
          </header>
          <div className="cm-row" aria-label="Sample">
            <span className="muted">No film handy?</span>
            <button className="pill" onClick={() => { const findings = diagnose(EXAMPLE_FILM.metrics); const m = EXAMPLE_FILM.metrics; setProblem(null); setName(EXAMPLE_FILM.name); setReport({ metrics: { seconds: m.seconds, width: m.width, height: m.height, cuts: m.hardCuts.length + m.dissolves.length }, findings, summary: summarize(findings) }); }}>See an example report</button>
          </div>

          <label className="wf-field"><span>Film (mp4, mov or webm, up to 300 MB)</span>
            <input type="file" accept="video/*" disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); }} />
          </label>
          {busy && <p role="status">{busy}</p>}
          {problem && <p className="library-error" role="alert">{problem}</p>}

          {report && (
            <section className="doctor-report" aria-label="Report">
              <div className="doctor-score">
                <b>{report.summary.score}</b>
                <span>{report.summary.verdict}</span>
                <small>{name} · {Math.round(report.metrics.seconds)} seconds · {report.metrics.width}×{report.metrics.height} · {report.metrics.cuts} cuts</small>
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
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
