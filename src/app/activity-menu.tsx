"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { clearFinished, dismiss, jobs, markSeen, subscribe, type Job } from "../activity/activity";

const NONE: readonly Job[] = [];

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** The header's list of what is running and what just finished, so you can leave the page that started it. */
export function ActivityMenu() {
  const list = useSyncExternalStore(subscribe, jobs, () => NONE);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const box = useRef<HTMLSpanElement>(null);
  const running = list.filter((j) => j.state === "running").length;
  const unseen = list.filter((j) => j.state !== "running" && !j.seen).length;

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Closing the tab would lose the work, so ask first.
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", warn);
    };
  }, [running]);

  useEffect(() => {
    if (!open) return;
    markSeen();
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, list.length]);

  const failed = list.some((j) => j.state === "failed" && !j.seen);
  const label = running ? `${running} running` : unseen ? `${unseen} done` : "Activity";
  return (
    <span className="act" ref={box}>
      <button className={`act-btn${running ? " busy" : ""}${!running && unseen ? (failed ? " bad" : " fresh") : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" title="What's running">
        <span className="act-dot" aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </button>
      {open && (
        <div className="act-pop" role="region" aria-label="Activity">
          {!list.length && <p className="act-empty">Nothing running. Renders and generations show up here while you work on other pages.</p>}
          <ul>
            {list.map((j) => (
              <li key={j.id} className={`act-row ${j.state}`}>
                <span className="act-what">
                  <b>{j.label}</b>
                  <small role={j.state === "failed" ? "alert" : undefined}>
                    {j.state === "running" ? `Working · ${clock(now - j.startedAt)}` : j.state === "done" ? `Done · took ${clock((j.endedAt ?? now) - j.startedAt)}` : (j.note ?? "It didn't finish.")}
                  </small>
                </span>
                <span className="act-go">
                  {j.url && <a href={j.url} target="_blank" rel="noreferrer">Watch</a>}
                  {j.url && <a href={j.url} download>Save</a>}
                  {j.href && <Link href={j.href} onClick={() => setOpen(false)}>Open</Link>}
                  {j.state !== "running" && <button onClick={() => dismiss(j.id)} aria-label={`Dismiss ${j.label}`}>×</button>}
                </span>
              </li>
            ))}
          </ul>
          {list.some((j) => j.state !== "running") && <button className="act-clear" onClick={clearFinished}>Clear finished</button>}
        </div>
      )}
    </span>
  );
}
