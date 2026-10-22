"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Entry } from "../../server/comfy-library";
import { Nav, openKeys } from "../nav";
import { SWAP_THUMB } from "../squares";
import { createAppStore, type SavedApp } from "../../story/apps";
import { defaultKv } from "../../story/kv";
import { listWorkflows, type Listing } from "../workflow-actions";

/**
 * Comfy's workflows, ready to run: every public template that converts to a
 * prompt Comfy Cloud can run, shown by its own example result, filtered by
 * what it makes. Picking one opens it as a simple form; the nodes are a tab away.
 */

const SHELVES = ["Featured", "Video", "Image", "Character & Fashion", "Product & Ads", "Brand & Design", "Video Tools", "Image Tools", "Audio"] as const;
const FEATURED = ["api_higgsfield_genjutsu_motion_transfer", "template_seedance2_0_viral_videos_character_swap", "video_wan21_scail2_character_replacement", "video_minimax_h3_r2v", "api_bria_video_replace_background"];

export function Workflows() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [shelf, setShelf] = useState<(typeof SHELVES)[number]>("Featured");
  const [hunt, setHunt] = useState("");
  const [mine, setMine] = useState<SavedApp[]>([]);
  useEffect(() => {
    void createAppStore(defaultKv()).list().then(setMine).catch(() => setMine([]));
  }, []);

  useEffect(() => {
    let live = true;
    const load = () =>
      void listWorkflows().then((l) => {
        if (!live) return;
        setListing(l);
        // The first visit checks every template in the background; look again when it's done.
        if (!l.checked && !l.needsKey) setTimeout(load, 8000);
      });
    load();
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    const all = listing?.entries ?? [];
    const words = hunt.trim().toLowerCase();
    if (words) return all.filter((e) => `${e.title} ${e.description} ${e.tags.join(" ")} ${e.models.join(" ")}`.toLowerCase().includes(words)).slice(0, 120);
    if (shelf === "Featured") {
      const picked = FEATURED.map((n) => all.find((e) => e.name === n)).filter((e): e is Entry => Boolean(e));
      const popular = [...all].sort((a, b) => b.usage - a.usage).filter((e) => !FEATURED.includes(e.name)).slice(0, 23);
      return [...picked, ...popular];
    }
    return all.filter((e) => e.category === shelf).sort((a, b) => b.usage - a.usage);
  }, [listing, shelf, hunt]);

  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head">
            <div>
              <h1>Comfy workflows, ready to run</h1>
              <p>Pick one, drop in your files, press Run. The price is on the button. Every workflow here runs on Comfy Cloud with your key, and the nodes are a tab away.</p>
            </div>
            <div className="sheet-row">
              <Link className="fire" href="/workflows/build">Build your own</Link>
              <Link className="pill" href="/workflows/import">Open a workflow or app</Link>
            </div>
          </header>

          {mine.length > 0 && (
            <section className="wf-mine" aria-label="Your apps">
              <h2>Your apps</h2>
              <div className="squares-grid">
                {mine.map((a) => (
                  <Link key={a.id} className={`square${a.cover ? "" : " bare"}`} href={`/workflows/mine?id=${a.id}`}>
                    {a.cover && (a.cover.kind === "video" ? <video src={a.cover.url} muted loop autoPlay playsInline /> : <img src={a.cover.url} alt="" />)}
                    <span className="square-tag">{a.recipe ? "Built here" : "Your app"}</span>
                    <span className="square-face"><b>{a.name}</b>{a.description && <small>{a.description}</small>}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="wf-apps" aria-label="Apps">
            <Link className="wf-app" href="/swap">
              <img src={SWAP_THUMB} alt="" />
              <span><b>Swap a character</b><small>Drop a video and a picture, say who to replace. The scene, camera and sound stay.</small></span>
            </Link>
          </section>

          <div className="wf-bar">
            <input className="wf-hunt" value={hunt} onChange={(e) => setHunt(e.target.value)} placeholder="Search: character swap, product video, upscale…" aria-label="Search workflows" />
            <div className="wf-shelves" role="tablist" aria-label="What it makes">
              {SHELVES.map((s) => (
                <button key={s} role="tab" aria-selected={!hunt && shelf === s} className={!hunt && shelf === s ? "on" : ""} onClick={() => { setShelf(s); setHunt(""); }}>{s}</button>
              ))}
            </div>
          </div>

          {listing?.needsKey && (
            <p className="wf-note">Add a Comfy key to see which of these run on your account. <button className="plain" onClick={() => openKeys()}>Add a key</button></p>
          )}
          {listing && !listing.checked && !listing.needsKey && <p className="wf-note" role="status">Checking which workflows run on Comfy Cloud. This takes a minute the first time.</p>}

          {!listing ? (
            <div className="wf-grid">{Array.from({ length: 12 }, (_, i) => <div key={i} className="wf-tile ghost" />)}</div>
          ) : !shown.length ? (
            <p className="wf-note">Nothing matches “{hunt}”. Try a model name, or what you want to make.</p>
          ) : (
            <div className="wf-grid">
              {shown.map((e) => (
                <Link key={e.name} className="wf-tile" href={`/workflows/${encodeURIComponent(e.name)}`}>
                  <img src={e.thumb} alt="" loading="lazy" />
                  <span className="wf-tile-face">
                    <b>{e.title}</b>
                    <small>{[...e.models.slice(0, 2), e.inputs.length ? `${e.inputs.length} input${e.inputs.length === 1 ? "" : "s"}` : "from words"].join(" · ")}</small>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="wf-credit">Workflows and example results from Comfy&rsquo;s <a href="https://github.com/Comfy-Org/workflow_templates" target="_blank" rel="noreferrer">workflow templates</a> (MIT).</p>
        </div>
      </div>
    </div>
  );
}
