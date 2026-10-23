"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LESSONS, createProgress } from "../../academy/lessons";
import { defaultKv } from "../../story/kv";
import { Nav } from "../nav";

/**
 * Seven short lessons, each a few steps, a button into the real page, and a
 * small homework. Your progress stays in this browser. Finish all seven and
 * there is a certificate to print or save.
 */
export function Academy() {
  const progress = useMemo(() => createProgress(defaultKv()), []);
  const [done, setDone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(LESSONS[0]!.id);
  const [name, setName] = useState("");

  useEffect(() => {
    void progress.done().then(setDone);
    try {
      setName(localStorage.getItem("haggs.academy.name") ?? "");
    } catch {
      /* private window */
    }
  }, [progress]);

  async function toggle(id: string) {
    await progress.mark(id, !done.includes(id));
    setDone(await progress.done());
  }

  const finished = done.length === LESSONS.length;
  const next = LESSONS.find((l) => !done.includes(l.id));

  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <div className="academy">
          <header className="swap-head">
            <h1>Learn AI video by making it</h1>
            <p>Seven short lessons, about 90 minutes in all. You make a video in the first one. Everything here runs in haggs on Comfy, so what you learn is what you use.</p>
          </header>
          <div className="academy-bar" role="progressbar" aria-valuemin={0} aria-valuemax={LESSONS.length} aria-valuenow={done.length} aria-label="Lessons finished">
            <i style={{ width: `${(done.length / LESSONS.length) * 100}%` }} />
            <span>{done.length} of {LESSONS.length} done</span>
          </div>
          {next && done.length > 0 && <p className="wf-small">Next: <button className="plain" onClick={() => setOpen(next.id)}>{next.title}</button></p>}

          <ol className="academy-list">
            {LESSONS.map((l, i) => {
              const isDone = done.includes(l.id);
              return (
                <li key={l.id} className={`academy-lesson${open === l.id ? " open" : ""}${isDone ? " done" : ""}`}>
                  <button className="academy-head" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
                    <span className="academy-n">{isDone ? "✓" : i + 1}</span>
                    <b>{l.title}</b>
                    <small>{l.minutes} min · {l.goal}</small>
                  </button>
                  {open === l.id && (
                    <div className="academy-body">
                      <ol>{l.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                      <p className="academy-tip"><b>Tip.</b> {l.tip}</p>
                      <p className="academy-home"><b>Homework.</b> {l.homework}</p>
                      <div className="sheet-row">
                        <Link className="fire" href={l.doIt.href}>{l.doIt.label}</Link>
                        <button className="pill" onClick={() => void toggle(l.id)}>{isDone ? "Mark as not done" : "I did it"}</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {finished && (
            <section className="academy-cert" aria-label="Certificate">
              <label className="wf-field"><span>Your name for the certificate</span>
                <input value={name} maxLength={60} onChange={(e) => { setName(e.target.value); try { localStorage.setItem("haggs.academy.name", e.target.value); } catch { /* private window */ } }} />
              </label>
              <div className="academy-paper">
                <small>haggs Academy</small>
                <h2>{name.trim() || "Your name"}</h2>
                <p>finished all seven lessons: from a first video to a finished film.</p>
                <small>{new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</small>
              </div>
              <button className="pill on" onClick={() => window.print()}>Print or save as PDF</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
