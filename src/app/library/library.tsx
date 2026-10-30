"use client";

import Link from "next/link";
import styles from "../studio-polish.module.css";
import { projectProgress } from "../../story/project-progress";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { defaultKv } from "../../story/kv";
import { coverOf, createProject, type ProjectSummary } from "../../story/model";
import { createProjectStore } from "../../story/store";
import { exportSheets, importSheets } from "../../sheets/sheets";
import { TransferError, exportProject, importBundle } from "../../story/transfer";
import { backupsToOffer, toRestore, type OnDisk } from "../../story/restore";
import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";
import { useStartProject } from "../start-project";
import { uploadFile } from "../upload-client";
import { QUICK_APPS } from "../../comfy/quick";

/** The kinds of show the idea card can start, each a real format on the Sheets start screen. */
const STARTS = [
  { label: "Short video", format: "vertical-comedy", note: "A short video, one idea, under a minute." },
  { label: "Influencer", format: "vertical-comedy", note: "An influencer-style video in the creator's own voice: routine, outfit, a place they love, a small confession, a sign-off with a hook." },
  { label: "Series", format: "vertical-drama", note: "Episode one of a series, ending on a reason to watch the next." },
  { label: "Trailer", format: "sizzle-120", note: "A trailer." },
  { label: "Ad", format: "sizzle-120", note: "An ad: the hook, the product as the hero shot, a quick demo, proof, then the offer and a call to action." },
] as const;

/** Pictures you can start from without making one first. */
const SAMPLE_PHOTOS = [
  { src: "/samples/portrait.jpg", says: "A portrait by a window" },
  { src: "/showcase/outfit-1.jpg", says: "An outfit on the street" },
  { src: "/samples/street.jpg", says: "A city street at night" },
];

/** Three of Playable's featured games, by their cover pictures. */
const PLAYABLE_SAMPLES = [
  { src: "/playable/covers/sprout-swarm.webp", title: "Sprout Swarm" },
  { src: "/playable/covers/noodle-patch.webp", title: "Noodle Patch" },
  { src: "/playable/covers/bramble-run.webp", title: "Bramble Run" },
];

const HIDE_SAMPLE = "haggs.home.hide-sample";

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
  const [projectQuery, setProjectQuery] = useState("");
  const [startKind, setStartKind] = useState("Idea");
  const [progress, setProgress] = useState<Record<string, ReturnType<typeof projectProgress>>>({});
  const visibleProjects = projects.filter((p) => p.name.toLowerCase().includes(projectQuery.trim().toLowerCase()));
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

  // Projects saved before thumbnails existed get theirs read from the project itself, a few at a time.
  const [covers, setCovers] = useState<Record<string, NonNullable<ProjectSummary["cover"]>>>({});
  useEffect(() => {
    let live = true;
    void (async () => {
      for (const summary of projects.filter((x) => !x.cover && !covers[x.id]).slice(0, 30)) {
        const project = await store.load(summary.id).catch(() => undefined);
        const cover = project ? coverOf(project) : undefined;
        if (!live) return;
        if (cover) setCovers((held) => ({ ...held, [summary.id]: cover }));
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, store]);

  useEffect(() => {
    let active = true;
    void Promise.all(projects.map(async (summary) => {
      const project = await store.load(summary.id).catch(() => undefined);
      return project ? [summary.id, projectProgress(project)] as const : null;
    })).then((items) => { if (active) setProgress(Object.fromEntries(items.filter((item) => item !== null))); });
    return () => { active = false; };
  }, [projects, store]);

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

  const startFrom = useStartProject();
  const [idea, setIdea] = useState("");
  const [goal, setGoal] = useState<string>("Trailer");
  const [busy, setBusy] = useState<string | null>(null);
  const [sampleHidden, setSampleHidden] = useState(false);
  useEffect(() => {
    try { setSampleHidden(localStorage.getItem(HIDE_SAMPLE) === "1"); } catch { /* a convenience only */ }
  }, []);
  const hideSample = (hide: boolean) => {
    setSampleHidden(hide);
    try { if (hide) localStorage.setItem(HIDE_SAMPLE, "1"); else localStorage.removeItem(HIDE_SAMPLE); } catch { /* a convenience only */ }
  };

  /** A new project whose Sheets open on the start screen with this idea and format already filled in. */
  const startIdea = useCallback(async () => {
    const start = STARTS.find((s) => s.label === goal) ?? STARTS[3];
    const project = createProject((idea.trim() || start.label).replace(/\s+/g, " ").slice(0, 40));
    await store.save(project);
    // The kind of video becomes the Sheets format and a note for the writer; the idea is yours.
    await kv.set(`project-start:/board/${project.id}?b=main`, { formatId: start.format, idea: idea.trim(), notes: start.note, title: "", assets: [] });
    router.push(`/board/${project.id}/sheets`);
  }, [idea, goal, store, kv, router]);

  /** A project whose first shot is this picture. */
  const startPhoto = useCallback(async (url: string, says: string) => {
    await startFrom({ id: crypto.randomUUID(), modelId: "upload", modelName: "Your photo", prompt: says, settings: {}, url, kind: "image", usd: null, at: Date.now() });
  }, [startFrom]);

  const uploadPhoto = useCallback(async (file: File) => {
    setBusy("photo");
    setError(null);
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok) return setError(r.reason);
    if (r.kind !== "image") return setError("Pick a picture to start from.");
    await startPhoto(r.url, file.name.replace(/\.[^.]+$/, ""));
  }, [startPhoto]);

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
        <div className={`library ${styles.projects}`}>
          <div className="ph-head">
            <span className="eyebrow">Your projects</span>
            <h1>Keep your story moving.</h1>
            <p>Pick up a project, or choose a starting point for something new.</p>
          </div>

          <div className="ph-continue">
            <div><span className="eyebrow">Your work</span><h2>Pick up where you left off.</h2></div>
            <button className="ph-link" onClick={() => fileInput.current?.click()}>Import a project file</button>
          </div>
          {projects.length > 0 && <input className={styles.search} type="search" aria-label="Search projects" placeholder="Find a project by name" value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} />}
          {!ready ? <p role="status">Loading your projects…</p> : projects.length === 0 ? (
            <p className="ph-small">Your projects will appear here as you work. Choose a starting point below, or import a project you already have.</p>
          ) : (
            <ul className="ph-projects">
              {visibleProjects.map((summary) => {
                const status = progress[summary.id];
                const found = summary.cover ?? covers[summary.id];
                // On the live site a file that still lives only on your computer can't play yet; show the letter until it has been copied.
                const cover = found && !(process.env.NEXT_PUBLIC_HOSTED && found.url.startsWith("/api/local/")) ? found : undefined;
                return (
                  <li key={summary.id} className="ph-project">
                    <Link className="ph-cover" href={`/board/${summary.id}`} tabIndex={-1} aria-hidden>
                      {!cover ? <span>{summary.name.slice(0, 1).toUpperCase() || "·"}</span> : cover.kind === "video" ? <video src={`${cover.url}#t=0.5`} muted playsInline preload="metadata" /> : <img src={cover.url} alt="" loading="lazy" />}
                    </Link>
                    <button className="ph-x" title={`Delete ${summary.name}`} aria-label={`Delete ${summary.name}`} onClick={() => void destroy(summary)}>✕</button>
                    <div className="ph-project-body">
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
                        <Link className="ph-name" href={`/board/${summary.id}`}>{summary.name}</Link>
                      )}
                      <span className={styles.badge}>{status?.stage ?? "Project"}</span>
                      <span className="ph-meta">{summary.shotCount} {summary.shotCount === 1 ? "shot" : "shots"} · {ago(summary.updatedAt)}</span>
                      {status && status.total > 0 && <div className={styles.projectProgress}><progress aria-label={`${summary.name}: shots with media`} value={status.visuals} max={status.total} /><small>{status.visuals}/{status.total} shots with media · {status.clips} clips</small></div>}
                      <Link className={styles.nextLink} href={status?.href ?? `/board/${summary.id}`}>{status?.action ?? "Open storyboard"} →</Link>
                      <span className="ph-acts">
                        <button className="ph-link" onClick={() => { setEditing(summary.id); setDraft(summary.name); }}>Rename</button>
                        <button className="ph-link" onClick={() => void download(summary)}>Export</button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {ready && projects.length > 0 && visibleProjects.length === 0 && <p className={styles.empty}>No projects match “{projectQuery}”. <button className="plain" onClick={() => setProjectQuery("")}>Clear search</button></p>}
          <section className={styles.start} aria-label="Start a new project">
          <div className={styles.sectionHeading}><div><span className="eyebrow">Start something new</span><h2>What are you starting with?</h2></div><span>No generation starts here.</span></div>
          <div className={styles.startTabs} role="group" aria-label="Starting point">{["Idea", "Photo", "Reference video", "Workflow", "Game", "Script"].map((kind) => <button key={kind} aria-pressed={startKind === kind} onClick={() => setStartKind(kind)}>{kind}</button>)}</div>
          <div className="ph-grid">
            <section className="ph-card" hidden={startKind !== "Idea"}>
              <span className="eyebrow">From an idea</span>
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="A noir trailer about a night-shift nurse…" rows={3} aria-label="Your idea" />
              <div className="ph-chips" role="group" aria-label="Kind of show">
                {STARTS.map((s) => <button key={s.label} className="ph-chip" aria-pressed={goal === s.label} onClick={() => setGoal(s.label)}>{s.label}</button>)}
              </div>
              <button className="ph-go" onClick={() => void startIdea()}>Open script setup →</button>
            </section>

            <section className="ph-card" hidden={startKind !== "Photo"}>
              <span className="eyebrow">From a photo</span><small className="muted">Sample photos · or upload your own</small>
              <p>Pick one, or make one in Photos. It becomes the first frame.</p>
              <div className="ph-photos">
                {SAMPLE_PHOTOS.map((p) => <button key={p.src} className="ph-photo" style={{ backgroundImage: `url(${p.src})` }} title={`Start from ${p.says.toLowerCase()}`} aria-label={`Start from ${p.says.toLowerCase()}`} onClick={() => void startPhoto(`${window.location.origin}${p.src}`, p.says)} />)}
              </div>
              <Link className="ph-ghost" href="/photos">Make a photo first →</Link>
              <label className="ph-drop">{busy === "photo" ? "Adding…" : "Upload your own"}<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadPhoto(f); }} /></label>
            </section>

            <section className="ph-card" hidden={startKind !== "Reference video"}>
              <span className="eyebrow">From a video</span>
              <p>Bring a reference video into Recreate. Review its proposed shots before building your own board.</p>
              {sampleHidden ? (
                <p className="ph-small">Sample removed. <button className="ph-link" onClick={() => hideSample(false)}>Bring the sample back</button>.</p>
              ) : (
                <div className="ph-ref">
                  <Link href="/recreate" className="ph-ref-pic" style={{ backgroundImage: "url(/tiles/recreate.jpg)" }}><span>Use a sample reference</span></Link>
                  <button className="ph-x" title="Remove the sample" aria-label="Remove the sample" onClick={() => hideSample(true)}>✕</button>
                </div>
              )}
            </section>

            <section className="ph-card" hidden={startKind !== "Workflow"}>
              <span className="eyebrow">From a workflow</span>
              <p>{QUICK_APPS.length} ready-made apps: swap a person, relight, try on, make an ad. Save the results you want to your project.</p>
              <Link className="ph-ghost" href="/workflows">Browse apps →</Link>
            </section>

            <section className="ph-card" hidden={startKind !== "Game"}>
              <span className="eyebrow">From a game idea</span>
              <p>Describe a small game and Claude writes the whole thing. Play it right here, change it by chatting, then make its art on Comfy.</p>
              <div className="ph-photos">
                {PLAYABLE_SAMPLES.map((g) => <Link key={g.src} className="ph-photo ph-game" href="/playable" style={{ backgroundImage: `url(${g.src})` }} title={`Play ${g.title}`} aria-label={`Play ${g.title} on Playable`} />)}
              </div>
              <Link className="ph-go" href="/playable">Make a game →</Link>
            </section>

            <section className="ph-card ph-hot" hidden={startKind !== "Script"}>
              <span className="eyebrow">From a script</span>
              <p>Start with the words. Pick the kind of show, upload a script, or let the writer draft one. Then load it into a project.</p>
              <button className="ph-go" onClick={() => void create()}>Pick a format →</button>
              <div className="ph-pair">
                <button className="ph-ghost" onClick={() => void create()}>Write with Claude</button>
                <button className="ph-ghost" onClick={() => void create()}>Upload a file</button>
              </div>
            </section>
          </div>

          </section>

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


        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
