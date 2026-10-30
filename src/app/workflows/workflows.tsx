"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CONTEST_EFFECTS, contestName, contestVariant } from "../../comfy/contest-lab";
import { STUDIO_WORKFLOWS } from "../../comfy/world-motion-vfx";
import { GAME_DIRECTOR } from "../../comfy/game-director";
import { HaggsBadge } from "./haggs-badge";
import { LTX_WORKFLOWS, ltxWorkflow } from "../../comfy/ltx";
import type { Entry } from "../../server/comfy-library";
import { Nav, openKeys } from "../nav";
import { SWAP_THUMB } from "../swap/thumb";
import { GROUPS, QUICK_APPS, isOpenApp } from "../../comfy/quick";
import { usePrefs } from "../prefs";
import { createAppStore, type SavedApp } from "../../story/apps";
import { defaultKv } from "../../story/kv";
import { listWorkflows, type Listing } from "../workflow-actions";
import { Favorite, useWorkflowFavorites } from "./favorite";
import { SiteFooter } from "../site-footer";

/**
 * Comfy's workflows, ready to run: every public template that converts to a
 * prompt Comfy Cloud can run, shown by its own example result, filtered by
 * what it makes. Picking one opens it as a simple form; the nodes are a tab away.
 */

const TABS = ["Quick start", "Haggs", "Featured", "Video", "Image", "Character & Fashion", "Product & Ads", "Brand & Design", "Video Tools", "Image Tools", "Audio"] as const;
const SHELVES = ["Featured", "Video", "Image", "Character & Fashion", "Product & Ads", "Brand & Design", "Video Tools", "Image Tools", "Audio"] as const;
const FEATURED = ["api_higgsfield_genjutsu_motion_transfer", "template_seedance2_0_viral_videos_character_swap", "video_wan21_scail2_character_replacement", "video_minimax_h3_r2v", "api_bria_video_replace_background"];
const GAME_GUIDE_APPS: Record<string, string> = { '01-drag-to-action':'haggs_preview_drag_to_action', '02-boss-fight-choreographer':'haggs_preview_boss_fight', '04-game-reskin-director':'haggs_preview_game_reskin', '05-animation-moveset-builder':'haggs_preview_moveset', '06-enemy-intent-painter':'haggs_preview_enemy_intent' };

function HaggsCard({ title, image, label, href, children }: { title: string; image: string; label: string; href?: string; children: ReactNode }) {
  if (href) return <div className="haggs-workflow-card">
    <Link className="wf-tile" href={href}><img src={image} alt="" loading="lazy" /><span className="wf-tile-face"><b>{title}</b><small>{label} · Illustrative image</small><small>Open app</small></span></Link>
    <details className="haggs-workflow-options"><summary>More options and downloads</summary>{children}</details>
  </div>;
  return <details className="haggs-workflow-card">
    <summary className="wf-tile">
      <img src={image} alt="" loading="lazy" />
      <span className="wf-tile-face"><b>{title}</b><small>{label} · Illustrative image</small><small>View workflow options</small></span>
    </summary>
    <div className="haggs-workflow-options">{children}</div>
  </details>;
}

export function Workflows() {
  const { openOnly } = usePrefs();
  const {favorites,ready:favoriteReady,error:favoriteError,toggle:toggleFavorite}=useWorkflowFavorites();
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Quick start");
  const shelf = (tab === "Quick start" || tab === "Haggs" ? "Featured" : tab) as (typeof SHELVES)[number];
  const [hunt, setHunt] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>(GROUPS[0]);
  const [mine, setMine] = useState<SavedApp[]>([]);
  const haggs = tab === "Haggs" && !onlyFavorites;
  const matchesHaggs = (name: string, description: string) => !haggs || `${name} ${description}`.toLowerCase().includes(hunt.trim().toLowerCase());
  const effects = CONTEST_EFFECTS.filter(e => matchesHaggs(e.name, e.scope));
  const games = GAME_DIRECTOR.filter(g => matchesHaggs(g.title, `${g.scope} ${g.output}`));
  const studio = STUDIO_WORKFLOWS.filter(w => matchesHaggs(w.title, `${w.scope} ${w.limits}`));
  useEffect(() => {
    const fromHash = () => {
      if (window.location.hash.startsWith("#haggs")) { setTab("Haggs"); setOnlyFavorites(false); setHunt(""); }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

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
    const all = (listing?.entries ?? []).filter(e=>!onlyFavorites||favorites.includes(e.name));
    const words = hunt.trim().toLowerCase();
    if (words) return all.filter((e) => `${e.title} ${e.description} ${e.tags.join(" ")} ${e.models.join(" ")}`.toLowerCase().includes(words)).slice(0, 120);
    if(onlyFavorites)return all;
    if (shelf === "Featured") {
      const picked = FEATURED.map((n) => all.find((e) => e.name === n)).filter((e): e is Entry => Boolean(e));
      const popular = [...all].sort((a, b) => b.usage - a.usage).filter((e) => !FEATURED.includes(e.name)).slice(0, 23);
      return [...picked, ...popular];
    }
    return all.filter((e) => e.category === shelf).sort((a, b) => b.usage - a.usage);
  }, [listing, shelf, hunt,onlyFavorites,favorites]);

  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas">
        <div className="wf">
          <header className="wf-head">
            <div>
              <span className="eyebrow">Workflows</span>
              <h1>Comfy workflows, ready to run</h1>
              <p>Pick one, drop in your files, press Run. The price is on the button.</p>
            </div>
            <Link className="fire" href="/workflows/build">Build your own</Link>
          </header>
          <p className="wf-links">
            <Link href="/workflows/import">Open a workflow or app</Link>
            <Link href="/workflows/community">Community apps</Link>
            <a href="#haggs" onClick={() => { setTab("Haggs"); setOnlyFavorites(false); setHunt(""); }}>Haggs custom workflows (16)</a>
            {mine.length > 0 && <a href="#your-apps">Your apps ({mine.length})</a>}
          </p>

          {favoriteError&&<p role="alert">{favoriteError}</p>}
          <div className="wf-bar">
            <button className="plain" aria-pressed={onlyFavorites} onClick={()=>setOnlyFavorites(v=>!v)}>★ Favorites</button>
            <div className="wf-shelves" role="tablist" aria-label="What to browse">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={!onlyFavorites && tab === t} className={!onlyFavorites && tab === t ? "on" : ""} onClick={() => { setTab(t); setHunt(""); setOnlyFavorites(false); window.history.replaceState(window.history.state, "", t === "Haggs" ? "#haggs" : window.location.pathname + window.location.search); }}>{t}</button>
              ))}
            </div>
            <input className="wf-hunt" value={hunt} onChange={(e) => setHunt(e.target.value)} placeholder={haggs ? "Search Haggs workflows" : "Search workflows"} aria-label="Search workflows" />
          </div>

          {haggs && <section className="quick" id="haggs" aria-label="Haggs custom workflows">
            <h2>Haggs custom workflows</h2>
            <p>16 tools across Effects, Game Director, and World, Motion &amp; VFX. These packs include Haggs custom-node source and attribution. Their upstream models and templates keep their own credits. <a href="/workflows/PROVENANCE.md">Read provenance</a>.</p>
            <p>Local apps have an open-app link; native ComfyUI tools have downloads and setup instructions. Samples are labeled illustrative or synthetic. GPU generation remains unverified.</p>
            {!hunt && <p><a href="#haggs-effects">7 effects</a> · <a href="#haggs-games">6 Game Director tools</a> · <a href="#haggs-studio">3 world, motion and VFX toolsets</a></p>}
            {hunt && !effects.length && !games.length && !studio.length && <p role="status">No Haggs workflows match “{hunt}”. Try motion, video, atlas or effects.</p>}
          </section>}

          {!hunt && !onlyFavorites && (haggs || tab === "Featured") && (
            <section className="quick" aria-label="LTX featured workflows">
              <h2>LTX featured workflows · upstream adaptations</h2>
              <p>Open-weight video workflows. Connect your GPU or Comfy Cloud; installed nodes and weights are checked before running. Cloud compute may cost money. Live generation has not been verified for this bundle.</p>
              <div className="quick-row">
                {LTX_WORKFLOWS.map(w => <div className="quick-card" key={w.name}>
                  <a href={w.image} target="_blank" rel="noreferrer"><img src={w.image} alt={w.sample} width={1536} height={1024} style={{width:"100%",height:"auto",borderRadius:8}} loading="lazy" /></a>
                  <small>Illustrative example · not an LTX render</small>
                  <Link href={`/workflows/${w.name}`}><b>{w.title}</b></Link>
                  <span>{w.description}</span>
                  <small>{w.sample}</small>
                  <Link href={`/workflows/${w.name}`}>Open app and nodes</Link>
                  <a href={`/workflows/ltx/${w.file}.json`} download>Download ComfyUI workflow</a>
                </div>)}
              </div>
              <p className="wf-small">Requires current ComfyUI, ComfyUI-LTXVideo and the weights named in each graph. <a href="/workflows/ltx/README.txt">Setup and limitations</a> · <a href="/workflows/ltx/SOURCES.json">Sources</a> · <a href="/workflows/ltx/LICENSE-LTXVideo.txt">LTX license</a> · <a href="/workflows/ltx/LICENSE-workflow-templates.txt">Template license</a></p>
            </section>
          )}

          {haggs && effects.length > 0 && (
            <section className="quick" id="haggs-effects" aria-label="Contest Lab effects">
              <h2>Seven experimental effects</h2>
              <p>Install the included Contest Lab nodes in your local ComfyUI. Reuse a take without another model call, or generate a layer with LTX. Live ComfyUI execution remains unverified.</p>
              <div className="wf-grid">
                {effects.map(e => <HaggsCard key={e.slug} title={e.name} image={e.image} label="Effect · local ComfyUI" href={`/workflows/${contestName(e.slug, 'reuse')}`}>
                  <HaggsBadge provenance="/workflows/PROVENANCE.md" />
                  <p>{e.scope}</p>
                  <Link href={`/workflows/${contestName(e.slug, 'reuse')}`}>Reuse existing video · local app</Link>
                  <Link href={`/workflows/${contestName(e.slug, 'ltx')}`}>Generate with LTX · local app</Link>
                  <details><summary>Workflow files and synthetic preview</summary>
                    <p>These bundled previews use synthetic fixtures and supplied masks. They demonstrate the compositor, not LTX or H3 quality.</p>
                    <video src={e.preview} controls preload="none" style={{width:"100%"}} />
                    <a href={`/workflows/contest-lab/${e.reuse}`} download>Reuse-video JSON</a>{' · '}
                    <a href={`/workflows/contest-lab/${e.ltx}`} download>LTX JSON</a>
                    {!openOnly && <p><a href={`/workflows/contest-lab/${e.h3}`} download>H3 JSON · paid API, generation switch OFF</a></p>}
                  </details>
                </HaggsCard>)}
              </div>
              <p><a href="/workflows/contest-lab/Haggs-ComfyUI-Contest-Lab-ALL.zip" download>Download complete node pack</a> · <a href="/workflows/contest-lab/START-HERE.md">Setup, masks and limitations</a> · <a href="/workflows/contest-lab/workflows/08-SAM2-tracked-mask-helper.json" download>SAM2 mask helper (optional model download)</a> · <a href="/workflows/contest-lab/LICENSE">License</a></p>
            </section>
          )}

          {haggs && games.length > 0 && (
            <section className="quick" id="haggs-games" aria-label="Game Director workflows">
              <h2>Game Director</h2>
              <p>Preview guides use your connected ComfyUI and the Game Director nodes. They do not generate H3 footage or export atlases in Haggs. The full workflows remain available below.</p>
              <div className="wf-grid">
                {games.map(g => <HaggsCard key={g.slug} title={g.title} image={`/workflows/game-director/${g.slug}-illustrative.webp`} label={GAME_GUIDE_APPS[g.slug] ? "Guide preview · local ComfyUI" : "Workflow download · ComfyUI"} {...(GAME_GUIDE_APPS[g.slug] ? {href:`/workflows/${GAME_GUIDE_APPS[g.slug]}`} : {})}>
                  <HaggsBadge provenance="/workflows/PROVENANCE.md" />
                  <p>{g.scope}</p><p>Exports: {g.output}</p>
                  {/^0[56]-/.test(g.slug) && <Link href="/playable">Import atlas in Playable · free</Link>}
                  <a href={`/workflows/game-director/workflows/preview-no-model/${g.slug}.json`} download>No-model preview JSON · open in ComfyUI</a>
                  <a href={`/workflows/game-director/workflows/H3-local/${g.slug}.json`} download>Local H3 JSON · requires GPU and weights</a>
                  <details><summary>View synthetic guide example</summary>
                    <p>Included deterministic fixture; not an H3 generation result.</p>
                    {g.preview ? <video src={`/workflows/game-director/previews/${g.preview}`} controls preload="none" style={{width:'100%'}} /> : <a href="/workflows/game-director/previews/prepared-branch-player/player.html" target="_blank" rel="noreferrer">Try the synthetic three-choice player</a>}
                  </details>
                </HaggsCard>)}
              </div>
              <p><a href="/workflows/game-director/Haggs-ComfyUI-H3-Game-Director-Six-Workflows.zip" download>Download complete Game Director pack</a> · <a href="/workflows/game-director/START-HERE.md">Setup and dependencies</a> · <a href="/workflows/game-director/PLAYABLE-ASSESSMENT.md">Playable integration assessment</a> · <a href="/workflows/game-director/LICENSE">License</a></p>
            </section>
          )}

          {haggs && studio.length > 0 && (
            <section className="quick" id="haggs-studio" aria-label="World motion and VFX workflows">
              <h2>World, motion and directed VFX</h2>
              <p>Ten experimental ComfyUI downloads in three toolsets. Install the supplied HaggsStudio nodes and configure the required models or services. Live ComfyUI and GPU generation remain unverified.</p>
              <div className="wf-grid">
                {studio.map(w => <HaggsCard key={w.slug} title={w.title} image={`/workflows/world-motion-vfx/${w.slug}-illustrative.webp`} label={w.slug === 'vfx' ? 'Mask preview · local ComfyUI' : 'Toolset · ComfyUI'} {...(w.slug === 'vfx' ? {href:'/workflows/haggs_preview_vfx_mask'} : {})}>
                  <HaggsBadge provenance="/workflows/PROVENANCE.md" />
                  <p>{w.scope}</p><p>{w.limits}</p>
                  {w.slug === 'vfx' && <p><Link href="/workflows/haggs_preview_vfx_mask">Open mask preview app</Link> · <Link href="/workflows/haggs_preview_vfx_reuse">Open combine-takes app</Link></p>}
                  <details><summary>Workflow downloads and supplied preview</summary>
                    <p>Deterministic proxy or synthetic fixture; not a neural generation result.</p>
                    <video src={`/workflows/world-motion-vfx/previews/${w.preview}`} controls preload="none" style={{width:'100%'}} />
                    {w.files.map(file => <p key={file}><a href={`/workflows/world-motion-vfx/workflows/${file}.json`} download>{file.replaceAll('-', ' ')} · JSON</a></p>)}
                  </details>
                </HaggsCard>)}
              </div>
              <p><a href="/workflows/world-motion-vfx/Haggs-ComfyUI-Playable-World-Motion-LTX-VFX.zip" download>Download complete HaggsStudio pack</a> · <a href="/workflows/world-motion-vfx/INTEGRATION.md">Verification and integration limits</a> · <a href="/workflows/world-motion-vfx/START-HERE.md">Setup and dependencies</a> · <a href="/workflows/world-motion-vfx/LICENSE">License</a></p>
            </section>
          )}

          {!hunt && (tab === "Quick start" || onlyFavorites) && (
            <section className="quick" aria-label="Ready-made apps">
              {openOnly && <p className="wf-note">Open weights only is on: these are the apps that run without any partner model. Library workflows that call one are refused when you run them.</p>}
              {!openOnly && <div className="quick-tabs" role="tablist" aria-label="Kind of job">
                {GROUPS.map((g) => (
                  <button key={g} role="tab" aria-selected={group === g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>{g}</button>
                ))}
              </div>}
              <div className="quick-row">
                {QUICK_APPS.filter((a) => openOnly ? isOpenApp(a) && (!onlyFavorites || favorites.includes(`quick:${a.id}`)) : onlyFavorites ? favorites.includes(`quick:${a.id}`) : a.group === group).map((a) => (
                  <div key={a.id} className="wf-favorite-card"><Link className="quick-card pic" href={`/workflows/build?quick=${a.id}`}>
                    <span className="qc-pic" style={{ backgroundImage: `url(/quick/${a.id}.webp)` }} role="img" aria-label={`A sample of ${a.name}`} />
                    <b>{a.name}</b>
                    <span>{a.says}</span>
                    <small className={isOpenApp(a) ? "qc-open" : undefined}>{isOpenApp(a) ? "Open weights" : a.makes === "video" ? "Video" : "Picture"}</small>
                  </Link><Favorite name={a.name} active={favorites.includes(`quick:${a.id}`)} disabled={!favoriteReady} onClick={()=>toggleFavorite(`quick:${a.id}`)}/></div>
                ))}
                {!openOnly && !onlyFavorites && group === "Swap and faces" && (
                  <Link className="quick-card swap pic" href="/swap">
                    <span className="qc-pic" style={{ backgroundImage: `url(${SWAP_THUMB})` }} role="img" aria-label="A sample of swapping a character" />
                    <b>Swap a character</b>
                    <span>Drop a video and a picture, say who to replace. The scene, camera and sound stay.</span>
                    <small>Video</small>
                  </Link>
                )}
              </div>
            </section>
          )}

          {!hunt && (tab === "Quick start" || onlyFavorites) && mine.length > 0 && (
            <section className="wf-mine" id="your-apps" aria-label="Your apps">
              <h2>Your apps</h2>
              <div className="squares-grid">
                {mine.filter(a=>!onlyFavorites||favorites.includes(`app:${a.id}`)).map((a) => (
                  <div key={a.id} className="wf-favorite-card"><Link className={`square${a.cover ? "" : " bare"}`} href={`/workflows/mine?id=${a.id}`}>
                    {a.cover && (a.cover.kind === "video" ? <video src={a.cover.url} muted loop autoPlay playsInline /> : <img src={a.cover.url} alt="" />)}
                    <span className="square-tag">{a.recipe ? "Built here" : "Your app"}</span>
                    <span className="square-face"><b>{a.name}</b>{a.description && <small>{a.description}</small>}</span>
                  </Link><Favorite name={a.name} active={favorites.includes(`app:${a.id}`)} disabled={!favoriteReady} onClick={()=>toggleFavorite(`app:${a.id}`)}/></div>
                ))}
              </div>
            </section>
          )}

          {!haggs && listing?.needsKey && (
            <p className="wf-note">Add a Comfy key to see which of these run on your account. <button className="plain" onClick={() => openKeys()}>Add a key</button></p>
          )}
          {!haggs && listing && !listing.checked && !listing.needsKey && <p className="wf-note" role="status">Checking which workflows run on Comfy Cloud. This takes a minute the first time.</p>}

          {haggs || (!hunt && tab === "Quick start" && !onlyFavorites) ? null : !listing ? (
            <div className="wf-grid">{Array.from({ length: 12 }, (_, i) => <div key={i} className="wf-tile ghost" />)}</div>
          ) : !shown.length ? (
            <p className="wf-note">{onlyFavorites ? "No additional library workflows saved. Favorite a workflow in a category to add it here." : `Nothing matches “${hunt}”. Try a model name, or what you want to make.`}</p>
          ) : (
            <div className="wf-grid">
              {shown.map((e) => (
                <div key={e.name} className="wf-favorite-card"><Link className="wf-tile" href={`/workflows/${encodeURIComponent(e.name)}`}>
                  <img src={e.thumb} alt="" loading="lazy" />
                  <span className="wf-tile-face">
                    <b>{e.title}</b>
                    <small>{(ltxWorkflow(e.name) || contestVariant(e.name)) ? "Illustrative example · runtime required" : [...e.models.slice(0, 2), e.inputs.length ? `${e.inputs.length} input${e.inputs.length === 1 ? "" : "s"}` : "from words"].join(" · ")}</small>
                  </span>
                </Link><Favorite name={e.title} active={favorites.includes(e.name)} disabled={!favoriteReady} onClick={()=>toggleFavorite(e.name)}/></div>
              ))}
            </div>
          )}
          <p className="wf-credit">Cloud library workflows and example results from Comfy&rsquo;s <a href="https://github.com/Comfy-Org/workflow_templates" target="_blank" rel="noreferrer">workflow templates</a> (MIT). Bundled LTX workflows retain their separate licenses above; their sample boards are illustrative.</p>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
