import type { Metadata } from "next";
import Link from "next/link";

import { FORMATS } from "../sheets/formats";
import { HeroStage } from "./hero-stage";
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
            <h1>Script to screen. <b>Every shot, every price, in the open.</b></h1>
            <p>
              An open-source film studio on Comfy. Break a script into a board, make the pictures, animate them, reshoot any shot
              from a new angle, swap a character into any video, voice it, score it and render the cut. Each button shows what it
              costs before you press it.
            </p>
            <div className="lp-cta">
              <Link className="fire" href="/signup">Start a project</Link>
              <Link className="plain" href="/workflows">See the Comfy workflows</Link>
            </div>
          </div>
          <HeroStage />
        </section>

        <section className="lp-wall" aria-label="What it makes">
          <h2>Made with it</h2>
          <div className="lp-wall-grid">
            {[
              ["ugc-talking.mp4", "poster-ugc-talking.webp", "Influencer to camera"],
              ["dolly-zoom.mp4", "poster-dolly-zoom.webp", "Dolly zoom"],
              ["product-orbit.mp4", "poster-product-orbit.webp", "Product 360"],
              ["establishing-drone.mp4", "poster-establishing-drone.webp", "Drone establishing"],
              ["product-placement.mp4", "poster-product-placement.webp", "Product placement"],
              ["animate-still.mp4", "poster-animate-still.webp", "A still, alive"],
            ].map(([v, p, label]) => (
              <figure key={v}>
                <video src={`/templates/${v}`} poster={`/templates/${p}`} muted loop playsInline autoPlay preload="metadata" />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="lp-wall-note">Twelve starting points ship with the app, each shown by a real result. All made on Comfy Cloud with FLUX 3 and MiniMax H3.</p>
        </section>

        <section className="lp-tabs" id="how">
          <h2>One project, four places, one assistant</h2>
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
