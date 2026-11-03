"use client";

import { useEffect, useRef, useState } from "react";

import { SHOWCASE, SHOWCASE_REEL, type ShowcaseItem } from "../../community/showcase";

/** True when the person asked their system for less motion; clips then wait for a press instead of playing on their own. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Plays while at least half of it is on screen, pauses when it is not. Never plays at all with reduced motion. */
function useInView(ref: React.RefObject<HTMLVideoElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) void el.play().catch(() => undefined); else el.pause(); }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
}

function Reel({ item, reduced }: { item: ShowcaseItem; reduced: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useInView(ref, !reduced);
  return (
    <figure className="ex-reel">
      <video ref={ref} src={item.src} poster={item.poster} muted loop playsInline preload="none" controls={reduced} aria-label={item.alt} />
      <figcaption><b>{item.label}</b><span>Made with haggs</span></figcaption>
    </figure>
  );
}

function Tile({ item, reduced }: { item: ShowcaseItem; reduced: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <figure className="ex-tile ex-show">
      {item.kind === "video"
        ? <video ref={ref} src={item.src} muted loop playsInline preload="metadata" controls={reduced} aria-label={item.alt}
            onMouseEnter={reduced ? undefined : () => void ref.current?.play().catch(() => undefined)} onMouseLeave={() => ref.current?.pause()} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />}
      {item.kind === "video" && <i className="ex-kind">Clip</i>}
      <figcaption className="ex-by"><b>{item.label}</b></figcaption>
    </figure>
  );
}

/** The studio reel at the top of Explore: a 30 second WAYLIGHT cut, then stills and clips from across the studio. */
export function Showcase() {
  const reduced = useReducedMotion();
  return (
    <section className="ex-showcase" aria-labelledby="ex-showcase-h">
      <div className="ex-showcase-head">
        <h2 id="ex-showcase-h">From the studio</h2>
        <p>Made by the haggs team with haggs. WAYLIGHT is a short film made end to end in it; the rest is what the other tools make. Shares from people are below.</p>
      </div>
      <Reel item={SHOWCASE_REEL} reduced={reduced} />
      <div className="ex-grid">{SHOWCASE.map((s) => <Tile key={s.id} item={s} reduced={reduced} />)}</div>
    </section>
  );
}
