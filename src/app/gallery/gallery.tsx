"use client";

import { RUNS_SYNCED } from "../run-sync";
import { useRouter } from "next/navigation";
import { ALL, UNFILED, cleanFolder, folderNames, inFolder } from "../../story/gallery-folders";
import { searchRuns } from "../../story/gallery-search";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getModelCard } from "../../catalog/models";

import { defaultKv } from "../../story/kv";
import { createProjectStore } from "../../story/store";
import { soundsInProjects } from "../../story/sound-backfill";
import { createRunStore, isPicture, type PictureRun, type Run } from "../../story/runs";
import { Nav } from "../nav";
import { useStartProject } from "../start-project";
import { RecoverPanel } from "./recover-panel";
import { RunTile } from "../run-tile";
import { SaveToProject } from "../save-to-project";
import { SiteFooter } from "../site-footer";

const SCOPES = ["All", "Images", "Video", "Sounds", "Kept"] as const;
type Scope = (typeof SCOPES)[number];

function inScope(run: Run, scope: Scope): boolean {
  if (scope === "Images") return run.kind === "image";
  if (scope === "Video") return run.kind === "video";
  if (scope === "Sounds") return run.kind === "audio";
  if (scope === "Kept") return run.favorite === true;
  return true;
}

/** What an empty scope should say. An empty screen is somewhere to start. */
const EMPTY: Record<Scope, { head: string; body: string }> = {
  All: {
    head: "No runs yet.",
    body: "Finished runs land here with the prompt, the model and what each one cost.",
  },
  Images: {
    head: "No images yet.",
    body: "Make one in Create — the picker shows every model's rate before you pick it.",
  },
  Video: {
    head: "No video yet.",
    body: "Video has its own models, each with the duration and audio settings it actually accepts.",
  },
  Sounds: {
    head: "No sounds yet.",
    body: "Voice lines, sound effects and music you make or add in the editor land here, ready to play and download.",
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
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState<Scope>("All");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string>(ALL);
  const [error, setError] = useState<string | null>(null);

  const [finding, setFinding] = useState<string | null>(null);

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
  const shown = useMemo(() => searchRuns(all.filter((run) => inScope(run, scope) && inFolder(run, folder)), query), [all, scope, query, folder]);

  /* The total is the point of the view. A studio that bills in credits cannot
     show you this number, because credits are not worth the same to two people. */
  const spend = useMemo(
    () => shown.reduce((sum, run) => sum + (run.usd ?? 0), 0),
    [shown],
  );
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

  /* Handing the run id through sessionStorage rather than the URL keeps the
     composer's address clean and survives the client-side navigation. */
  const reuse = useCallback(
    (run: Run) => {
      try {
        sessionStorage.setItem(REUSE_KEY, run.id);
      } catch {
        /* Private mode blocks it; the navigation below still gets you there. */
      }
      let path = "/";
      try {
        path = SURFACE_PATH[getModelCard(run.modelId).capability] ?? "/";
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

  return (
    <div className="app">
      <Nav current="Gallery" />
      {saving && <SaveToProject run={saving} onClose={() => setSaving(null)} />}

      <div className="canvas">
        <div className="gallery">
          <header className="gallery-head">
            <h1>Gallery</h1>
            <div className="scopes" role="tablist">
              {SCOPES.map((option) => (
                <button
                  key={option}
                  role="tab"
                  className="scope"
                  aria-selected={option === scope}
                  onClick={() => setScope(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <input type="search" className="gallery-search" aria-label="Search your work" placeholder="Search prompts, models, settings" value={query} onChange={(e) => setQuery(e.target.value)} />
            <dl className="tally">
              <dt>Runs</dt>
              <dd>{shown.length}</dd>
              <dt>Spent</dt>
              <dd className="tally-spend">${spend.toFixed(3)}</dd>
            </dl>
          </header>

          {(folders.length > 0 || folder !== ALL) && (
            <div className="scopes folder-row" role="tablist" aria-label="Folders">
              {[ALL, ...folders, UNFILED].map((name) => (
                <button key={name} role="tab" className="scope" aria-selected={name === folder} onClick={() => setFolder(name)}>{name}</button>
              ))}
            </div>
          )}

          {scope === "Sounds" && (
            <p className="gallery-note">
              <button className="plain" onClick={() => void findSounds()}>Find sounds in my projects</button> {finding ?? "Voice lines, effects and soundtracks from every project."}
            </p>
          )}

          <details className="rc-details">
            <summary>Bring back earlier renders from Comfy</summary>
            <RecoverPanel runs={runs} added={new Set(all.map((r) => r.comfyJob).filter((x): x is string => Boolean(x)))} onAdded={() => void runs.list().then(setAll)} />
          </details>

          {unpriced > 0 && (
            <p className="gallery-note">
              {unpriced} of these ran on a rate the provider quotes per second or
              megapixel, so they are not in the total.
            </p>
          )}

          {error && <p className="library-error" role="alert">{error}</p>}

          {!ready ? null : shown.length === 0 ? (
            query.trim() && all.length > 0 ? (
              <div className="library-blank">
                <p>Nothing matches “{query.trim()}”.</p>
                <p className="library-blank-sub">Try fewer words, or search a model name such as FLUX or Veo.</p>
              </div>
            ) : (
              <div className="library-blank">
                <p>{EMPTY[scope].head}</p>
                <p className="library-blank-sub">{EMPTY[scope].body}</p>
              </div>
            )
          ) : (
            <div className="grid">
              {shown.map((run) => (
                <div key={run.id} className="gallery-item">
                <RunTile
                  key={run.id}
                  run={run}
                  onFavorite={() => void keep(run)}
                  onReuse={() => reuse(run)}
                  onDelete={() => void drop(run)}
                  onSave={isPicture(run) ? () => setSaving(run) : undefined as never}
                onStart={isPicture(run) ? () => void startProject(run) : undefined as never}
                />
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
              ))}
            </div>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
