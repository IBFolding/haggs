"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LESSONS, createProgress } from "../../academy/lessons";
import { defaultKv } from "../../story/kv";
import { MADE } from "../academy-path";
import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";

/**
 * Seven short lessons, each a few steps, a button into the real page, and a
 * small homework. Your progress stays in this browser. Finish all seven and
 * there is a certificate to print or save.
 */
export function Academy() {
  const progress = useMemo(() => createProgress(defaultKv()), []);
  const [done, setDone] = useState<string[]>([]);
  const [name, setName] = useState("");

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

  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <div className="academy">
          <header className="swap-head">
            <h1>Learn AI video by making it</h1>
            <p>Seven short lessons, about 90 minutes in all. You make a video in the first one. Everything here runs in haggs on Comfy, so what you learn is what you use.</p>
          </header>
          <div className="ac-hero">
            <div className="ac-ring big" style={{ "--p": (done.length / LESSONS.length) * 100 } as React.CSSProperties} role="progressbar" aria-valuemin={0} aria-valuemax={LESSONS.length} aria-valuenow={done.length} aria-label="Lessons finished"><b>{done.length}</b><small>of {LESSONS.length}</small></div>
            <div>
              {next ? (
                <>
                  <p className="ac-hero-line">{done.length ? `Next up: ${next.title}` : "Start with your first video. It takes a minute."}</p>
                  <Link className="fire" href={`/academy/learn/${next.id}`}>{done.length ? "Continue" : "Start lesson one"}</Link>
                </>
              ) : (
                <p className="ac-hero-line">All seven done. Print your certificate below.</p>
              )}
            </div>
          </div>

          <ol className="ac-cards">
            {LESSONS.map((l, i) => {
              const isDone = done.includes(l.id);
              return (
                <li key={l.id} className={isDone ? "done" : l.id === next?.id ? "next" : ""}>
                  <Link href={`/academy/learn/${l.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={MADE[l.id] ?? "/templates/key-art.webp"} alt="" loading="lazy" />
                    <span className="ac-card-n">{isDone ? "✓" : i + 1}</span>
                    <div>
                      <small>{l.minutes} min</small>
                      <b>{l.title}</b>
                      <span>{l.goal}</span>
                      <em>{isDone ? "Do it again" : "Try it now"}</em>
                    </div>
                  </Link>
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
        <SiteFooter />
      </div>
    </div>
  );
}
