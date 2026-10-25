import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";
import Link from "next/link";

import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";

export const metadata: Metadata = { title: "How haggs works — haggs", description: "A walk through the whole studio: photos, video, series, the editor, workflows, the gallery, plans and your files." };

/** A picture for a section. It shows once its file is in public/docs, and the page reads fine without it. */
function Pic({ name, alt }: { name: string; alt: string }) {
  if (!existsSync(join(process.cwd(), "public", "docs", `${name}.jpg`))) return null;
  return (
    <figure className="dc-pic">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/docs/${name}.jpg`} alt={alt} loading="lazy" />
    </figure>
  );
}

const CONTENTS: [string, string][] = [
  ["start", "Start here"],
  ["photos", "Photos"],
  ["video", "Video and series"],
  ["editor", "The editor"],
  ["workflows", "Workflows"],
  ["gallery", "Gallery"],
  ["academy", "Academy"],
  ["claude", "Claude and Haggy"],
  ["plans", "Plans, keys and prices"],
  ["files", "Your files"],
  ["help", "When something goes wrong"],
];

export default function Docs() {
  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <div className="docs">
          <header className="dc-head">
            <h1>How haggs works</h1>
            <p>haggs is a studio for making pictures, video and whole series on Comfy. You write what you want, see the price, press one button, and keep what you like. This page walks through every part of it.</p>
            <Pic name="hero" alt="A dark film studio desk with a storyboard on a glowing screen" />
          </header>

          <nav className="dc-toc" aria-label="On this page">
            {CONTENTS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <section id="start">
            <h2>Start here</h2>
            <ol className="dc-steps">
              <li><b>Look around.</b> Everything you can see here opens without paying for anything. Nothing is made, and nothing is charged, until you press a button that shows its price.</li>
              <li><b>Choose how you pay.</b> Either add your own Comfy key (the key chip in the header) and pay Comfy directly, or pick a plan and spend included credits. <a href="#plans">More on plans</a>.</li>
              <li><b>Make something small.</b> Open <Link href="/workflows/build?quick=photo-to-clip">Bring a photo to life</Link>, drop in a picture, say how it moves, and press Run. That is the whole loop.</li>
              <li><b>Take the Academy.</b> Seven short lessons that teach AI video by making it. <Link href="/academy">Open the Academy</Link>.</li>
            </ol>
            <p>An account is how your projects follow you between devices. Sign in with Google, GitHub or email from the top right.</p>
          </section>

          <section id="photos">
            <h2>Photos</h2>
            <Pic name="photos" alt="Portraits, a street location and a product on a dark table" />
            <p>The <Link href="/photos">Photos</Link> tabs are where the building blocks of a story come from.</p>
            <dl>
              <dt>Make</dt><dd>Describe a picture and get it back, with the exact prompt and price shown first. Pick a look, a shape and how many to make.</dd>
              <dt><Link href="/characters">Characters</Link></dt><dd>Build a person once and reuse them everywhere, so the same face turns up in every shot. Start from a photo or from words.</dd>
              <dt><Link href="/locations">Locations</Link></dt><dd>Save a place the same way: a street, a kitchen, a ship. Reuse it as the setting for any shot.</dd>
              <dt><Link href="/accessories">Accessories</Link></dt><dd>Props, outfits and products you want to keep consistent, such as the coat, the bottle or the bike.</dd>
              <dt><Link href="/comic">Comic strip</Link></dt><dd>Turn an idea into panels in one pass, with the same characters throughout.</dd>
            </dl>
          </section>

          <section id="video">
            <h2>Video and series</h2>
            <Pic name="video" alt="A row of film frames telling a short story" />
            <dl>
              <dt><Link href="/video">Make a clip</Link></dt><dd>One shot from words or from a picture, with the model, length and sound you choose.</dd>
              <dt><Link href="/series">Series</Link></dt><dd>Pick a format from the sample cards (What if, POV, Story series, Faceless channel and more), or start from a ready idea in Storytelling, History, Education, Kids or Trending. haggs writes the episodes, makes a picture for each shot, adds a narrator, and opens the result in the editor. Add your own look with a style sheet, or save your own series template, like a top ten or your favourite cars.</dd>
              <dt><Link href="/recreate">Recreate an edit</Link></dt><dd>Drop an edit you love, such as a trailer, an ad or a viral cut. haggs finds every shot and rebuilds the same structure around your character and your place. Or start from a structure: Outfit check, Product reveal, A day in the life, Walk and talk, Before and after, Trailer cold open.</dd>
              <dt><Link href="/found">Found footage</Link></dt><dd>Search old public-domain films from the Prelinger Archive and pull the clips that match what you asked for.</dd>
            </dl>
          </section>

          <section id="editor">
            <h2>The editor</h2>
            <Pic name="editor" alt="A film editing timeline with clips, a voice-over lane and a preview" />
            <p>Everything you make can become a project. <Link href="/library">Your projects</Link> holds them, and each one has three rooms.</p>
            <dl>
              <dt>Board</dt><dd>The storyboard: every shot in order with its words, characters, place and look. Reorder, rewrite and re-make shots here.</dd>
              <dt>Cut</dt><dd>The timeline. Trim and arrange clips, lay a voice-over, music and titles on their own lanes, mark review points, fade in and out, and save named versions you can restore. Reshoot a shot from a new camera angle, bridge two shots, swap a person, change the voice or lip-sync it. Render an MP4 with captions burned in, or export for Final Cut or Resolve.</dd>
              <dt>Grey Room</dt><dd>Work a shot out before you spend anything: place stand-in figures, set the camera and the light in a simple 3D room, then make it real. It can cut out a person, find a surface, build props from words and relight a scene.</dd>
            </dl>
            <Pic name="grey" alt="A grey clay room with stand-in figures, a camera and a light" />
            <p>The <Link href="/editor">Editor</Link> page also edits any single picture or clip: restyle, relight, upscale, remove something, widen or fill in.</p>
          </section>

          <section id="workflows">
            <h2>Workflows</h2>
            <Pic name="workflows" alt="Small glowing apps connected together" />
            <p><Link href="/workflows">Workflows</Link> are ready-made jobs. Quick start groups them by what you want to do: make something, swap and faces, fashion, product and ads, photo tools, video tools. Each card shows a real example of what it makes. Open one and it is a simple form; the nodes behind it are one tab away if you want to change them. Apps you build or save appear under Your apps.</p>
          </section>

          <section id="gallery">
            <h2>Gallery</h2>
            <Pic name="gallery" alt="A wall of finished pictures, clips and sound waves" />
            <p>The <Link href="/gallery">Gallery</Link> keeps everything you have made, newest first: pictures, video and Sounds. Filter by what it is, mark favourites, save a result into a project, or start a new shot from it. If a render finished on Comfy but never made it here, open Recover renders, pick it from your Comfy account, and it comes back. Nothing is generated and nothing is charged.</p>
          </section>

          <section id="academy">
            <h2>Academy</h2>
            <p>Seven short lessons, each with a few steps, a button into the real page and a small piece of homework. Your progress is saved in your browser. Finish all seven and there is a certificate to print or save. <Link href="/academy">Start the first lesson</Link>.</p>
          </section>

          <section id="claude">
            <h2>Claude and Haggy</h2>
            <Pic name="claude" alt="A friendly assistant handing a finished storyboard across a desk" />
            <p><b>Ask Haggy</b> in the header is the in-app assistant. It can draft a board, write a series, suggest looks and voices and find a workflow for a job. It never makes anything without you pressing Apply.</p>
            <p><b>Connect your own Claude, no key needed.</b> haggs includes an MCP server, so Claude in Claude Code or Claude Desktop can read your projects and send you work to apply. Run haggs on your computer (see the repo&rsquo;s README), and in Claude Code open the project folder, which registers the server through <code>.mcp.json</code>. For any other client, run <code>npx tsx scripts/mcp.ts</code>. Ask Claude for a board, a series or an app, and it lands in Activity ready to apply.</p>
          </section>

          <section id="plans">
            <h2>Plans, keys and prices</h2>
            <ul>
              <li><b>Your own Comfy key.</b> You pay Comfy directly at Comfy&rsquo;s prices. haggs keeps the key in a cookie in your browser and does not store it on its servers.</li>
              <li><b>A plan.</b> Included credits run on the platform&rsquo;s key. Credits are spent before a run starts and given back if it fails. Top up any time from your account. <Link href="/pricing">See plans</Link>.</li>
              <li><b>The price comes first.</b> Every Generate button shows what it will cost before you press it.</li>
              <li><b>Open weights.</b> A few apps run on open models only; they are marked Open weights.</li>
            </ul>
          </section>

          <section id="files">
            <h2>Your files</h2>
            <p>Projects, characters, places and runs live in your browser. When you are signed in they are also kept in your account, so they follow you from device to device. Results are kept in haggs&rsquo; file store, and anyone with a file&rsquo;s long private link can open it, so do not post links you want private. The details are in <Link href="/privacy">Privacy</Link> and <Link href="/terms">Terms</Link>.</p>
          </section>

          <section id="help">
            <h2>When something goes wrong</h2>
            <dl>
              <dt>It says I need a key.</dt><dd>Add your Comfy key from the header, or sign in and pick a plan.</dd>
              <dt>A picture or clip won&rsquo;t load.</dt><dd>The tile says so. If it was made on another computer, open the project there while signed in and leave it open until your account page shows the files have copied. Or use Recover renders in the Gallery.</dd>
              <dt>A run failed.</dt><dd>You are not charged for a run that does not complete. Credits are returned automatically.</dd>
              <dt>Something else.</dt><dd><a href="https://github.com/IBFolding/haggs/issues" target="_blank" rel="noreferrer">Report a problem on GitHub</a>.</dd>
            </dl>
          </section>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
