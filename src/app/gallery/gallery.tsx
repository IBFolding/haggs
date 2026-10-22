"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getModelCard } from "../../catalog/models";

import { defaultKv } from "../../story/kv";
import { createRunStore, type Run } from "../../story/runs";
import { Nav } from "../nav";
import { RunTile } from "../run-tile";
import { SaveToProject } from "../save-to-project";

const SCOPES = ["All", "Images", "Video", "Kept"] as const;
type Scope = (typeof SCOPES)[number];

function inScope(run: Run, scope: Scope): boolean {
  if (scope === "Images") return run.kind === "image";
  if (scope === "Video") return run.kind === "video";
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
  Kept: {
    head: "Nothing kept yet.",
    body: "Star a run and it stays for good — kept runs are never dropped to make room.",
  },
};

/** Where a run was made, so Reuse lands on the surface that can run it again. */
const SURFACE_PATH: Record<string, string> = {
  "text-to-image": "/",
  "image-edit": "/edit",
  "text-to-video": "/video",
  "image-to-video": "/video",
};

export const REUSE_KEY = "haggs:reuse";

export function Gallery() {
  const router = useRouter();
  const runs = useMemo(() => createRunStore(defaultKv()), []);
  const [all, setAll] = useState<Run[]>([]);
  const [saving, setSaving] = useState<Run | null>(null);
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState<Scope>("All");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runs
      .list()
      .then(setAll)
      .catch(() => setError("Storage is unavailable in this browser, so runs can't be kept here."))
      .finally(() => setReady(true));
  }, [runs]);

  const shown = useMemo(() => all.filter((run) => inScope(run, scope)), [all, scope]);

  /* The total is the point of the view. A studio that bills in credits cannot
     show you this number, because credits are not worth the same to two people. */
  const spend = useMemo(
    () => shown.reduce((sum, run) => sum + (run.usd ?? 0), 0),
    [shown],
  );
  const unpriced = shown.filter((run) => run.usd === null).length;

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
            <dl className="tally">
              <dt>Runs</dt>
              <dd>{shown.length}</dd>
              <dt>Spent</dt>
              <dd className="tally-spend">${spend.toFixed(3)}</dd>
            </dl>
          </header>

          {unpriced > 0 && (
            <p className="gallery-note">
              {unpriced} of these ran on a rate the provider quotes per second or
              megapixel, so they are not in the total.
            </p>
          )}

          {error && <p className="library-error" role="alert">{error}</p>}

          {!ready ? null : shown.length === 0 ? (
            <div className="library-blank">
              <p>{EMPTY[scope].head}</p>
              <p className="library-blank-sub">{EMPTY[scope].body}</p>
            </div>
          ) : (
            <div className="grid">
              {shown.map((run) => (
                <RunTile
                  key={run.id}
                  run={run}
                  onFavorite={() => void keep(run)}
                  onReuse={() => reuse(run)}
                  onDelete={() => void drop(run)}
                  onSave={() => setSaving(run)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
