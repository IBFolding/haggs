"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LESSONS, createProgress } from "../../academy/lessons";
import { defaultKv } from "../../story/kv";
import { Nav } from "../nav";
import { LABS, type Lab } from "./labs-ui";

/**
 * One lesson as something you do, not read. The steps sit beside a practice
 * lab that runs in the page for free; when you pass its challenge the lesson
 * is marked done and the real thing is one click away.
 */
export function LessonPlayer({ index }: { index: number }) {
  const lesson = LESSONS[index]!;
  const next = LESSONS[index + 1];
  const progress = useMemo(() => createProgress(defaultKv()), []);
  const [done, setDone] = useState<string[]>([]);
  const [lab, setLab] = useState<Lab>({ done: false, checks: [] });
  const [burst, setBurst] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => { void progress.done().then(setDone); }, [progress]);

  const onLab = useCallback((l: Lab) => setLab((prev) => (prev.done === l.done && prev.checks.length === l.checks.length && prev.checks.every((c, i) => c.ok === l.checks[i]!.ok) ? prev : l)), []);

  const passed = lab.done;
  useEffect(() => {
    if (!passed) return;
    void progress.mark(lesson.id, true).then(() => progress.done()).then(setDone);
    setBurst(true);
    const t = setTimeout(() => setBurst(false), 2600);
    return () => clearTimeout(t);
  }, [passed, progress, lesson.id]);

  const alreadyDone = done.includes(lesson.id);
  const checked = lab.checks.filter((c) => c.ok).length;
  const Practice = LABS[lesson.id];

  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <div className="ac">
          <header className="ac-head">
            <Link href="/academy" className="ac-back">← All lessons</Link>
            <ol className="ac-dots" aria-label="Lessons">
              {LESSONS.map((l, i) => (
                <li key={l.id}><Link href={`/academy/learn/${l.id}`} className={`${i === index ? "on" : ""}${done.includes(l.id) ? " done" : ""}`} aria-label={`${i + 1}. ${l.title}`} aria-current={i === index}>{done.includes(l.id) ? "✓" : i + 1}</Link></li>
              ))}
            </ol>
          </header>

          <div className="ac-title">
            <small>Lesson {index + 1} of {LESSONS.length} · about {lesson.minutes} min</small>
            <h1>{lesson.title}</h1>
            <p>{lesson.goal}</p>
          </div>

          <div className="ac-grid">
            <aside className="ac-steps" aria-label="Steps">
              <h2>Do this</h2>
              <ol>
                {lesson.steps.map((s, i) => (
                  <li key={s} className={i < step ? "done" : i === step ? "now" : ""}>
                    <button onClick={() => setStep(i === step ? i + 1 : i)} aria-label={`Step ${i + 1}: ${s}`}>
                      <i>{i < step ? "✓" : i + 1}</i>
                      <span>{s}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="ac-tip"><b>Tip</b> {lesson.tip}</p>
            </aside>

            <section className="ac-lab" aria-label="Practice">
              <div className="ac-lab-top"><b>Practice</b><span>free, nothing is spent</span></div>
              {Practice ? Practice({ onLab }) : null}
              <div className="ac-challenge" role="status">
                <div className="ac-ring" style={{ "--p": lab.checks.length ? (checked / lab.checks.length) * 100 : 0 } as React.CSSProperties}><b>{checked}</b><small>/{lab.checks.length}</small></div>
                <ul>{lab.checks.map((c) => <li key={c.label} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : ""}</i>{c.label}</li>)}</ul>
              </div>
            </section>
          </div>

          <footer className={`ac-foot${passed || alreadyDone ? " open" : ""}`}>
            {passed || alreadyDone ? (
              <>
                <div><b>{passed ? "Lesson complete." : "You’ve done this one."}</b><span>Now do it for real.</span></div>
                <Link className="fire" href={lesson.doIt.href}>{lesson.doIt.label}</Link>
                {next ? <Link className="pill on" href={`/academy/learn/${next.id}`}>Next: {next.title}</Link> : <Link className="pill on" href="/academy">Get your certificate</Link>}
              </>
            ) : (
              <><span>Finish the practice to unlock the real thing.</span><Link className="plain" href={lesson.doIt.href}>Skip to it</Link></>
            )}
          </footer>
        </div>
      </div>
      {burst && <div className="ac-burst" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ "--a": `${(i / 28) * 360}deg`, "--d": `${120 + (i % 5) * 36}px`, "--c": ["#d4f83a", "#7dd3fc", "#f5a524", "#c4a7ff"][i % 4] } as React.CSSProperties} />)}</div>}
    </div>
  );
}
