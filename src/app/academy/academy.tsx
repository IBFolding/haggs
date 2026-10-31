"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ACADEMY_HERO, LESSONS, createProgress, lessonCover } from "../../academy/lessons";
import { ACADEMY_MINUTES } from "../../brand/product-copy";
import { defaultKv } from "../../story/kv";
import { LearnShell } from "../learn-shell";

/** The path a film takes, and which steps cost anything. */
const PATH = [
  { step: "Idea", says: "One sentence of what happens.", paid: false },
  { step: "Script", says: "Beats and lines per scene.", paid: false },
  { step: "Board", says: "Every shot with its price.", paid: false },
  { step: "Pictures", says: "The first frame of each shot.", paid: true },
  { step: "Clips", says: "Animate the keepers.", paid: true },
  { step: "Cut", says: "Arrange, trim, reshoot.", paid: false },
  { step: "Sound", says: "Voice, music, effects.", paid: true },
  { step: "Render", says: "MP4 with captions.", paid: false },
];

/**
 * Seven short lessons, each a few steps, a button into the real page, and a
 * small homework. Your progress stays in this browser. Finish all seven and
 * there is a certificate to print or save.
 */
export function Academy() {
  const progress = useMemo(() => createProgress(defaultKv()), []);
  const [done, setDone] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void progress.done().then(setDone);
    try {
      setName(localStorage.getItem("haggs.academy.name") ?? "");
    } catch {
      /* private window */
    }
  }, [progress]);

  const finished = done.length === LESSONS.length;
  const next = LESSONS.find((l) => !done.includes(l.id));
  // The next lesson starts open, the way the prototype does it.
  useEffect(() => { setOpen((o) => o ?? next?.id ?? null); }, [next?.id]);

  return (
    <LearnShell current="/academy">
        <div className="academy">
          <div className="ac-hero">
            <div>
              <span className="eyebrow">Academy</span>
              <h1 className="ac-title-big">Make one film, start to finish. Learn it on the way.</h1>
              <p className="ac-lede">Seven lessons, about {ACADEMY_MINUTES} minutes in all. You make a video in the first one. Each lesson has a free practice lab, then a button into the real page to do it, and you finish with a cut, a voice and a render.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ac-hero-pic" src={ACADEMY_HERO} alt="" />
          </div>

          <ol className="ac-path" aria-label="The path of a film">
            {PATH.map((p, i) => (
              <li key={p.step}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                <b>{p.step}</b>
                <span>{p.says}</span>
                <em className={p.paid ? "" : "free"}>{p.paid ? "price on the button" : "free"}</em>
              </li>
            ))}
          </ol>

          <div className="ac-progress" role="progressbar" aria-valuemin={0} aria-valuemax={LESSONS.length} aria-valuenow={done.length} aria-label="Lessons done">
            <span style={{ width: `${(done.length / LESSONS.length) * 100}%` }} />
            <small>{done.length} of {LESSONS.length} done{next ? ` · next: ${next.title}` : ""}</small>
          </div>

          <ol className="ac-lessons">
            {LESSONS.map((l, i) => {
              const isDone = done.includes(l.id);
              const isOpen = open === l.id;
              return (
                <li key={l.id} className={`${isDone ? "done" : ""}${isOpen ? " open" : ""}`}>
                  <button className="ac-lesson-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.id)}>
                    <span className="ac-badge">{isDone ? "✓" : i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="ac-cover" src={lessonCover(l.id)} alt="" loading="lazy" />
                    <span className="ac-lesson-name"><b>{l.title}</b><small>{l.goal}</small></span>
                    <span className="ac-min">{l.minutes} min</span>
                    <span className="ac-chev" aria-hidden>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="ac-lesson-body">
                      {l.why && <p><b>Why this matters.</b> {l.why}</p>}
                      <span className="eyebrow muted">The steps</span>
                      <ol className="ac-steps-list">{l.steps.map((step, j) => <li key={step}><small>{String(j + 1).padStart(2, "0")}</small>{step}</li>)}</ol>
                      {l.techs && (
                        <>
                          <span className="eyebrow muted">Do this, not that</span>
                          <ul className="ac-techs">
                            {l.techs.map((t) => (
                              <li key={t.do}>
                                <p className="do"><i>Do</i>{t.do}</p>
                                <p className="avoid"><i>Avoid</i>{t.avoid}</p>
                                <small>{t.why}</small>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p className="ac-homework"><b>Homework.</b> {l.homework} <span>Tip: {l.tip}</span></p>
                      <div className="ac-lesson-go">
                        <Link className="ph-go" href={`/academy/learn/${l.id}`}>{isDone ? "Practise again" : "Start the practice lab"} →</Link>
                        <Link className="ph-ghost" href={l.doIt.href}>{l.doIt.label}</Link>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="ac-cert-note">{finished ? "All seven done. Your certificate is below." : "Finish all seven for a certificate."}</p>

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
    </LearnShell>
  );
}
