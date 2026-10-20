import type { Metadata } from "next";
import Link from "next/link";

import { FORMATS } from "../sheets/formats";
import { Nav } from "./nav";

export const metadata: Metadata = {
  title: "haggs — from a script to a finished cut",
  description: "An open-source film studio on Comfy: script sheets, a flow-chart storyboard, every take kept, and a cut you can export.",
};

/**
 * The front page. Its one bold thing is the board itself, drawn live in the
 * hero: the story line running through a main plot and a subplot, which is
 * the clearest picture of what haggs is for. No stock footage, no private
 * project media — everything on this page is the product's own shape.
 */

const LANES = [
  { name: "Main story", color: "#d4f83a", cards: [{ at: 0, title: "Cold open" }, { at: 2, title: "The bad plan" }, { at: 4, title: "Low point" }, { at: 5, title: "Climax" }] },
  { name: "B plot", color: "#7dd3fc", cards: [{ at: 1, title: "Inciting incident" }, { at: 3, title: "Midpoint turn" }] },
];
const ORDER = [
  [0, 0], [1, 1], [0, 2], [1, 3], [0, 4], [0, 5],
] as const;

function HeroBoard() {
  const col = 132;
  const lane = 118;
  const left = 96;
  const pos = (laneIndex: number, at: number) => ({ x: left + at * col, y: laneIndex * lane + 22 });
  const points = ORDER.map(([l, at]) => pos(l, at));
  const path = points
    .map((p, i) => {
      const c = { x: p.x + 50, y: p.y + 36 };
      if (!i) return `M ${c.x} ${c.y}`;
      const prev = points[i - 1]!;
      const pc = { x: prev.x + 50, y: prev.y + 36 };
      const mid = (pc.x + c.x) / 2;
      return `C ${mid} ${pc.y}, ${mid} ${c.y}, ${c.x} ${c.y}`;
    })
    .join(" ");
  return (
    <div className="lp-board" aria-hidden>
      <svg viewBox={`0 0 ${left + 6 * col} ${2 * lane}`} preserveAspectRatio="xMinYMid meet">
        {LANES.map((l, i) => (
          <g key={l.name}>
            <line x1="0" x2={left + 6 * col} y1={(i + 1) * lane} y2={(i + 1) * lane} className="lp-lane-line" />
            <rect x="0" y={i * lane + 10} width="3" height="18" fill={l.color} />
            <text x="10" y={i * lane + 24} className="lp-lane-name">{l.name}</text>
          </g>
        ))}
        <path d={path} className="lp-story" />
        {LANES.flatMap((l, i) =>
          l.cards.map((c, k) => {
            const p = pos(i, c.at);
            return (
              <g key={`${i}-${k}`} className="lp-card" style={{ animationDelay: `${c.at * 90}ms` }}>
                <rect x={p.x} y={p.y} width="100" height="72" rx="8" className="lp-card-box" />
                <rect x={p.x + 6} y={p.y + 6} width="88" height="42" rx="5" fill={`url(#g${(i + k) % 3})`} />
                <text x={p.x + 8} y={p.y + 63} className="lp-card-title">{c.title}</text>
              </g>
            );
          }),
        )}
        <defs>
          <linearGradient id="g0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a3a2a" /><stop offset="1" stopColor="#4f5a24" /></linearGradient>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f2c3a" /><stop offset="1" stopColor="#2d5566" /></linearGradient>
          <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a2a22" /><stop offset="1" stopColor="#6a4a2a" /></linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const TABS = [
  { name: "Sheets", says: "Upload a script or pick a format. The scenes, the speaking cast and the places land on sheets; you add identity locks, looks and a shot list with real camera moves." },
  { name: "Board", says: "The story as a flow chart. Subplots get their own lanes, characters show where they appear, and dragging a card re-times the whole thing." },
  { name: "Cut", says: "Every shot in order with its takes. Flip between takes, split a shot, roll one again, and export the cut." },
  { name: "Media", says: "Everything the project is made of, by shot: takes, stills and references. Change what a shot should show and roll it again." },
];

export default function Landing() {
  const groups = ["Half-hour", "Hour", "Vertical", "Short"] as const;
  return (
    <div className="app lp">
      <Nav current="Home" />
      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-text">
            <h1>From a script to a <b>finished cut</b>.</h1>
            <p>
              haggs is an open-source film studio built on Comfy. Break a script into sheets, lay it out as a storyboard you can
              rearrange, shoot each shot with MiniMax H3 and friends, keep every take, and cut it — all in one project, at the price
              each model actually charges.
            </p>
            <div className="lp-cta">
              <Link className="fire" href="/signup">Start a project</Link>
              <Link className="plain" href="#how">How it works</Link>
            </div>
          </div>
          <HeroBoard />
        </section>

        <section className="lp-tabs" id="how">
          <h2>One project, four places</h2>
          <ol>
            {TABS.map((tab, i) => (
              <li key={tab.name}>
                <span className="lp-step">{i + 1}</span>
                <h3>{tab.name}</h3>
                <p>{tab.says}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-starts">
          <h2>Start however you start</h2>
          <div className="lp-start-grid">
            <article>
              <h3>Pick a format</h3>
              <p>Every format comes with its beats already where a hit puts them.</p>
              <div className="lp-formats">
                {groups.map((g) => (
                  <div key={g}>
                    <span>{g}</span>
                    {FORMATS.filter((f) => f.group === g).map((f) => <i key={f.id}>{f.label}</i>)}
                  </div>
                ))}
              </div>
            </article>
            <article>
              <h3>Upload a script</h3>
              <p>A season at a time if you like. Scenes, speakers, places and line numbers come straight off the page.</p>
            </article>
            <article>
              <h3>Write it with Claude</h3>
              <p>Describe the idea; Claude drafts the script to the format's beats and fills every sheet. Or connect Claude over MCP and work on the project together.</p>
            </article>
            <article>
              <h3>Start from pictures</h3>
              <p>Drop stills on the board, one per scene, drag them into order and subplots, then animate from them.</p>
            </article>
          </div>
        </section>

        <section className="lp-honest">
          <h2>What it costs</h2>
          <p>
            Every Generate button shows its price before you press it. Bring your own Comfy key and pay Comfy directly, or subscribe and
            spend included credits.
          </p>
          <Link className="plain" href="/pricing">See plans</Link>
        </section>
        <footer className="lp-foot">
          <span>haggs · open source, MIT licensed · built on Comfy</span>
          <Link href="/library">Your projects</Link>
        </footer>
      </main>
    </div>
  );
}
