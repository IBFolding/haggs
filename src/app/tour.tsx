"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * The first-run tour: a short walk through the header, one stop at a time,
 * each lit up on the page with a sentence on what it is for and a way to try
 * it. Runs once, can be skipped at any point, and comes back from the ? in
 * the header.
 */

type Step = { target: string | null; title: string; body: string; cta?: { label: string; href: string }; scene: "welcome" | "photos" | "video" | "projects" | "workflows" | "academy" | "keys" | "ask" };

export const TOUR_EVENT = "haggs:tour";
const DONE = "haggs.tour.done";

const STEPS: Step[] = [
  { target: null, scene: "welcome", title: "Welcome to haggs", body: "An open-source film studio on Comfy. Make pictures, animate them, edit them, and cut the film. Every button shows its price before you press it. This takes about a minute." },
  { target: "Photos", scene: "photos", title: "Start with a picture", body: "Make a photo, edit one, or build a character and a place that stay the same in every shot.", cta: { label: "Make a photo", href: "/photos" } },
  { target: "Video", scene: "video", title: "Then make it move", body: "A clip from words or a picture, a whole series, an edit recreated around your character, or found footage from the archive.", cta: { label: "Make a clip", href: "/video" } },
  { target: "Projects", scene: "projects", title: "Your projects live here", body: "Each project has its sheets, a board of every shot with its price, a cut with real tracks, and all its media. Everything saves in your browser.", cta: { label: "Open projects", href: "/library" } },
  { target: "Workflows", scene: "workflows", title: "Ready-made Comfy apps", body: "Swap a person, relight, try on an outfit, upscale. Pick one, drop in your files, press Run. Or build your own on the canvas.", cta: { label: "See workflows", href: "/workflows" } },
  { target: "Academy", scene: "academy", title: "Learn by doing", body: "Seven short lessons with free practice labs. You make your first video in lesson one.", cta: { label: "Start lesson one", href: "/academy/learn/first-video" } },
  { target: "keys", scene: "keys", title: "Add your Comfy key", body: "Runs bill to your own Comfy account. Add a key here and everything with a price becomes live. Prices are estimates, never surprises." },
  { target: "ask", scene: "ask", title: "Or just ask Haggy", body: "Describe what you want and Haggy sets it up for you: a draft, a board, a series, an app. Over MCP, Claude can do the same." },
];

export function Tour() {
  const [at, setAt] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const close = useCallback((finished: boolean) => {
    setAt(null);
    try { localStorage.setItem(DONE, finished ? "done" : "skipped"); } catch { /* private window */ }
  }, []);

  useEffect(() => {
    let first: ReturnType<typeof setTimeout> | undefined;
    try {
      // ?notour is for demos and tests: it marks the tour done and carries on.
      if (new URLSearchParams(window.location.search).has("notour")) localStorage.setItem(DONE, "skipped");
      else if (!localStorage.getItem(DONE)) first = setTimeout(() => setAt(0), 1100);
    } catch { /* private window */ }
    const start = () => setAt(0);
    window.addEventListener(TOUR_EVENT, start);
    return () => { clearTimeout(first); window.removeEventListener(TOUR_EVENT, start); };
  }, []);

  useLayoutEffect(() => {
    if (at === null) return setRect(null);
    const target = STEPS[at]!.target;
    const find = () => {
      const el = target ? ([...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].find((e) => e.getClientRects().length) ?? null) : null;
      el?.scrollIntoView({ block: "nearest", inline: "center" });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    window.addEventListener("resize", find);
    return () => window.removeEventListener("resize", find);
  }, [at]);

  useEffect(() => {
    if (at === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "ArrowRight") setAt((n) => (n === null ? n : Math.min(STEPS.length - 1, n + 1)));
      if (e.key === "ArrowLeft") setAt((n) => (n === null ? n : Math.max(0, n - 1)));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, close]);

  if (at === null) return null;
  const step = STEPS[at]!;
  const last = at === STEPS.length - 1;
  const below = rect ? rect.bottom + 14 : undefined;
  const mobile = typeof window !== "undefined" && window.innerWidth < 760;
  const style: React.CSSProperties | undefined = rect && !mobile ? { top: Math.min(below ?? 80, window.innerHeight - 330), left: Math.min(Math.max(16, rect.left + rect.width / 2 - 190), window.innerWidth - 396) } : undefined;

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label="Tour of haggs">
      <div className="tour-dim" onClick={() => close(false)} />
      {rect && <span className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className={`tour-card${rect ? "" : " centre"}`} style={style} key={at}>
        <div className={`tour-scene s-${step.scene}`} aria-hidden="true"><i /><i /><i /></div>
        <small>{at + 1} of {STEPS.length}</small>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {step.cta && <Link className="plain" href={step.cta.href} onClick={() => close(true)}>{step.cta.label}</Link>}
          <span className="tour-spacer" />
          {at > 0 && <button className="plain" onClick={() => setAt(at - 1)}>Back</button>}
          <button className="fire" onClick={() => (last ? close(true) : setAt(at + 1))} autoFocus>{last ? "Start making" : at === 0 ? "Show me" : "Next"}</button>
        </div>
        <ol className="tour-dots" aria-hidden="true">{STEPS.map((s, i) => <li key={s.title} className={i === at ? "on" : i < at ? "done" : ""} />)}</ol>
        <button className="tour-skip" onClick={() => close(false)}>Skip the tour</button>
      </div>
    </div>
  );
}
