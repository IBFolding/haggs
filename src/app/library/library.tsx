"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../../story/kv";
import { createProject, type ProjectSummary } from "../../story/model";
import { createProjectStore } from "../../story/store";
import { exportSheets, importSheets } from "../../sheets/sheets";
import { TransferError, exportProject, importBundle } from "../../story/transfer";
import { backupsToOffer, toRestore, type OnDisk } from "../../story/restore";
import { Nav } from "../nav";

function ago(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function Library() {
  const router = useRouter();
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await store.list());
    } catch {
      // Storage can be unavailable outright — blocked site data, a private
      // window. Say so; without this the page sits on its loading state
      // forever, showing nothing and explaining nothing.
      setError("Storage is unavailable in this browser, so projects can't be saved here.");
    } finally {
      setReady(true);
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // In development the app keeps a copy of every project on disk. If the browser has started over, offer those back.
  const [backups, setBackups] = useState<OnDisk[]>([]);
  useEffect(() => {
    if (!ready || process.env.NODE_ENV === "production") return;
    void fetch("/api/bridge/snapshot")
      .then((r) => r.json() as Promise<{ items?: OnDisk[] }>)
      .then((b) => setBackups(backupsToOffer(projects, b.items ?? [])))
      .catch(() => undefined);
  }, [ready, projects]);

  const restore = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/bridge/snapshot?id=${encodeURIComponent(id)}`);
        const body = (await res.json()) as { snapshot?: Parameters<typeof toRestore>[0] };
        const { project, sheets } = toRestore(body.snapshot!);
        await store.save(project);
        if (sheets) await kv.set(`sheets/${project.id}`, exportSheets(sheets));
        await refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That backup couldn't be restored.");
      }
    },
    [store, kv, refresh],
  );

  const create = useCallback(async () => {
    const project = createProject("Untitled");
    await store.save(project);
    router.push(`/board/${project.id}/sheets`);
  }, [store, router]);

  const commitRename = useCallback(async () => {
    const id = editing;
    if (!id) return;
    const name = draft.trim();
    setEditing(null);
    if (!name) return;

    const project = await store.load(id);
    if (!project || project.name === name) return;
    await store.save({ ...project, name });
    await refresh();
  }, [editing, draft, store, refresh]);

  const destroy = useCallback(
    async (summary: ProjectSummary) => {
      // Deletion has no undo in this step, so it asks first.
      if (!window.confirm(`Delete “${summary.name}”? This can't be undone.`)) return;
      await store.remove(summary.id);
      await refresh();
    },
    [store, refresh],
  );

  const download = useCallback(
    async (summary: ProjectSummary) => {
      const project = await store.load(summary.id);
      if (!project) return;

      const raw = await kv.get<string>(`sheets/${project.id}`);
      let sheets;
      try {
        sheets = raw ? importSheets(raw) : undefined;
      } catch {
        sheets = undefined;
      }
      const blob = new Blob([exportProject(project, sheets)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/[^\w.-]+/g, "-") || "project"}.haggs.json`;

      // The anchor has to be in the document for the click to count in Firefox,
      // and the object URL has to outlive the click — revoking on the same tick
      // can cancel the download before the browser has read the blob.
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    [kv, store],
  );

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const bundle = importBundle(await file.text());
        let project = bundle.project;
        const { sheets } = bundle;
        if (project.importKey) {
          const all = await Promise.all((await store.list()).map((s) => store.load(s.id)));
          const earlier = all.find((p) => p?.importKey === project.importKey);
          if (
            earlier &&
            window.confirm(
              `Replace “${earlier.name}” with this file? OK replaces it, including its sheets. Cancel keeps both.`,
            )
          ) {
            project = { ...project, id: earlier.id, createdAt: earlier.createdAt };
          }
        }
        await store.save(project);
        // A project file can carry its script sheets; they belong to the new project's id.
        if (sheets) await kv.set(`sheets/${project.id}`, exportSheets(sheets));
        await refresh();
      } catch (caught) {
        // TransferError messages are written to be read by a person; anything
        // else is a surprise and says so rather than pretending to explain.
        setError(
          caught instanceof TransferError
            ? caught.message
            : "That file couldn't be read.",
        );
      }
    },
    [kv, store, refresh],
  );

  return (
    <div className="app">
      <Nav current="Projects" />

      <div className="canvas">
        <div className="library">
          <div className="library-head">
            <h1>Projects</h1>
            <button className="fire" onClick={() => void create()}>
              New project
            </button>
            <button className="pill" onClick={() => fileInput.current?.click()}>
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset first, so picking the same file twice still fires.
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>

          {backups.length > 0 && (
            <div className="inbox" role="region" aria-label="Saved on disk">
              {backups.map((b) => (
                <div key={b.id} className="inbox-item">
                  <span className="inbox-from">On this machine</span>
                  <p><b>{b.name}</b> is saved on disk ({b.shots} shots, {b.boards} boards) but isn&rsquo;t in this browser. Restore it?</p>
                  <button className="pill on" onClick={() => void restore(b.id)}>Restore</button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="library-error" role="alert">
              {error}
            </p>
          )}

          {!ready ? null : projects.length === 0 ? (
            <div className="library-blank">
              <p>No projects yet.</p>
              <p className="library-blank-sub">
                A project holds a storyboard — its shots, their order, and the threads
                running through them. Make one, or import a file someone shared.
              </p>
            </div>
          ) : (
            <ul className="library-list">
              {projects.map((summary) => (
                <li key={summary.id} className="library-row">
                  {editing === summary.id ? (
                    <input
                      className="library-rename"
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => void commitRename()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void commitRename();
                        if (event.key === "Escape") setEditing(null);
                      }}
                    />
                  ) : (
                    <Link className="library-name" href={`/board/${summary.id}`}>
                      {summary.name}
                    </Link>
                  )}

                  <span className="library-meta">
                    {summary.shotCount} {summary.shotCount === 1 ? "shot" : "shots"}
                    <i>·</i>
                    {ago(summary.updatedAt)}
                  </span>

                  <span className="library-actions">
                    <button
                      className="plain"
                      onClick={() => {
                        setEditing(summary.id);
                        setDraft(summary.name);
                      }}
                    >
                      Rename
                    </button>
                    <button className="plain" onClick={() => void download(summary)}>
                      Export
                    </button>
                    <button className="plain danger" onClick={() => void destroy(summary)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
