"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Entry } from "../../server/comfy-library";
import { Nav, openKeys } from "../nav";
import { SWAP_THUMB } from "../swap/thumb";
import { GROUPS, QUICK_APPS, isOpenApp } from "../../comfy/quick";
import { createAppStore, type SavedApp } from "../../story/apps";
import { defaultKv } from "../../story/kv";
import { listWorkflows, type Listing } from "../workflow-actions";

/**
 * Comfy's workflows, ready to run: every public template that converts to a
 * prompt Comfy Cloud can run, shown by its own example result, filtered by
 * what it makes. Picking one opens it as a simple form; the nodes are a tab away.
 */

const TABS = ["Quick start", "Featured", "Video", "Image", "Character & Fashion", "Product & Ads", "Brand & Design", "Video Tools", "Image Tools", "Audio"] as const;
const SHELVES = ["Featured", "Video", "Image", "Character & Fashion", "Product & Ads", "Brand & Design", "Video Tools", "Image Tools", "Audio"] as const;
const FEATURED = ["api_higgsfield_genjutsu_motion_transfer", "template_seedance2_0_viral_videos_character_swap", "video_wan21_scail2_character_replacement", "video_minimax_h3_r2v", "api_bria_video_replace_background"];

export function Workflows() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Quick start");
  const shelf = (tab === "Quick start" ? "Featured" : tab) as (typeof SHELVES)[number];
  const [hunt, setHunt] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>(GROUPS[0]);
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
              <p>Pick one, drop in your files, press Run. The price is on the button.</p>
            </div>
            <Link className="fire" href="/workflows/build">Build your own</Link>
          </header>
          <p className="wf-links">
            <Link href="/workflows/import">Open a workflow or app</Link>
            <Link href="/workflows/community">Community apps</Link>
            {mine.length > 0 && <a href="#your-apps">Your apps ({mine.length})</a>}
          </p>

          <div className="wf-bar">
            <div className="wf-shelves" role="tablist" aria-label="What to browse">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={!hunt && tab === t} className={!hunt && tab === t ? "on" : ""} onClick={() => { setTab(t); setHunt(""); }}>{t}</button>
              ))}
            </div>
            <input className="wf-hunt" value={hunt} onChange={(e) => setHunt(e.target.value)} placeholder="Search workflows" aria-label="Search workflows" />
          </div>

          {!hunt && tab === "Quick start" && (
            <section className="quick" aria-label="Ready-made apps">
              <div className="quick-tabs" role="tablist" aria-label="Kind of job">
                {GROUPS.map((g) => (
                  <button key={g} role="tab" aria-selected={group === g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>{g}</button>
                ))}
              </div>
              <div className="quick-row">
                {QUICK_APPS.filter((a) => a.group === group).map((a) => (
                  <Link key={a.id} className="quick-card" href={`/workflows/build?quick=${a.id}`}>
                    <b>{a.name}</b>
                    <span>{a.says}</span>
                    <small>{isOpenApp(a) ? "Open weights" : a.makes === "video" ? "Video" : "Picture"}</small>
                  </Link>
                ))}
                {group === "Swap and faces" && (
                  <Link className="quick-card swap" href="/swap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SWAP_THUMB} alt="" />
                    <b>Swap a character</b>
                    <span>Drop a video and a picture, say who to replace. The scene, camera and sound stay.</span>
                    <small>Video</small>
                  </Link>
                )}
              </div>
            </section>
          )}

          {!hunt && tab === "Quick start" && mine.length > 0 && (
            <section className="wf-mine" id="your-apps" aria-label="Your apps">
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

          {listing?.needsKey && (
            <p className="wf-note">Add a Comfy key to see which of these run on your account. <button className="plain" onClick={() => openKeys()}>Add a key</button></p>
          )}
          {listing && !listing.checked && !listing.needsKey && <p className="wf-note" role="status">Checking which workflows run on Comfy Cloud. This takes a minute the first time.</p>}

          {!hunt && tab === "Quick start" ? null : !listing ? (
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
