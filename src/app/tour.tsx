"use client";

import Link from "next/link";

import { defaultKv } from "../story/kv";
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
  { target: "Photos", scene: "photos", title: "Start with a picture", body: "Make a photo, edit one, or build a character, a place and a prop that stay the same in every shot.", cta: { label: "Open Photos", href: "/photos" } },
  { target: "Video", scene: "video", title: "Then make it move", body: "A clip from words or a picture, a series, an edit recreated around your character, or found footage.", cta: { label: "Open Video", href: "/video" } },
  { target: "Projects", scene: "projects", title: "Your projects live here", body: "Sheets for the script, a board of every shot with its price, a cut with real tracks, and all the media. The Grey room is one button away." },
  { target: "Workflows", scene: "workflows", title: "Ready-made Comfy apps", body: "Swap a person, relight, try on an outfit, upscale. Pick one, drop in your files, press Run.", cta: { label: "See workflows", href: "/workflows" } },
  { target: "Gallery", scene: "workflows", title: "Everything you made", body: "Pictures, video and sounds, in folders, with what each one cost. Star what you keep, delete the rest.", cta: { label: "Open Gallery", href: "/gallery" } },
  { target: "Academy", scene: "academy", title: "Learn by doing", body: "Seven lessons with free practice labs, the docs, the model guide and prices. You make your first video in lesson one.", cta: { label: "Open the Academy", href: "/academy" } },
  { target: "keys", scene: "keys", title: "Choose how you pay", body: "Buy credits, add your own Comfy key, or connect your own GPU. Every price on a button is shown before you press it, and you can change this any time." },
  { target: "ask", scene: "ask", title: "Or just ask Haggy", body: "Describe what you want and Haggy sets it up: a draft, a board, a series, an app. Nothing is made until you press Apply." },
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
      // Only the first time someone is inside the app: never on the landing page, and never for someone who already has projects here.
      else if (!localStorage.getItem(DONE) && window.location.pathname !== "/") {
        void defaultKv().get<unknown[]>("projects/index").then((list) => {
          if (Array.isArray(list) && list.length) { try { localStorage.setItem(DONE, "skipped"); } catch { /* private window */ } return; }
          first = setTimeout(() => setAt(0), 1100);
        }).catch(() => { first = setTimeout(() => setAt(0), 1100); });
      }
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

  return (
    <div className="tour" role="dialog" aria-modal="false" aria-label="Tour of haggs">
      {rect && <span className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-card" key={at}>
        <div className="tour-top">
          <small>Step {at + 1} of {STEPS.length}</small>
          <button className="tour-skip" onClick={() => close(false)}>Skip the tour</button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <ol className="tour-dots" aria-hidden="true">{STEPS.map((s, i) => <li key={s.title} className={i === at ? "on" : i < at ? "done" : ""} />)}</ol>
        <div className="tour-actions">
          {at > 0 && <button className="tour-back" onClick={() => setAt(at - 1)}>Back</button>}
          {step.cta && <Link className="tour-try" href={step.cta.href} onClick={() => close(true)}>{step.cta.label}</Link>}
          <span className="tour-spacer" />
          <button className="tour-next" onClick={() => (last ? close(true) : setAt(at + 1))} autoFocus>{last ? "Start making" : "Next"}</button>
        </div>
      </div>
    </div>
  );
}
