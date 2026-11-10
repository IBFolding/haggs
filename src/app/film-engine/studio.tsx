"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { openKeys } from "../nav";
import { usePrefs } from "../prefs";
import { directFilm } from "./plan-actions";
import { FILM_STORAGE_KEY, filmManifest, filmShotAt, filmWorld, makeFilmDocument, validateFilmDocument, type FilmDocument, type FilmEngine, type FilmShot, type ReviewState } from "../../film/plan";
import { HaggsWorldEngine } from "../../worlds/engine";
import { makeWorld, validateWorld, type WorldSpec } from "../../worlds/spec";
import styles from "./film-engine.module.css";

type Panel = "director" | "render" | "outputs";
type Section = "production" | "shots" | "cameras" | "render" | "review" | "export";
const EMPTY_THUMB = "linear-gradient(130deg,#172a29,#09171e 75%)";
const prettyTime = (seconds: number) => {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};
const blob = (value: unknown) => new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
function download(file: Blob, name: string) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const renderNames: Record<FilmEngine, string> = { three: "Three.js", blender: "Blender", comfy: "ComfyUI" };
const SIDEBAR: { section: Section; icon: string; name: string }[] = [
  { section: "production", icon: "▶", name: "Production" },
  { section: "shots", icon: "▦", name: "Shots" },
  { section: "cameras", icon: "◎", name: "Cameras" },
  { section: "render", icon: "◈", name: "Render" },
  { section: "review", icon: "◇", name: "Review" },
  { section: "export", icon: "↥", name: "Export" },
];

export default function FilmEngineStudio() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<InstanceType<typeof HaggsWorldEngine> | null>(null);
  const docRef = useRef<FilmDocument>(makeFilmDocument());
  const recordRef = useRef<MediaRecorder | null>(null);
  const recordTimeout = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const mountedRef = useRef(false);

  const [film, setFilm] = useState<FilmDocument>(() => makeFilmDocument());
  const [current, setCurrent] = useState(0);
  const [view, setView] = useState<Section>("production");
  const [tab, setTab] = useState<"timeline" | "cameras" | "review">("timeline");
  const [panel, setPanel] = useState<Panel>("director");
  const [engine, setEngine] = useState<FilmEngine>("three");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraEdit, setCameraEdit] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [brief, setBrief] = useState("Create a 60-second cinematic journey through this world. Start with an epic establishing shot, reveal the monumental portal, and end on an unforgettable composition.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Three.js is starting…");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<"world" | "plan" | "manifest" | null>(null);
  const { openOnly } = usePrefs();

  const makeThumbs = useCallback((doc: FilmDocument) => {
    const e = engineRef.current;
    if (!e || !canvas.current || e.playing || recordRef.current) return;
    const previous = e.time;
    const wasFilm = e.filmMode;
    e.setFilmMode(true);
    const thumbnails: Record<string, string> = {};
    const small = document.createElement("canvas"); small.width = 300; small.height = 170;
    const context = small.getContext("2d");
    if (context) {
      for (const shot of doc.shots) {
        e.setTime((shot.start + shot.end) / 2);
        e.screenshot();
        context.drawImage(canvas.current, 0, 0, small.width, small.height);
        thumbnails[shot.id] = small.toDataURL("image/jpeg", .72);
      }
    }
    e.setTime(previous); e.setFilmMode(wasFilm);
    setThumbs(thumbnails);
  }, []);

  const loadDocument = useCallback((doc: FilmDocument, note: string) => {
    if (!validateFilmDocument(doc)) { setMessage("This film document is invalid; your existing work was kept."); return; }
    const e = engineRef.current;
    if (e?.playing || recordRef.current) { setMessage("Pause the film before replacing the scene."); return; }
    docRef.current = doc; setFilm(doc); setCurrent(0); setTime(0); setPlaying(false); setCameraEdit(false);
    setBrief(doc.brief || "Create a cinematic film with deliberate camera moves and a memorable final image.");
    if (e) {
      e.load(filmWorld(doc));
      e.setFilmMode(true);
      window.requestAnimationFrame(() => makeThumbs(doc));
    }
    setVideoUrl(url => { if (url) URL.revokeObjectURL(url); return null; });
    setLastExport(null); setMessage(note);
  }, [makeThumbs]);

  useEffect(() => {
    mountedRef.current = true;
    if (!canvas.current) return;
    let initial = docRef.current;
    try {
      const saved = localStorage.getItem(FILM_STORAGE_KEY);
      if (saved) {
        const candidate: unknown = JSON.parse(saved);
        if (validateFilmDocument(candidate)) initial = candidate;
      } else {
        const savedWorld = localStorage.getItem("haggs:worlds:latest:v1");
        if (savedWorld) {
          const candidate: unknown = JSON.parse(savedWorld);
          if (validateWorld(candidate)) initial = makeFilmDocument(candidate);
        }
      }
    } catch { /* Browser storage can be disabled. Use the starter world. */ }

    try {
      const e = new HaggsWorldEngine(canvas.current,
        () => {},
        () => {},
        (at: number, running: boolean) => {
          if (!mountedRef.current) return;
          setTime(at); setPlaying(running);
          if (!running && recordRef.current && recordRef.current.state === "recording") recordRef.current.stop();
        },
      );
      engineRef.current = e;
      docRef.current = initial; setFilm(initial); setBrief(initial.brief || "Create a 60-second cinematic journey through this world, with an epic reveal and a memorable final composition.");
      e.load(filmWorld(initial)); e.setFilmMode(true);
      setMessage("Live world ready · Browser preview · No GPU charge");
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => makeThumbs(initial)));
    } catch (error) {
      setMessage(`WebGL failed to start: ${error instanceof Error ? error.message : "unknown error"}`);
    }
    return () => {
      mountedRef.current = false;
      if (recordTimeout.current !== null) window.clearTimeout(recordTimeout.current);
      if (recordRef.current?.state === "recording") recordRef.current.stop();
      recordRef.current = null;
      engineRef.current?.dispose(); engineRef.current = null;
    };
  }, [makeThumbs]);

  useEffect(() => () => { if (photoRef.current) photoRef.current = null; }, []);

  const patchFilm = (updater: (doc: FilmDocument) => FilmDocument, refreshWorld = true) => {
    const next = updater(docRef.current);
    if (!validateFilmDocument(next)) { setMessage("That edit would break the film timeline, so it wasn't applied."); return; }
    docRef.current = next; setFilm(next); setVideoUrl(url => { if (url) URL.revokeObjectURL(url); return null; });
    if (refreshWorld && engineRef.current && !recordRef.current) {
      const timeBefore = engineRef.current.time;
      engineRef.current.load(filmWorld(next));
      engineRef.current.setFilmMode(!cameraEdit);
      engineRef.current.setTime(Math.min(timeBefore, next.duration));
      window.requestAnimationFrame(() => makeThumbs(next));
    }
  };

  const selectShot = (i: number) => {
    if (recordRef.current) return;
    const shot = docRef.current.shots[i];
    if (!shot) return;
    setCurrent(i); setTime(shot.start);
    const e = engineRef.current;
    if (e) { e.playing = false; e.setFilmMode(!cameraEdit); e.setTime(shot.start); }
    setPlaying(false);
  };
  const seek = (at: number) => {
    if (recordRef.current) return;
    const safe = Math.min(film.duration, Math.max(0, at));
    setTime(safe); setPlaying(false);
    const e = engineRef.current;
    if (e) { e.playing = false; e.setFilmMode(true); e.setTime(safe); }
    setCameraEdit(false);
    const index = docRef.current.shots.findIndex(s => safe >= s.start && safe < s.end);
    if (index >= 0) setCurrent(index);
  };
  const togglePlay = () => {
    const e = engineRef.current; if (!e || recordRef.current) return;
    if (cameraEdit) { setCameraEdit(false); e.setFilmMode(true); }
    if (e.time >= docRef.current.duration) e.setTime(0);
    e.playing = !e.playing; setPlaying(e.playing);
  };
  const switchSection = (s: Section) => {
    setView(s);
    if (s === "shots") setTab("timeline");
    if (s === "cameras") setTab("cameras");
    if (s === "review") setTab("review");
    if (s === "render") setPanel("render");
    if (s === "export") setPanel("outputs");
    if (s === "production") setPanel("director");
  };
  const save = () => {
    try {
      localStorage.setItem(FILM_STORAGE_KEY, JSON.stringify(docRef.current));
      setMessage("Film plan saved in this browser. Export the production JSON for a portable copy.");
    } catch { setMessage("Local storage is unavailable. Use the JSON export instead."); }
  };
  const exportPlan = () => {
    download(blob(docRef.current), "haggs-film-project.json");
    setLastExport("plan"); setMessage("Editable Film Engine project exported. It can be imported into this workspace.");
  };
  const exportManifest = () => {
    download(blob(filmManifest(docRef.current)), "haggs-film-render-manifest.json");
    setLastExport("manifest"); setMessage("Film render manifest exported. No rendering has been performed.");
  };
  const exportWorld = () => {
    download(blob(filmWorld(docRef.current)), "haggs-world.json");
    setLastExport("world");
    setMessage(engine === "blender" ? "World and shot cameras exported. Run scripts/worlds/render_blender.py in Blender for a render." : "World with film cameras exported. Use the Haggs · Load World node in ComfyUI.");
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > 2_000_000) { setMessage("The maximum JSON import size is 2 MB."); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (validateFilmDocument(parsed)) {
        loadDocument(parsed, "Film project imported. Camera shots and notes restored.");
      } else if (validateWorld(parsed)) {
        loadDocument(makeFilmDocument(parsed), "World imported. Eight cinematic shots planned locally.");
      } else {
        setMessage("This is not a supported Haggs Worlds or Film Engine JSON. Nothing changed.");
      }
    } catch { setMessage("Could not read that JSON file."); }
  };

  const buildLocalPlan = () => {
    const previous = docRef.current;
    loadDocument(makeFilmDocument(previous.world, previous.duration, undefined, brief), "Eight shots drafted locally using real camera keyframes. No model was called.");
  };
  const buildAIPlan = async () => {
    if (busy || recordRef.current || openOnly) return;
    setBusy(true); setMessage("Requesting a shot plan from Claude using your connected key…");
    try {
      const result = await directFilm(brief, docRef.current.world);
      if (!result.ok) {
        setMessage(result.reason);
        if (result.needsKey) openKeys();
        return;
      }
      const previous = docRef.current;
      loadDocument(makeFilmDocument(previous.world, previous.duration, result.ideas, brief), "Claude drafted eight shots. Review them, refine cameras, then choose a renderer.");
    } catch { setMessage("AI plan request couldn't finish. Your existing plan is unchanged."); }
    finally { setBusy(false); }
  };

  const updateShot = (patch: Partial<FilmShot>, refreshWorld = false) => {
    patchFilm(doc => ({ ...doc, shots: doc.shots.map((s, i) => i === current ? { ...s, ...patch } : s) }), refreshWorld);
  };
  const updateReview = (review: ReviewState) => {
    updateShot({ review });
    setMessage(`${selected.id}: ${review === "needs-change" ? "flagged for changes" : review === "approved" ? "approved after your review" : "review cleared"}.`);
  };
  const editCamera = () => {
    const e = engineRef.current; if (!e || recordRef.current) return;
    e.playing = false; setPlaying(false);
    setCameraEdit(v => { e.setFilmMode(v); return !v; });
    setMessage(cameraEdit ? "Camera edit complete. Film preview restored." : "Camera edit mode: drag to orbit and reposition the camera, then capture Start or End.");
  };
  const captureKey = (end: boolean) => {
    const e = engineRef.current;
    if (!e || !cameraEdit || recordRef.current) { setMessage("Enter Camera edit mode first."); return; }
    e.setCameraKey(current, end);
    const s = e.world?.film.shots[current];
    if (!s) return;
    patchFilm(doc => ({ ...doc, shots: doc.shots.map((shot, i) => i !== current ? shot : { ...shot, ...(end ? { to: s.to, lookTo: s.lookTo } : { from: s.from, lookFrom: s.lookFrom }) }) }), false);
    setMessage(`${selected.id}: recorded ${end ? "end" : "start"} camera position.`);
  };

  const recordPreview = () => {
    const e = engineRef.current;
    const surface = canvas.current;
    if (!e || !surface || recording || recordRef.current) return;
    if (!("MediaRecorder" in window) || typeof surface.captureStream !== "function") {
      setMessage("This browser cannot record the canvas. Use Edge/Chrome or download the Blender scene.");
      return;
    }
    const codec = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
    if (!codec) { setMessage("No WebM recorder is supported. Try Edge/Chrome or export the Blender scene."); return; }
    try {
      const stream = surface.captureStream(24);
      const recorder = new MediaRecorder(stream, { mimeType: codec, videoBitsPerSecond: 8_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
      recorder.onerror = () => setMessage("Browser recording encountered an error. Try Blender for a final-quality render.");
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordTimeout.current !== null) window.clearTimeout(recordTimeout.current);
        recordTimeout.current = null;
        recordRef.current = null;
        setRecording(false); e.playing = false; setPlaying(false);
        if (mountedRef.current && chunks.length) {
          const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
          setVideoUrl(old => { if (old) URL.revokeObjectURL(old); return url; });
          setPanel("outputs"); setMessage("WebM preview recorded in real time. This is not a path-traced Blender final.");
        }
      };
      recordRef.current = recorder; setRecording(true); setVideoUrl(old => { if (old) URL.revokeObjectURL(old); return null; });
      setCameraEdit(false); e.setFilmMode(true); e.setTime(0); setTime(0);
      recorder.start(500);
      e.playing = true; setPlaying(true);
      // Browsers can suspend inactive tabs; never leave a recorder running indefinitely.
      recordTimeout.current = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, (film.duration + 15) * 1000);
      setMessage("Recording the actual WebGL camera sequence at up to 24 fps. Keep this tab visible.");
    } catch (error) {
      recordRef.current = null; setRecording(false);
      setMessage(`Could not record browser preview: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  const selected = film.shots[current] ?? film.shots[0]!;
  const highlighted = filmShotAt(film, time);
  const reviewCount = film.shots.filter(s => s.review === "approved").length;
  const needsChange = film.shots.filter(s => s.review === "needs-change").length;
  const frameCount = Math.round(film.duration * film.fps);
  const activeThumb = thumbs[selected.id];
  const panelSelect = (key: Panel) => { setPanel(key); setView(key === "director" ? "production" : key === "render" ? "render" : "export"); };
  const backgroundFor = (id: string): CSSProperties => thumbs[id] ? { backgroundImage: `url("${thumbs[id]}")` } : { background: EMPTY_THUMB };
  const resolvedSummary = engine === "three" ? "Records a real-time WebGL preview (WebM). It will not look like a Cycles path-traced film." : engine === "blender" ? "Export the scene JSON with keyed cameras, then run the local Blender Cycles builder. No cloud render will start here." : "Export metadata for the installed Haggs · Load World and Haggs · Direct Shot ComfyUI nodes. You decide which open-weight model runs.";
  const handleEngineAction = () => engine === "three" ? recordPreview() : exportWorld();

  return (
    <div className={styles.shell}>
      <aside className={styles.left}>
        <div className={styles.leftTitle}><span className={styles.clapper}>▣</span><div><strong>Film Engine</strong><small>AI-powered cinematic production</small></div></div>
        <div className={styles.navList}>
          {SIDEBAR.map(item => <button type="button" key={item.section} onClick={() => switchSection(item.section)} className={view === item.section ? styles.navActive : ""}><span>{item.icon}</span>{item.name}</button>)}
        </div>
        <div className={styles.worldLink}>
          <small>LINKED WORLD</small>
          <Link href="/worlds" title="Open the linked world in Worlds"><span className={styles.worldImage} style={activeThumb ? { backgroundImage: `url("${activeThumb}")` } : {}}/><span><strong>{film.world.name}</strong><em>Worlds · editable</em></span><span className={styles.ext}>↗</span></Link>
          <div className={styles.worldActions}><button type="button" onClick={() => importRef.current?.click()}>Import world</button><button type="button" onClick={save}>Save draft</button></div>
        </div>
        <div className={styles.leftFooter}><span className={styles.liveDot}/> Local scene preview <small>Haggs Film Engine V2</small></div>
      </aside>

      <div className={styles.workspace}>
        <div className={styles.workspaceHeader}>
          <div><span className={styles.eyebrow}>HAGGS / FILM ENGINE / V2</span><h1>Turn your world into a film.</h1><p>Direct your shots. Control the camera. Render on your terms.</p></div>
          <div className={styles.headerTools}><button type="button" onClick={() => importRef.current?.click()}>↥ Import</button><button type="button" onClick={save}>Save draft</button></div>
        </div>

        <div className={styles.monitor}>
          <canvas ref={canvas} aria-label="Live film playback from the linked Three.js world" />
          <div className={styles.monitorGradient}/>
          <div className={styles.monitorHeader}><span className={styles.liveLabel}><i /> SHOT {String(film.shots.indexOf(highlighted) + 1).padStart(2, "0")} / {String(film.shots.length).padStart(2, "0")} <b>{highlighted.name}</b></span><span className={styles.monitorMode}>{cameraEdit ? "EDIT CAMERA · DRAG TO ORBIT" : "LIVE WEBGL PREVIEW"}</span></div>
          <div className={styles.monitorCorners} aria-hidden="true"><span/><span/><span/><span/></div>
          <div className={styles.monitorControls}>
            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause film" : "Play film"} disabled={recording} className={styles.playControl}>{playing ? "Ⅱ" : "▶"}</button>
            <span className={styles.timecode}>{prettyTime(time)} / {prettyTime(film.duration)}</span>
            <input aria-label="Seek film preview" type="range" min="0" max={film.duration} step={1 / film.fps} value={time} onChange={e => seek(+e.target.value)} disabled={recording} />
            <span className={styles.quality}>WEBGL</span>
            <button type="button" onClick={() => { const e = engineRef.current; if (!e) return; download(new Blob([JSON.stringify(filmManifest(docRef.current), null, 2)], {type:"application/json"}), "film-production.json"); }} title="Export shot plan" className={styles.monitorMinor}>↥</button>
            <button type="button" onClick={() => { const e = engineRef.current; if (!e) return; const url = e.screenshot(); const a = document.createElement("a"); a.href = url; a.download = "haggs-film-still.png"; a.click(); setMessage("Current live Three.js frame saved as PNG."); }} title="Capture current frame" className={styles.monitorMinor}>▧</button>
          </div>
        </div>

        <div className={styles.editTabs}>
          <div>
            {(["timeline", "cameras", "review"] as const).map(key =>
              <button key={key} type="button" onClick={() => { setTab(key); setView(key === "timeline" ? "shots" : key); }} className={tab === key ? styles.tabActive : ""}>{key === "timeline" ? "▦  Timeline" : key === "cameras" ? "◎  Cameras" : `◇  Review ${needsChange ? "(" + needsChange + ")" : ""}`}</button>)}
          </div>
          <span>{film.shots.length} shots · {Math.round(film.duration)}s · {film.fps}fps</span>
        </div>

        {tab === "timeline" && (
          <div className={styles.timelineBlock}>
            <div className={styles.shotStrip}>
              {film.shots.map((s, i) => <button type="button" key={s.id} onClick={() => selectShot(i)} className={i === current ? styles.thumbActive : ""}>
                <div className={styles.thumb} style={backgroundFor(s.id)}><span>{s.review === "approved" ? "✓" : s.review === "needs-change" ? "!" : ""}</span></div>
                <div className={styles.thumbInfo}><b>{s.id}</b><span>{prettyTime(s.start)}–{prettyTime(s.end)}</span></div>
                <strong title={s.name}>{s.name}</strong>
              </button>)}
            </div>
            <div className={styles.track}>
              <div className={styles.trackPieces}>{film.shots.map(s => <span key={s.id} style={{ flex: s.end - s.start }} className={s.review === "needs-change" ? styles.trackFlag : ""}/>)}</div>
              <input type="range" min="0" max={film.duration} step={1 / film.fps} value={time} onChange={e => seek(+e.target.value)} aria-label="Timeline scrub" disabled={recording}/>
              <div className={styles.trackTimes}>{Array.from({length:7},(_,i)=><span key={i}>{prettyTime(film.duration*i/6)}</span>)}</div>
            </div>
          </div>
        )}
        {tab === "cameras" && (
          <div className={styles.cameraDeck}>
            <div><span className={styles.eyebrow}>SHOT CAMERA · {selected.id}</span><h3>{selected.name}</h3><p>Move the camera in live edit mode, capture the starting and ending views, then play the move.</p></div>
            <div className={styles.cameraActions}><button type="button" onClick={editCamera} className={cameraEdit ? styles.selectedButton : ""}>{cameraEdit ? "Finish camera edit" : "Edit camera"}</button><button type="button" onClick={() => captureKey(false)} disabled={!cameraEdit}>Capture start</button><button type="button" onClick={() => captureKey(true)} disabled={!cameraEdit}>Capture end</button></div>
            <label>Lens <input type="range" min={18} max={120} value={selected.lensMm} onChange={e => updateShot({lensMm:+e.target.value}, true)} /><strong>{selected.lensMm}mm</strong></label>
          </div>
        )}
        {tab === "review" && (
          <div className={styles.reviewDeck}>
            <div><span className={styles.eyebrow}>SHOT REVIEW</span><h3>{selected.id} · {selected.name}</h3><p>{selected.beat}</p></div>
            <div className={styles.reviewTools}>
              <button onClick={() => updateReview("approved")} className={selected.review === "approved" ? styles.selectedButton : ""} type="button">✓ Approve</button>
              <button onClick={() => updateReview("needs-change")} className={selected.review === "needs-change" ? styles.warningButton : ""} type="button">⚑ Needs changes</button>
              <button onClick={() => updateReview("unreviewed")} type="button">Clear</button>
            </div>
            <textarea aria-label="Review notes" placeholder="What needs to change in this shot?" value={selected.notes} onChange={e => updateShot({notes:e.target.value.slice(0,2000)})}/>
          </div>
        )}

        <div className={styles.message} role="status"><span className={styles.liveDot}/>{message}</div>
      </div>

      <aside className={styles.right}>
        <div className={styles.panelTabs}>
          <button type="button" className={panel === "director" ? styles.rightTabActive : ""} onClick={() => panelSelect("director")}>✧ AI Director</button>
          <button type="button" className={panel === "render" ? styles.rightTabActive : ""} onClick={() => panelSelect("render")}>⚙ Render</button>
          <button type="button" className={panel === "outputs" ? styles.rightTabActive : ""} onClick={() => panelSelect("outputs")}>↥ Outputs</button>
        </div>
        {panel === "director" && (
          <div className={styles.sidebarContent}>
            <div className={styles.sectionLabel}>DIRECT YOUR FILM <small>IDEA → SHOT PLAN</small></div>
            <textarea className={styles.directorInput} aria-label="Director brief" value={brief} onChange={e => setBrief(e.target.value.slice(0,1800))} placeholder="Describe the film you want to make…"/>
            <div className={styles.directorActions}><button type="button" onClick={buildLocalPlan} disabled={busy}>Local shot draft</button><button type="button" className={styles.primary} disabled={busy || openOnly} onClick={() => void buildAIPlan()}>{busy ? "Directing…" : "✧ Generate with Claude"}</button></div>
            <p className={styles.hint}>{openOnly ? "Open Weights only is enabled. Claude planning is disabled; local planning still works." : "Claude planning uses your connected Anthropic key and may incur provider charges. No rendering starts automatically."}</p>
            <div className={styles.divider}/>
            <div className={styles.sectionLabel}>PRODUCTION PLAN <small>{film.shots.length} shots · {prettyTime(film.duration)}</small></div>
            <div className={styles.planList}>
              {film.shots.map((shot, i) => <button type="button" key={shot.id} onClick={() => selectShot(i)} className={current === i ? styles.planActive : ""}>
                <span className={styles.planCheck}>{shot.review === "approved" ? "✓" : shot.review === "needs-change" ? "!" : ""}</span>
                <b>{shot.id}</b><span title={shot.name}>{shot.name}</span><small>{prettyTime(shot.start)}–{prettyTime(shot.end)}</small><i>▶</i>
              </button>)}
            </div>
            <label className={styles.shotBeatLabel}>SELECTED SHOT · {selected.id}<textarea aria-label="Selected shot description" value={selected.beat} onChange={e => updateShot({beat:e.target.value.slice(0,900)})} rows={3}/></label>
            <div className={styles.divider}/>
            <div className={styles.sectionLabel}>RENDER ENGINE <small>SELECT THE OUTPUT</small></div>
            <div className={styles.engineCards}>{(["three","blender","comfy"] as const).map(key => <button type="button" key={key} onClick={() => setEngine(key)} className={engine===key?styles.engineActive:""}><span>{key === "three" ? "△" : key === "blender" ? "◉" : "⬡"}</span><b>{renderNames[key]}</b><small>{key === "three" ? "Realtime" : key === "blender" ? "Cycles" : "Open weights"}</small></button>)}</div>
            <p className={styles.hint}>{resolvedSummary}</p>
            <button type="button" className={styles.primary + " " + styles.renderCTA} onClick={handleEngineAction} disabled={recording}>{recording ? "Recording preview…" : engine === "three" ? "▣ Record preview (WebM)" : "↥ Download scene handoff"}</button>
          </div>
        )}
        {panel === "render" && (
          <div className={styles.sidebarContent}>
            <div className={styles.sectionLabel}>RENDER STUDIO <small>SELECT ONE ENGINE</small></div>
            <div className={styles.engineCards}>{(["three","blender","comfy"] as const).map(key => <button type="button" key={key} onClick={()=>setEngine(key)} className={engine===key?styles.engineActive:""}><span>{key==="three"?"△":key==="blender"?"◉":"⬡"}</span><b>{renderNames[key]}</b><small>{key==="three"?"Preview":key==="blender"?"Path-trace":"AI workflow"}</small></button>)}</div>
            <div className={styles.renderSpecs}>
              <div><span>Running location</span><strong>{engine === "three" ? "This browser" : engine === "blender" ? "Your Blender workstation" : "Your installed ComfyUI"}</strong></div>
              <div><span>Frames in film</span><strong>{frameCount.toLocaleString()} · {film.fps} fps</strong></div>
              <div><span>Output</span><strong>{engine === "three" ? "WebM video" : engine === "blender" ? "Scene JSON → .blend / frames" : "Camera + prompt metadata"}</strong></div>
              <div><span>Cloud cost</span><strong>{engine === "three" ? "$0 browser preview" : "Not quoted · no cloud launch"}</strong></div>
            </div>
            <p className={styles.hint}>{resolvedSummary}</p>
            <button className={styles.primary + " " + styles.renderCTA} type="button" onClick={handleEngineAction} disabled={recording}>{recording ? "Recording…" : engine === "three" ? "Record browser preview" : "Download handoff JSON"}</button>
            <div className={styles.divider}/>
            <div className={styles.sectionLabel}>EXTERNAL PRODUCTION <small>NOT AUTO-RUN</small></div>
            <p className={styles.hint}>Blender: run <code>scripts/worlds/render_blender.py</code> with the exported world JSON. ComfyUI: connect Haggs · Load World → Haggs · Direct Shot to an installed compatible video model. No unverified model runs are represented as complete.</p>
            <button type="button" onClick={exportManifest}>Download complete production manifest</button>
          </div>
        )}
        {panel === "outputs" && (
          <div className={styles.sidebarContent}>
            <div className={styles.sectionLabel}>OUTPUTS <small>ACTUAL FILES</small></div>
            <div className={styles.outputCard}><strong>{videoUrl ? "Browser video ready" : "No video recorded yet"}</strong><p>{videoUrl ? "Real-time Three.js preview. WebM container; not a 4K Cycles final." : "Record a preview or export a scene to render externally."}</p>{videoUrl ? <a href={videoUrl} download="haggs-film-preview.webm" className={styles.primary + " " + styles.outputDownload}>Download WebM preview ↧</a> : null}</div>
            <button type="button" onClick={exportPlan}>↥ Export editable film project</button>
            <button type="button" onClick={exportManifest}>↥ Export render manifest</button>
            <button type="button" onClick={exportWorld}>↥ Download world and cameras</button>
            <button type="button" onClick={() => importRef.current?.click()}>↧ Import world / film document</button>
            <p className={styles.hint}>The production manifest contains the shot list, timing, camera coordinates, and review notes. The world JSON works with the existing Blender and ComfyUI Worlds bridges.</p>
            <Link className={styles.editorLink} href="/editor">Open Haggs Editor ↗</Link>
            <p className={styles.hint}>Manual handoff only. The film has not been inserted into an Editor project.</p>
            <div className={styles.sectionLabel}>REVIEW SUMMARY <small>{reviewCount}/{film.shots.length} APPROVED</small></div>
            <p className={styles.hint}>{needsChange} shots flagged for revision · {film.shots.length - reviewCount - needsChange} not reviewed. Reviews are manual in V2.</p>
            {lastExport && <div className={styles.exportTag}>Most recent export: {lastExport === "plan" ? "editable film project" : lastExport === "manifest" ? "render manifest" : "world scene"}</div>}
          </div>
        )}
      </aside>
      <div className={styles.pipeline}>
        <div className={styles.pipelineTitle}><b>◈ &nbsp; Production pipeline</b></div>
        {[
          ["World", film.world.name, true],
          ["Shot plan", `${film.shots.length} shots · ${Math.round(film.duration)}s`, true],
          ["Assets", "Procedural geometry", true],
          ["Render", videoUrl ? "WebM preview ready" : recording ? "Recording…" : "Not rendered", Boolean(videoUrl)],
          ["Review", `${reviewCount}/${film.shots.length} approved`, reviewCount === film.shots.length],
          ["Export", lastExport ? "Manifest downloaded" : "Not exported", Boolean(lastExport)],
        ].map(([label, detail, done], i) => <div className={styles.pipelineStep} key={String(label)}><span className={done ? styles.stepDone : styles.stepPending}>{done ? "✓" : i + 1}</span><div><b>{label}</b><small>{detail}</small></div>{i<5?<span className={styles.stepArrow}>›</span>:null}</div>)}
      </div>
      <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={e => void importFile(e)}/>
    </div>
  );
}
