"use client";

import Link from "next/link";
import styles from "../studio-polish.module.css";
import { RUNS_SYNCED } from "../run-sync";
import { useRouter } from "next/navigation";
import { ALL, UNFILED, cleanFolder, folderNames, inFolder } from "../../story/gallery-folders";
import { searchRuns } from "../../story/gallery-search";
import { GROUP_BY, autoFolder, groupRuns, type GroupBy } from "../../story/gallery-groups";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getModelCard } from "../../catalog/models";

import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { soundsInProjects } from "../../story/sound-backfill";
import { createRunStore, isPicture, type PictureRun, type Run } from "../../story/runs";
import { Workspace } from "../workspace";
import { Nav } from "../nav";
import { useStartProject } from "../start-project";
import { RecoverPanel } from "./recover-panel";
import { ScriptShelf } from "./scripts";
import { RunTile } from "../run-tile";
import { ShareToExplore } from "../explore/share";
import { SaveToProject } from "../save-to-project";
import { SiteFooter } from "../site-footer";
import { totalText } from "../../story/price-text";

const SCOPES = ["All", "Images", "Video", "Sounds", "Scripts", "Kept"] as const;
type Scope = (typeof SCOPES)[number];

function inScope(run: Run, scope: Scope): boolean {
  if (scope === "Images") return run.kind === "image";
  if (scope === "Video") return run.kind === "video";
  if (scope === "Sounds") return run.kind === "audio";
  if (scope === "Kept") return run.favorite === true;
  if (scope === "Scripts") return false;
  return true;
}

/** What an empty scope should say. An empty screen is somewhere to start. */
const EMPTY: Record<Scope, { head: string; body: string }> = {
  All: {
    head: "No creations yet.",
    body: "Your finished images, videos and audio appear here. Open one to reuse it or start an edit.",
  },
  Images: {
    head: "No images yet.",
    body: "Make an image in Photos, then return here to organize or reuse it.",
  },
  Video: {
    head: "No video yet.",
    body: "Video has its own models, each with the duration and audio settings it actually accepts.",
  },
  Sounds: {
    head: "No sounds yet.",
    body: "Voice lines, sound effects and music you make or add in the editor land here, ready to play and download.",
  },
  Scripts: {
    head: "No scripts yet.",
    body: "Scripts you write, upload or lay out appear here, one card a project.",
  },
  Kept: {
    head: "Nothing kept yet.",
    body: "Star a run and it stays for good — kept runs are never dropped to make room.",
  },
};

/** Where a run was made, so Reuse lands on the surface that can run it again. */
const SURFACE_PATH: Record<string, string> = {
  "text-to-image": "/photos",
  "image-edit": "/edit",
  "text-to-video": "/video",
  "image-to-video": "/video",
};

export const REUSE_KEY = "haggs:reuse";

export function Gallery() {
  const router = useRouter();
  const runs = useMemo(() => createRunStore(defaultKv()), []);
  const [all, setAll] = useState<Run[]>([]);
  const [saving, setSaving] = useState<PictureRun | null>(null);
  const startProject = useStartProject();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);
  const preview = all.find((run) => run.id === previewId);
  useEffect(() => { if (previewId && previewRef.current && !previewRef.current.open) previewRef.current.showModal(); }, [previewId]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"grid" | "workspace">("grid");
  useEffect(() => { try { if (sessionStorage.getItem("haggs:gallery:view") === "workspace") setView("workspace"); } catch {} }, []);
  const [scope, setScope] = useState<Scope>("All");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string>(ALL);
  const [error, setError] = useState<string | null>(null);

  const [finding, setFinding] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("Folder");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [recoverOpen, setRecoverOpen] = useState(false);

  /** Sounds the projects already hold (voice lines, effects, music) that the Gallery hasn't listed. */
  const findSounds = useCallback(async (quiet = false) => {
    if (!quiet) setFinding("Looking…");
    try {
      const kv = defaultKv();
      const store = createProjectStore(kv);
      const full = (await Promise.all((await store.list()).map((p) => store.load(p.id)))).filter((p): p is NonNullable<typeof p> => Boolean(p));
      const have = new Set((await runs.list()).map((r) => r.url));
      const fresh = soundsInProjects(full).filter((r) => !have.has(r.url));
      for (const r of fresh.reverse()) await runs.record(r);
      setAll(await runs.list());
      if (!quiet) setFinding(fresh.length ? `Added ${fresh.length} sound${fresh.length === 1 ? "" : "s"} from your projects.` : "No new sounds in your projects.");
      await kv.set("gallery/sounds-found", true);
    } catch {
      if (!quiet) setFinding("The projects couldn't be read.");
    }
  }, [runs]);

  useEffect(() => {
    // The first time the Gallery opens, the sounds already in your projects come in.
    void defaultKv().get<boolean>("gallery/sounds-found").then((done) => { if (!done) void findSounds(true); });
  }, [findSounds]);

  useEffect(() => {
    runs
      .list()
      .then(setAll)
      .catch(() => setError("Storage is unavailable in this browser, so runs can't be kept here."))
      .finally(() => setReady(true));
    // Runs that arrive from your account while the Gallery is open.
    const again = () => void runs.list().then(setAll).catch(() => undefined);
    window.addEventListener(RUNS_SYNCED, again);
    return () => window.removeEventListener(RUNS_SYNCED, again);
  }, [runs]);

  const folders = useMemo(() => folderNames(all), [all]);
  const unfiled = useMemo(() => all.filter((r) => inFolder(r, UNFILED)), [all]);
  const shown = useMemo(() => searchRuns(all.filter((run) => inScope(run, scope) && inFolder(run, folder)), query), [all, scope, query, folder]);

  /* The total is the point of the view. A studio that bills in credits cannot
     show you this number, because credits are not worth the same to two people. */
  const spendText = useMemo(() => totalText(shown.map((run) => run.usd ?? 0)), [shown]);
  const sections = useMemo(() => groupRuns(shown, groupBy), [shown, groupBy]);
  const unpriced = shown.filter((run) => run.usd === null).length;

  /** Files a run in a folder (a new name makes one), or takes it out with null. */
  const file = useCallback(
    async (run: Run, name: string | null) => {
      const next = name === null ? null : cleanFolder(name);
      setAll((prior) => prior.map((r) => {
        if (r.id !== run.id) return r;
        const { folder: _gone, ...rest } = r;
        return next ? { ...rest, folder: next } : rest;
      }));
      await runs.setFolder(run.id, next);
    },
    [runs],
  );

  const keep = useCallback(
    async (run: Run) => {
      const next = !run.favorite;
      setAll((prior) => prior.map((r) => (r.id === run.id ? { ...r, favorite: next } : r)));
      await runs.setFavorite(run.id, next);
    },
    [runs],
  );

  /** Files every unfiled run in a folder named for what it is and what made it. Asks first; filed runs are left alone. */
  const organise = useCallback(async () => {
    if (!unfiled.length) return;
    if (!window.confirm(`File ${unfiled.length} run${unfiled.length === 1 ? "" : "s"} into folders by kind and model, like “Video · Kling 3”? Runs already in a folder stay where they are.`)) return;
    for (const run of unfiled) await file(run, autoFolder(run));
  }, [unfiled, file]);

  /* Handing the run id through sessionStorage rather than the URL keeps the
     composer's address clean and survives the client-side navigation. */
  const reuse = useCallback(
    (run: Run) => {
      try {
        sessionStorage.setItem(REUSE_KEY, run.id);
      } catch {
        setError("This item could not be passed to the composer. Your media is unchanged; retry or download it."); return;
      }
      let path = run.kind === "video" ? "/video" : "/photos";
      try {
        path = SURFACE_PATH[getModelCard(run.modelId).capability] ?? path;
      } catch {
        /* A run made with a model no longer in the catalog still opens Create. */
      }
      router.push(path);
    },
    [router],
  );

  const drop = useCallback(
    async (run: Run) => {
      setAll((prior) => prior.filter((r) => r.id !== run.id));
      await runs.remove(run.id);
    },
    [runs],
  );

  const renderRun = (run: Run, previewable = true) => (
                <div key={run.id} className="gallery-item">
                {previewable && <button className={styles.previewButton} onClick={() => setPreviewId(run.id)}>Open preview <span>{run.kind}</span></button>}
                <RunTile
                  key={run.id}
                  run={run}
                  onFavorite={() => void keep(run)}
                  {...(isPicture(run) ? {onReuse:() => reuse(run)} : {})}
                  onDelete={() => void drop(run)}
                  onSave={isPicture(run) ? () => { previewRef.current?.close(); setPreviewId(null); setSaving(run); } : undefined as never}
                onStart={isPicture(run) ? () => void startProject(run) : undefined as never}
                />
                {isPicture(run) && <ShareToExplore run={run} />}
                {run.kind === "audio" && <p className="wf-small">To use this sound in a project, download it, then <Link href="/editor">open the editor</Link> and add it under Sound.</p>}
                <select className="folder-pick" aria-label="Move to folder" value={run.folder ?? ""} onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new") { const name = window.prompt("Name the new folder"); if (name) void file(run, name); }
                  else void file(run, v || null);
                }}>
                  <option value="">No folder</option>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                  <option value="__new">New folder…</option>
                </select>
                </div>
  );

  return (
    <div className="app">
      <Nav current="Gallery" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}

      {preview && <dialog ref={previewRef} className={styles.preview} aria-labelledby="gallery-preview-title" onClose={() => setPreviewId(null)}>
        <div className={styles.sectionHeading}><div><span className="eyebrow">Your creation</span><h2 id="gallery-preview-title">Preview & choose the next step</h2></div><button className="pill" onClick={() => previewRef.current?.close()} aria-label="Close preview">Close</button></div>
        {renderRun(preview, false)}
      </dialog>}
      <div className="canvas">
        <div className={`gallery gl ${styles.gallery}`}>
          <header className="gl-head">
            <div>
              <span className="eyebrow">Gallery</span><h1>Your work. Its next chapter.</h1>
              <p>Preview your creations, organize them, and take the next step with the ones you love.</p>
            </div>
            <div className="view-toggle" role="tablist" aria-label="Gallery view">{(["grid", "workspace"] as const).map((mode) => <button key={mode} role="tab" aria-selected={view === mode} onClick={() => { setView(mode); try { sessionStorage.setItem("haggs:gallery:view", mode); } catch {} }}>{mode === "grid" ? "Grid" : "Workspace"}</button>)}</div>
          </header>

          {ready && <div className={styles.collectionStats} aria-label="Collection overview">{(["Images", "Video", "Sounds", "Kept"] as const).map((kind) => <button key={kind} aria-pressed={scope === kind} onClick={() => { setScope(kind); setFolder(ALL); setQuery(""); }}><strong>{all.filter((run) => inScope(run, kind)).length}</strong><span>{kind}</span></button>)}</div>}
          <div className="gl-bar">
            <div className="scopes" role="tablist">
              {SCOPES.map((option) => (
                <button key={option} role="tab" className="scope" aria-selected={option === scope} onClick={() => setScope(option)}>{option}</button>
              ))}
            </div>
            <input type="search" className="gallery-search" aria-label="Search your work" placeholder={scope === "Scripts" ? "Search titles, loglines and cast" : "Search prompts and models"} value={query} onChange={(e) => setQuery(e.target.value)} />
            {scope !== "Scripts" && <button className="gl-ghost" onClick={() => void findSounds()}>Find sounds in my projects</button>}
          </div>
          {scope !== "Scripts" && <div className={styles.filterSummary}><span>{ready ? `${shown.length} items shown` : "Loading creations…"} · {folder} · {scope}{ready && ` · ${spendText} recorded cost`}</span>{(query || folder !== ALL || scope !== "All") && <button className="plain" onClick={() => { setQuery(""); setFolder(ALL); setScope("All"); }}>Reset filters</button>}</div>}
          {finding && <p className="gallery-note" role="status">{finding}</p>}

          {unfiled.length > 1 && (
            <div className="gl-banner">
              <span><b>{unfiled.length} runs</b> aren&rsquo;t in any folder. Want them sorted by kind and model?</span>
              <button className="gl-go" onClick={() => void organise()}>Auto-organise</button>
            </div>
          )}

          {unpriced > 0 && (
            <p className="gallery-note">
              Cost is not recorded for {unpriced} of these items. They are excluded from the displayed total.
            </p>
          )}

          {error && <p className="library-error" role="alert">{error}</p>}

          {scope === "Scripts" ? <ScriptShelf query={query} /> : <>
          <div className="gl-tools">
            <span className="eyebrow muted">Group by</span>
            <span className="nav-seg" role="group" aria-label="Group by">
              {GROUP_BY.map((g) => <button key={g} aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>{g}</button>)}
            </span>
            {sections.length > 1 && <button className="ph-link" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(sections.map((x) => x.name)))}>{collapsed.size ? "Open all" : "Collapse all"}</button>}
          </div>

          <div className="gl-body">
            <aside className="gl-rail" aria-label="Folders">
              <span className="eyebrow muted">Folders</span>
              {[ALL, UNFILED, ...folders].map((name) => {
                const n = name === ALL ? all.length : all.filter((r) => inFolder(r, name)).length;
                return <button key={name} className="gl-folder" aria-pressed={name === folder} onClick={() => setFolder(name)}><span>{name}</span><i>{n}</i></button>;
              })}
              <p className="gl-rail-note">A folder appears when you file a run in it, from the menu under each run.</p>
              <button className="gl-ghost" onClick={() => setRecoverOpen((v) => !v)}>Recover lost runs</button>
            </aside>

            <div className="gl-main">
              {recoverOpen && (
                <div className="gl-recover">
                  <RecoverPanel runs={runs} added={new Set(all.map((r) => r.comfyJob).filter((x): x is string => Boolean(x)))} onAdded={() => void runs.list().then(setAll)} />
                </div>
              )}
          {!ready ? null : view === "workspace" ? <Workspace onBack={()=>{setView("grid");try{sessionStorage.setItem("haggs:gallery:view","grid");}catch{}}} storeKey="workspace/Gallery" items={all.map((run) => ({ id: run.id, src: run.url, kind: run.kind, title: run.prompt }))} visibleIds={shown.map((run) => run.id)} renderItem={(item) => { const run = all.find((r) => r.id === item.id); return run ? renderRun(run) : null; }} /> : shown.length === 0 ? (
                query.trim() && all.length > 0 ? (
                  <div className="library-blank">
                    <p>Nothing matches “{query.trim()}”.</p>
                    <p className="library-blank-sub">Try fewer words, or search a model name such as FLUX or Veo.</p><button className="pill" onClick={()=>setQuery("")}>Clear search</button>
                  </div>
                ) : (
                  <div className="library-blank">
                    <p>{EMPTY[scope].head}</p>
                    <p className="library-blank-sub">{EMPTY[scope].body}</p>
                    <div className="cm-row"><Link className="pill" href={scope==="Video"?"/video":scope==="Sounds"?"/editor":"/photos"}>{scope==="Video"?"Make a video":scope==="Sounds"?"Open editor for audio":"Make an image"}</Link>{scope==="Kept"&&<button className="pill" onClick={()=>setScope("All")}>Show all creations</button>}</div>
                  </div>
                )
              ) : (
                <>
                  {sections.map((section) => {
                    const closed = collapsed.has(section.name);
                    return (
                      <section key={section.name} className="gl-section">
                        <button className="gl-section-head" aria-expanded={!closed} onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(section.name)) n.delete(section.name); else n.add(section.name); return n; })}>
                          <span>{closed ? "▸" : "▾"}</span>
                          <b>{section.name}</b>
                          <small>{section.runs.length} item{section.runs.length === 1 ? "" : "s"} · {totalText(section.runs.map((r) => r.usd ?? 0))}</small>
                        </button>
                        {!closed && <div className="grid">{section.runs.map((run) => renderRun(run))}</div>}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          </>}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
