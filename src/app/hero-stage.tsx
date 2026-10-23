"use client";

import { useEffect, useRef } from "react";

/**
 * The hero: the product working. A board of real clips resolves card by
 * card — an outline, then the picture, then the video — with the price
 * ticking on each, wires pulsing along the story, and the cut playing
 * underneath. The stage is drawn at a fixed 1600×820 and scaled to fit, so
 * every position, wire and the travelling spark stay exactly in step.
 */

type Card = { x: number; y: number; w: number; h: number; label: string; still: string; video?: string; a: string; b: string; at: number };

const W = 1600;
const H = 820;
const T = "/templates/";

// Two lanes: the main story on top, a subplot beneath. `at` is the order they resolve in.
const CARDS: Card[] = [
  { x: 36, y: 70, w: 280, h: 160, label: "Establishing", still: "poster-establishing-drone.webp", video: "establishing-drone.mp4", a: "$0.07", b: "$0.52", at: 0 },
  { x: 356, y: 70, w: 280, h: 160, label: "Product in the scene", still: "poster-product-placement.webp", video: "product-placement.mp4", a: "$0.07", b: "$0.52", at: 2 },
  { x: 676, y: 70, w: 280, h: 160, label: "The realisation", still: "poster-dolly-zoom.webp", video: "dolly-zoom.mp4", a: "$0.07", b: "$0.52", at: 4 },
  { x: 996, y: 70, w: 280, h: 160, label: "Bring it to life", still: "poster-animate-still.webp", video: "animate-still.mp4", a: "$0.07", b: "$0.52", at: 6 },
  { x: 1316, y: 70, w: 248, h: 160, label: "The poster", still: "key-art.webp", a: "$0.07", b: "$0.07", at: 8 },
  { x: 196, y: 316, w: 280, h: 160, label: "Where it happens", still: "location-plate.webp", a: "$0.07", b: "$0.07", at: 1 },
  { x: 516, y: 316, w: 180, h: 160, label: "Reshoot · reverse", still: "storyboard-frame.webp", a: "$0.10", b: "$0.10", at: 3 },
  { x: 736, y: 316, w: 160, h: 160, label: "Product 360", still: "poster-product-orbit.webp", video: "product-orbit.mp4", a: "$0.07", b: "$0.52", at: 5 },
  { x: 936, y: 316, w: 280, h: 160, label: "The character", still: "character-sheet.webp", a: "$0.07", b: "$0.07", at: 7 },
];
const STORY = [0, 5, 1, 6, 2, 7, 3, 8, 4]; // card indices in story order, zig-zagging between the lanes

const center = (c: Card) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
function wire() {
  const pts = STORY.map((i) => center(CARDS[i]!));
  return pts.map((p, i) => {
    if (!i) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1]!;
    const mx = (q.x + p.x) / 2;
    return `C ${mx} ${q.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
  }).join(" ");
}
const PATH = wire();

const STRIP = ["poster-establishing-drone.webp", "poster-product-placement.webp", "poster-dolly-zoom.webp", "poster-animate-still.webp", "location-plate.webp", "storyboard-frame.webp", "poster-product-orbit.webp", "character-sheet.webp", "key-art.webp", "poster-ugc-talking.webp", "product-hero.webp", "ai-influencer.webp"];
// Whole pixels, so the server and the browser draw exactly the same bars.
const BARS = Array.from({ length: 96 }, (_, i) => Math.round(6 + Math.abs(Math.sin(i * 0.7) * 12 + Math.sin(i * 0.23) * 10) + ((i * 37) % 7)));

export function HeroStage() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--s", String(el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="hs" ref={box} aria-hidden>
      <div className="hs-stage" style={{ width: W, height: H }}>
        <span className="hs-lane" style={{ left: 36, top: 36 }}>Main story</span>
        <span className="hs-lane b" style={{ left: 196, top: 282 }}>B plot</span>

        <svg className="hs-wires" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <defs>
            <linearGradient id="hs-g" x1="0" x2="1"><stop offset="0" stopColor="#d4f83a" stopOpacity="0.15" /><stop offset="0.5" stopColor="#d4f83a" stopOpacity="0.9" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0.7" /></linearGradient>
            <filter id="hs-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
          </defs>
          <path d={PATH} className="hs-wire-glow" filter="url(#hs-glow)" />
          <path d={PATH} className="hs-wire" stroke="url(#hs-g)" />
        </svg>
        <span className="hs-spark" style={{ offsetPath: `path("${PATH}")` }} />

        {CARDS.map((c) => (
          <div key={c.label} className="hs-card" style={{ left: c.x, top: c.y, width: c.w, height: c.h, ["--d" as string]: `${0.5 + c.at * 0.55}s` }}>
            <img className="hs-still" src={T + c.still} alt="" />
            {c.video && <video className="hs-video" src={T + c.video} poster={T + c.still} muted loop playsInline autoPlay preload="auto" />}
            <span className="hs-chip">{c.label}</span>
            <span className="hs-price a">{c.a}</span>
            {c.video && <span className="hs-price b">{c.b}</span>}
          </div>
        ))}

        <div className="hs-cut" style={{ left: 36, top: 540, width: W - 72 }}>
          <div className="hs-cut-head"><b>Cut</b><span>9 shots · voices · soundtrack</span><i>Render MP4</i></div>
          <div className="hs-strip">
            {STRIP.map((s, i) => <img key={s} src={T + s} alt="" style={{ animationDelay: `${5.2 + i * 0.12}s` }} />)}
            <span className="hs-playhead" />
          </div>
          <div className="hs-wave">{BARS.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${(i % 12) * 0.08}s` }} />)}</div>
        </div>
      </div>
    </div>
  );
}
