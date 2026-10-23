import type { Metadata } from "next";
import Link from "next/link";

import { LESSONS } from "../academy/lessons";
import { TEMPLATES } from "../catalog/templates";
import { FORMATS } from "../sheets/formats";
import { AcademyPath } from "./academy-path";
import { HeroReel } from "./hero-reel";
import { ModelsWall } from "./models-wall";
import { WorkflowDemo } from "./workflow-demo";
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

const TILES = [
  { name: "Photos", says: "Make, edit, build characters and places.", href: "/photos" },
  { name: "Video", says: "A clip from words or a picture.", href: "/video" },
  { name: "Series", says: "A topic into short vertical videos, faceless channels too.", href: "/series" },
  { name: "Comic strip", says: "Write panels, pick characters, get a finished page.", href: "/comic" },
  { name: "Recreate an edit", says: "Drop an edit you love; rebuild it around your character.", href: "/recreate" },
  { name: "Workflows", says: "26 ready-made apps: swap, relight, try on, upscale.", href: "/workflows" },
  { name: "Editor", says: "Cut, reshoot, restyle, sound and render.", href: "/library" },
  { name: "Academy", says: "Seven short lessons. Your first video in lesson one.", href: "/academy" },
] as const;

const SHOWN = TEMPLATES.filter((t) => t.sample).slice(0, 8);

export default function Landing() {
  let formatIndex = 0;
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
              <Link className="fire" href="/library">Start a project</Link>
              <Link className="plain" href="/workflows">See the Comfy workflows</Link>
            </div>
          </div>
          <HeroReel />
        </section>

        <section className="lp-tiles" aria-label="Make something now">
          <h2>Make something now</h2>
          <div className="lp-tile-grid">
            {TILES.map((t) => (
              <Link key={t.href} href={t.href} className="lp-tile">
                <b>{t.name}</b>
                <span>{t.says}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="lp-wall" aria-label="What it makes">
          <h2>Made with it, and how</h2>
          <p className="lp-wall-lede">Every result here is a starting point you can open. Press “How it was made” for the exact prompt, the model and what it cost, then try it with your own words.</p>
          <div className="lp-wall-grid">
            {SHOWN.map((t) => (
              <figure key={t.id}>
                {t.sample!.endsWith(".mp4") ? (
                  <video src={t.sample} poster={t.sample!.replace(/\/([^/]+)\.mp4$/, "/poster-$1.webp")} muted loop playsInline autoPlay preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.sample} alt="" loading="lazy" />
                )}
                <figcaption>{t.name}</figcaption>
                <details>
                  <summary>How it was made</summary>
                  <div>
                    <p className="lp-wall-prompt">{t.prompt.replace(/[\[\]]/g, "")}</p>
                    <p className="lp-wall-meta">{t.surface === "Video" ? "Video" : "Photo"} · {t.aspect ?? "any shape"}{t.fromPicture ? " · starts from your picture" : ""} · {t.surface === "Video" ? "MiniMax H3, about $0.13 a second" : "FLUX 3, about 7¢ a picture"}</p>
                    <Link className="plain" href={`${t.surface === "Video" ? "/video" : "/photos"}?template=${t.id}`}>Try it with your own words</Link>
                  </div>
                </details>
              </figure>
            ))}
          </div>
          <p className="lp-wall-note">Twelve starting points ship with the app, each shown by a real result. All made on Comfy Cloud with FLUX 3 and MiniMax H3. Prices are estimates, not invoices.</p>
        </section>

        <WorkflowDemo />

        <ModelsWall />

        <section className="lp-case" aria-label="Case study: recreate an edit">
          <h2>Recreate an edit, made for real</h2>
          <div className="lp-case-body">
            <video src="/showcase/recreate-outfit-check.mp4" poster="/showcase/recreate-outfit-check.jpg" muted loop playsInline autoPlay controls preload="metadata" />
            <div>
              <p className="lp-case-lede">A trending outfit-check edit, rebuilt around a character that stays the same man in every shot. Nothing here is stock: every picture and clip was made on Comfy from the steps below.</p>
              <ol className="lp-case-steps">
                <li><b>Pick the structure</b><span>The “Outfit check” starting point: five shots, a mirror reveal then the pieces. Free.</span></li>
                <li><b>Choose who is in it</b><span>Ellis, a character with a saved sheet. “He wears a camel overcoat, a cream knit, wide dark trousers and white leather sneakers, on a rainy city street.”</span></li>
                <li><b>Make the pictures</b><span>FLUX 3, five stills in the board’s frame shape. <em>$0.34</em></span></li>
                <li><b>Animate them</b><span>MiniMax H3, each still becomes the first frame of a 4.5 second clip. <em>$2.58</em></span></li>
                <li><b>Join the cut</b><span>22 seconds, vertical, ready to cut further in the editor. <em>$2.92 in all</em></span></li>
              </ol>
              <p><Link className="fire" href="/recreate">Recreate an edit</Link></p>
              <p className="lp-case-note">Prices are Comfy’s published rates at the time, estimates not invoices.</p>
            </div>
          </div>
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
                    {FORMATS.filter((f) => f.group === g).map((f) => <i key={f.id} style={{ "--i": formatIndex++ } as React.CSSProperties}>{f.label}</i>)}
                  </div>
                ))}
              </div>
            </article>
            <article>
              <h3>Upload a script</h3>
              <p>A season at a time if you like. Scenes, speakers, places and line numbers come straight off the page.</p>
              <div className="lp-demo lp-demo-script" aria-hidden="true">
                <code>INT. HARDWARE STORE — MORNING</code>
                <code>ROWAN reads her manual.</code>
                <code>ELLIS: Need a hand with that?</code>
                <em>Scene 1 · Rowan, Ellis · 1 line</em>
              </div>
            </article>
            <article>
              <h3>Write it with Claude</h3>
              <p>Describe the idea; Claude drafts the script to the format's beats and fills every sheet. Or connect Claude over MCP and work on the project together.</p>
              <div className="lp-demo lp-demo-claude" aria-hidden="true">
                <code>A lighthouse keeper hears a voice on the radio…</code>
                <span><i>Hook</i><i>Turn</i><i>Reveal</i></span>
              </div>
            </article>
            <article>
              <h3>Start from pictures</h3>
              <p>Drop stills on the board, one per scene, drag them into order and subplots, then animate from them.</p>
              <div className="lp-demo lp-demo-pics" aria-hidden="true">
                <b /><b /><b /><u />
              </div>
            </article>
          </div>
        </section>

        <section className="lp-academy" id="academy">
          <h2>Learn it by making it</h2>
          <p>The Academy is seven short lessons, about 90 minutes in all. You make a video in the first one, and every lesson ends in something real in haggs. Finish all seven for a certificate.</p>
          <AcademyPath lessons={LESSONS} />
        </section>

        <section className="lp-mcp" id="mcp">
          <h2>Works with Claude over MCP</h2>
          <p>
            haggs ships an MCP server. Connect Claude and it can read your projects, then send you work to apply: a whole board, takes,
            voice lines, a series, or an app laid out on the canvas. Nothing changes until you press Apply, and nothing is spent until you
            press a button that shows its price. No separate API key needed.
          </p>
          <div className="lp-mcp-grid">
            <article><h3>Read</h3><p>Projects, sheets, boards and shots, so Claude knows the film it is helping with.</p></article>
            <article><h3>Propose</h3><p>Drafts, boards, edits, takes, voices, canvases and series land in an inbox in the app.</p></article>
            <article><h3>Find</h3><p>Search Comfy&rsquo;s workflow library, open weights included, and stack what fits.</p></article>
          </div>
          <pre className="lp-code" aria-label="Connect Claude Code">claude mcp add haggs -- npx tsx scripts/mcp.ts</pre>
          <p className="lp-small">Claude Code picks it up from the repo&rsquo;s <code>.mcp.json</code> automatically. Any other MCP client can run <code>npx tsx scripts/mcp.ts</code>.</p>
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
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/IBFolding/haggs">GitHub</a>
        </footer>
      </main>
    </div>
  );
}
