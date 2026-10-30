"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { openKeys } from "../../../../nav";
import { loadBank } from "../../../../bank-picker";
import { quoteWorkflow, runWorkflow, type Quote } from "../../../../workflow-actions";
import { actorMattePrompt, MATTE_INPUT, type Point } from "../../../../../comfy/actor-matte";
import { Nav } from "../../../../nav";
import { Compositor } from "./compositor";
import { GreyRoom } from "../../cut/grey";
import { StudioIcon } from "./studio-icon";
import { AssetShelf, type SceneTask } from "./asset-shelf";
import { SceneAssistant } from "./scene-assistant";
import { SceneTimeline } from "./scene-timeline";
import { SceneItems } from "./scene-items";
import { sceneForShot } from "../../../../../story/grey-source";
import { RenderPanel } from "./render-panel";
import { SetPanel } from "./set-panel";
import { createHistory, dropKey, keyTimes, mergeEdit, normalizeScene, resolveScene, sceneIsEmpty, type GreyScene } from "../../../../../story/grey-scene";
import { BuildLink } from "../../../../return-bar";
import type { BankItem } from "../../../../../story/bank";
import { commit, view } from "../../../../../story/boards";
import { defaultKv } from "../../../../../story/kv";
import type { Project, Shot } from "../../../../../story/model";
import { createProjectStore } from "../../../../../story/store";
import { applySet, type SavedSet } from "../../../../../story/set-bank";
import { addTake } from "../../../../../story/takes";
import { createSaveQueue } from "../../../../../story/use-autosave";
import { creditsText } from "../../../../../story/price-text";

/**
 * The Grey Room: take one shot of filmed footage and build a new set around
 * the people in it. Four steps, one job each, so nothing is crowded:
 * cut the actor out, choose where it happens, light it, render a new take.
 * The original footage is never touched; the result comes back to the editor
 * as a new take.
 */

const STEPS = [
  { id: "blockout", label: "Blockout", says: "Work out the camera, the figures and the light in grey, for free. Key a camera move, then make the real picture." },
  { id: "cut", label: "Cut out", says: "Separate the actor from the grey room, so everything behind them can change." },
  { id: "set", label: "Edit scene", says: "Choose what to change. Find a surface, choose its material, then review the result." },
  { id: "render", label: "Review & export", says: "Check the set, then make a new take for the cut." },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const clean = <T extends { keys?: unknown }>(item: T): T => { if (item.keys === undefined) { const { keys: _k, ...rest } = item; return rest as T; } return item; };

const money = (n: number) => creditsText(n);
export function GreyStudio({ id, shotId, boardId }: { id: string; shotId: string; boardId?: string | undefined }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const [saveState, setSaveState] = useState("Saved");
  const saves = useMemo(() => createSaveQueue(store, 600, () => setSaveState("Save failed — retry"), () => setSaveState("Saved")), [store]);
  const full = useRef<Project | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [guides,setGuides]=useState(false);
  const [previewZoom,setPreviewZoom]=useState(1);
  const [canvasFocus,setCanvasFocus]=useState(false);
  const [advanced,setAdvanced] = useState(false);
  const [task,setTask] = useState<SceneTask>("objects");
  const [step, setStep] = useState<StepId>("set");
  const [places, setPlaces] = useState<BankItem[]>([]);
  const [actors, setActors] = useState<BankItem[]>([]);
  const [accessories, setAccessories] = useState<BankItem[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [describe, setDescribe] = useState("");
  const [picking, setPicking] = useState(false);
  const [dots, setDots] = useState<{ at: Point; fx: number; fy: number }[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [scene, setSceneState] = useState<GreyScene>({});
  const liveScene = useRef(scene); liveScene.current = scene;
  const [selected, setSelected] = useState<string | null>(null);
  const history = useRef(createHistory<GreyScene>({}));
  const [, bump] = useState(0);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    void store.load(id).then((found) => {
      if (!found) return setMissing(true);
      full.current = found;
      const board = view(found, boardId);
      setProject(board);
      const first = sceneForShot(board.shots.find((x) => x.id === shotId));
      history.current = createHistory<GreyScene>(first);
      setSceneState(first);
    });
    void loadBank().then((all) => { setPlaces(all.filter((i) => i.kind === "place")); setAccessories(all.filter((i) => i.kind === "accessory" && i.image)); setActors(all.filter(i => i.kind === "character" && i.image)); });
  }, [store, id, boardId, shotId]);

  useEffect(() => () => { clearTimeout(settle.current); void saves.flush(); }, [saves]);

  // What the cut-out will cost on Comfy.
  useEffect(() => {
    void quoteWorkflow({ file: JSON.stringify(actorMattePrompt({ describe: "person" })) }, {}).then(setQuote);
  }, []);

  const shot: Shot | undefined = project?.shots.find((s) => s.id === shotId);
  const back = `/board/${id}/cut${boardId ? `?b=${boardId}` : ""}`;

  /** Writes the scene onto the shot and saves the project. */
  function persist(next: GreyScene) {
    if (!full.current) return;
    const current = view(full.current, boardId);
    const updated: Project = { ...current, shots: current.shots.map(x => x.id === shotId ? {...x,greyScene:next} : x) };
    full.current = commit(full.current, boardId, updated);
    setProject(updated); setSaveState("Saving…"); saves.queue(full.current);
  }

  /** Any other change to this shot (its grey blockout, an approval, a new picture), saved by this page. */
  function updateShot(change: (x: Shot) => Shot) {
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? change(x) : x)) };
      setSaveState("Saving…");
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  /** A finished render becomes a new take on this shot, saved by this page so nothing else overwrites it. */
  function addTakeHere(url: string, usd: number, origin: string) {
    if (shot?.render && !scene.source) change({ ...scene, source: { url: shot.render.url, kind: shot.render.kind } }, true);
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? { ...addTake(x, { url, kind: "video", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, origin, liveScene.current), trimIn: 0 } : x)) };
      setSaveState("Saving…");
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  function selectItem(itemId: string | null) {
    setSelected(itemId);
    if (scene.props?.some(p=>p.id===itemId)) setTask(scene.props.find(p=>p.id===itemId)?.role === "actor" ? "actors" : "objects");
    else if (scene.lights?.some(l=>l.id===itemId)) setTask("lights");
    else if (scene.surfaces?.some(area=>area.id===itemId)) setTask("surface");
  }

  /** Every change shows at once. It counts as one undo step when you let go, or a moment after the last slider move. */
  function change(next: GreyScene, commitNow = false) {
    setShowOriginal(false);
    setSceneState(next);
    persist(next);
    clearTimeout(settle.current);
    const done = () => { history.current.push(next); bump((n) => n + 1); };
    if (commitNow) done();
    else settle.current = setTimeout(done, 500);
  }

  /** Puts a saved set on every other shot of this board. Each keeps its own cut-out. */
  function useEverywhere(saved: SavedSet) {
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? x : { ...x, greyScene: applySet(normalizeScene(x.greyScene), saved) })) };
      setSaveState("Saving…");
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
    change(applySet(scene, saved), true);
  }

  /** An edit made on what is shown at this moment: it moves the item, or keys it when you are animating. */
  function edit(next: GreyScene) {
    change(mergeEdit(scene, shown, next, time, animate));
  }

  function undo() {
    clearTimeout(settle.current);
    if (JSON.stringify(history.current.current) !== JSON.stringify(liveScene.current)) history.current.push(liveScene.current);
    const prev = history.current.undo();
    if (prev) { setSceneState(prev); persist(prev); bump((n) => n + 1); }
  }
  function redo() {
    const next = history.current.redo();
    if (next) { setSceneState(next); persist(next); bump((n) => n + 1); }
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  /** A click on the footage becomes a point in the video's own pixels, whatever size it is shown at. */
  function pick(e: React.MouseEvent<HTMLDivElement>) {
    const box = stage.current?.querySelector<HTMLElement>(".cp") ?? null;
    const video = box?.querySelector(".cp-actor") as HTMLVideoElement | HTMLImageElement | null;
    if (!picking || !box || !video) return;
    const w = video instanceof HTMLVideoElement ? video.videoWidth : video.naturalWidth;
    const h = video instanceof HTMLVideoElement ? video.videoHeight : video.naturalHeight;
    const r = box.getBoundingClientRect();
    if (!w || !h) return;
    const scale = Math.min(r.width / w, r.height / h);
    const x = (e.clientX - r.left - (r.width - w * scale) / 2) / scale;
    const y = (e.clientY - r.top - (r.height - h * scale) / 2) / scale;
    if (x < 0 || y < 0 || x > w || y > h) return;
    setDots((d) => [...d, { at: { x, y }, fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height }].slice(-12));
  }

  async function cutOut() {
    if (!project || !shot || !(scene.source ?? shot.render)) return;
    setRunning(true);
    setProblem(null);
    const footage = scene.source?.url ?? shot.render!.url;
    const startedSource = JSON.stringify(scene.source);
    const prompt = actorMattePrompt({ describe, points: dots.map((d) => d.at) });
    const r = await track(
      { label: "Cutting out the actor", href: window.location.pathname + window.location.search, failure: (x) => (x.ok ? null : x.reason), result: (x) => (x.ok ? { url: x.url } : null) },
      () => runWorkflow({ file: JSON.stringify(prompt) }, {}, { [MATTE_INPUT]: footage }),
    ).catch((e: unknown) => ({ ok: false as const, reason: e instanceof Error ? e.message : "The cut-out didn't run.", needsKey: false }));
    setRunning(false);
    if (!r.ok) {
      if ("needsKey" in r && r.needsKey) openKeys();
      return setProblem(r.reason);
    }
    if (startedSource !== JSON.stringify(liveScene.current.source)) return setProblem("The source changed while the cut-out was running. The old result was not attached to this scene.");
    change({ ...liveScene.current, matte: { url: r.url, at: Date.now(), price: r.price } }, true);
    setShowOriginal(false);
    setPicking(false);
  }

  if (missing || (project && !shot)) {
    return (
      <div className="app">
        <Nav current="Editor" />
        <div className="canvas"><div className="au"><h1>That shot isn't here.</h1><p><Link href={back}>Back to the cut</Link></p></div></div>
      </div>
    );
  }
  if (!project || !shot) return <div className="app"><Nav current="Editor" /></div>;

  const here = STEPS.findIndex((s) => s.id === step);
  const footage = scene.source ?? shot.render;
  const vertical = (project.aspect ?? "16:9") === "9:16";
  const matte = scene.matte;
  const shown = resolveScene(scene, time);
  const marks = keyTimes(scene);
  const isVideo = footage?.kind === "video";
  const seconds = shot.seconds ?? 4;
  const price = !quote ? null : quote.perSecond && quote.min > 0 ? `about ${money(quote.min * seconds)} for ${Math.round(seconds)}s` : quote.label;

  return (
    <div className="app gw-shell">
      <div className={`gs gw-workspace${advanced ? " gw-advanced" : ""}${guides ? " gw-guides" : ""}${canvasFocus ? " gw-canvas-focus" : ""}`}>
        <header className="gs-head">
          <Link className="gw-brand" href="/library">haggs<span>.</span></Link><h1>Grey Room</h1>
          <nav className="gw-modes" aria-label="Workspace mode">{STEPS.filter(s=>advanced || s.id!=="blockout").map(s=><button key={s.id} className={step===s.id?"on":""} aria-pressed={step===s.id} onClick={()=>{setStep(s.id);setSelected(null);}}>{s.id==='set'?'Edit':s.id==='cut'?'Prepare':s.id==='render'?'Render':'Blockout'}</button>)}</nav>
          <span className="gs-shot" title={shot.beat}>{shot.heading || "Untitled shot"}</span>
          <span className="gs-tools"><button className="gw-save" onClick={()=>void saves.flush()} title="Save now" aria-label="Save now"><StudioIcon name="device-floppy"/><span role="status">{saveState}</span></button><button className="gw-mode-switch" aria-pressed={advanced} onClick={()=>setAdvanced(v=>!v)}>{advanced?'Advanced':'Simple'}</button><Link className="gw-editor-link" href={back}>Back to editor</Link><button className="gw-render" onClick={()=>setStep('render')}>Render shot <StudioIcon name="arrow-right"/></button></span>
        </header>

        {step === "blockout" && shot ? (
          <div className="gs-blockout">
            <GreyRoom
              key={shot.id}
              shot={shot}
              vertical={vertical}
              names={project.threads.filter((t) => t.kind === "character" && shot.threadIds.includes(t.id)).map((t) => t.name)}
              onGrey={(g) => updateShot((x) => ({ ...x, grey: g }))}
              onApprove={() => updateShot((x) => ({ ...x, approved: true }))}
              onTake={(url, usd) => updateShot((x) => addTake(x, { url, kind: "image", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, "Grey room"))}
            />
            <div className="gs-nav">
              <span />
              <button className="pill on" onClick={() => setStep("cut")}>Next: Cut out →</button>
            </div>
          </div>
        ) : (
        <div className={`gs-body${step === "set" ? " gw-edit-body" : ""}`}>
          {step === "set" && <AssetShelf scene={scene} selected={selected} places={places} objects={accessories} actors={actors} onChange={n=>change(n,true)} onSelect={selectItem} onTask={setTask} />}
          <section className="gs-stage" aria-label="Preview">
            {step === "set" && <SceneAssistant scene={scene} selected={selected} projectId={id} shotId={shotId} boardId={boardId} onApply={n=>{ if (JSON.stringify(history.current.current) !== JSON.stringify(scene)) history.current.push(scene); change(n,true); }} />}
            <div className="gw-canvas-tools"><div className="gw-view-toggle"><button className={!showOriginal?'on':''} onClick={()=>setShowOriginal(false)}>Composite</button><button className={showOriginal?'on':''} aria-pressed={showOriginal} onClick={()=>setShowOriginal(true)}>Original</button></div><label className="gw-preview-zoom"><span className="sr-only">Preview zoom</span><select aria-label="Preview zoom" value={previewZoom} onChange={e=>{setPreviewZoom(Number(e.target.value));if(stage.current){stage.current.scrollTop=0;stage.current.scrollLeft=0;}}}><option value={1}>Fit</option><option value={1.25}>125%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label><button className="gw-focus-button" aria-pressed={canvasFocus} onClick={()=>setCanvasFocus(v=>!v)}>{canvasFocus?"Show panels":"Focus canvas"}</button><div className="gw-tool-actions"><button title="Undo" aria-label="Undo" onClick={undo} disabled={!history.current.canUndo}><StudioIcon name="arrow-back-up"/></button><button title="Redo" aria-label="Redo" onClick={redo} disabled={!history.current.canRedo}><StudioIcon name="arrow-forward-up"/></button><button title="Composition guides" aria-label="Composition guides" aria-pressed={guides} onClick={()=>setGuides(v=>!v)}><StudioIcon name="crop"/></button><button title="Fullscreen preview" aria-label="Fullscreen preview" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void stage.current?.parentElement?.requestFullscreen().catch(()=>setProblem('Fullscreen is unavailable in this browser.'));}}><StudioIcon name="maximize"/></button></div></div>
            <div ref={stage} className={`gs-pickwrap${picking ? " picking" : ""}${previewZoom>1?" gw-zoomed":""}`} style={{"--preview-zoom":previewZoom} as React.CSSProperties} onClick={pick}>
              {footage ? (
                <Compositor
                  scene={showOriginal ? {} : shown}
                  footage={footage}
                  actorUrl={!showOriginal && matte ? matte.url : null}
                  vertical={vertical}
                  selected={selected}
                  editing={showOriginal ? null : step === "set" ? "scene" : null}
                  time={time}
                  playing={playing}
                  seconds={seconds}
                  onTime={setTime}
                  onSelect={selectItem}
                  onChange={(next, commit) => change(mergeEdit(scene, shown, next, time, animate), commit)}
                />
              ) : <p className="gs-note">This shot has no footage yet.</p>}
              {step !== "cut" && scene.backdrop && !matte && !showOriginal && footage?.kind === "video" && <span className="gs-chip warn">Background replacement needs a subject cut-out. Surface edits keep the original shot.</span>}
              {step === "cut" && !matte && dots.map((d, i) => <i key={i} className="gs-dot" style={{ left: `${d.fx * 100}%`, top: `${d.fy * 100}%` }}>{i + 1}</i>)}
            </div>
            <SceneItems scene={shown} selected={selected} onSelect={id => { selectItem(id); setStep("set"); }} />
            <div className="gs-time" aria-label="Playhead">
              <button className="pill" aria-label="Previous frame" onClick={()=>{setPlaying(false);setTime(t=>Math.max(0,t-1/24));}}><StudioIcon name="arrow-left" size={15}/></button>
              <button className="pill" onClick={() => { if (!playing && time >= seconds - 0.05) setTime(0); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"}><StudioIcon name={playing?"player-pause":"player-play"}/></button>
              <button className="pill" aria-label="Next frame" onClick={()=>{setPlaying(false);setTime(t=>Math.min(seconds,t+1/24));}}><StudioIcon name="arrow-right" size={15}/></button>
              <div className="gs-track">
                <input type="range" min={0} max={seconds} step={0.05} value={Math.min(time, seconds)} aria-label="Time" onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} />
                {marks.map((m) => <i key={m} className={`gs-key${Math.abs(m - time) < 0.05 ? " on" : ""}`} style={{ left: `${(m / seconds) * 100}%` }} title={`Key at ${m}s`} onClick={() => { setPlaying(false); setTime(m); }} />)}
              </div>
              <span className="gs-clock">{time.toFixed(1)}s</span>
              <button className={`pill${animate ? " on" : ""}`} aria-pressed={animate} onClick={() => setAnimate((a) => !a)} title="While on, moving something at this moment makes it move over time">{animate ? "Animating" : "Animate"}</button>
              {marks.some((m) => Math.abs(m - time) < 0.05) && <button className="plain" onClick={() => change({ ...scene, props: scene.props?.map((p) => ({ ...p, keys: dropKey(p.keys, time) })).map(clean), lights: scene.lights?.map((l) => ({ ...l, keys: dropKey(l.keys, time) })).map(clean), ...(scene.backdrop ? { backdrop: clean({ ...scene.backdrop, keys: dropKey(scene.backdrop.keys, time) }) } : {}) } as GreyScene, true)}>Remove key here</button>}
            </div>
            <p className="gs-note gw-source-note">{showOriginal ? "Original source" : "Live preview"} · {shot.heading || "Selected shot"} · Changes save to this shot</p>
          </section>

          <aside className="gs-side" aria-label={STEPS[here]!.label}>
            {step !== "set" && <h2>{STEPS[here]!.label}</h2>}
            {step !== "set" && <p className="gs-says">{STEPS[here]!.says}</p>}
            {step === "set" && <div className="gw-inspector-tabs">{([["objects","Object"],["surface","Area"],["background","Environment"],["lights","Light"],["sets","Looks"]] as const).map(([key,label])=><button className={`pill${task===key?" on":""}`} key={key} aria-pressed={task===key} onClick={()=>setTask(key)}>{label}</button>)}</div>}

            {step === "cut" && (
              <div className="gs-panel">
                {!isVideo ? (
                  <p>The cut-out works on video. This shot is still a picture; animate it in the editor first.</p>
                ) : (
                  <>
                    <label className="gs-field">
                      Who stays?
                      <input type="text" maxLength={120} value={describe} onChange={(e) => setDescribe(e.target.value)} placeholder="the woman in the grey cardigan" />
                      <small>Describe them. It finds them again in every frame, so it follows people who move. Leave it blank to keep every person.</small>
                    </label>
                    <div className="gs-pick">
                      <button className={`pill${picking ? " on" : ""}`} aria-pressed={picking} onClick={() => setPicking((v) => !v)}>{picking ? "Click the actor on the picture…" : "Or click them on the picture"}</button>
                      {dots.length > 0 && <button className="plain" onClick={() => setDots([])}>Clear {dots.length} point{dots.length === 1 ? "" : "s"}</button>}
                    </div>
                    {dots.length > 0 && <p className="gs-soft">A click marks the same spot in every frame, so it works best for people who stay roughly in place.</p>}
                    <button className="fire" disabled={running} onClick={() => void cutOut()}>
                      {running ? "Cutting out…" : matte ? "Cut out again" : "Cut out the actor"} {price && <span className="cost">{price}</span>}
                    </button>
                  </>
                )}
                {matte && (
                  <div className="gs-done" role="status">
                    <b>Cut out.</b> Saved on this shot ({matte.price}). The set builds around them.
                  </div>
                )}
                {problem && <p className="library-error" role="alert">{problem}</p>}
                <BuildLink className="plain" href="/workflows/replace-background" label="the Grey Room">Quick: replace the background in one step</BuildLink>
              </div>
            )}

            {step === "set" && <SetPanel compact taskChoice={task} scene={shown} places={places} props={accessories} actors={actors} vertical={vertical} footageUrl={footage?.url ?? null} isVideo={isVideo} others={project.shots.filter((x) => x.id !== shotId).length} selected={selected} onSelect={selectItem} onChange={edit} onReplace={(n) => change(n, true)} onUseEverywhere={useEverywhere} />}
            {step === "render" && <RenderPanel advanced={advanced} scene={scene} project={project} shot={shot} places={places} onTake={addTakeHere} />}

            <div className={`gs-nav${step === "set" ? " gw-hidden" : ""}`}>
              <button className="pill" disabled={here === 0} onClick={() => { setStep(STEPS[here - 1]!.id); setSelected(null); }}>Back</button>
              <button className="fire" disabled={here === STEPS.length - 1} onClick={() => { setStep(STEPS[here + 1]!.id); setSelected(null); }}>{step === "set" ? "Review & render →" : "Next"}</button>
            </div>
          </aside>
        </div>
        )}
        {step !== "blockout" && <footer className="gw-film-footer"><div className="gw-shot-strip"><span>Shots</span>{project.shots.map((s,i)=><Link key={s.id} className={s.id===shotId?'on':''} href={`/board/${id}/grey/${s.id}${boardId?`?b=${boardId}`:''}`}><b>{String(i+1).padStart(2,'0')}</b>{s.render?.kind==='video'?<video src={`${s.render.url}#t=${Math.max(0,s.trimIn??0)+0.1}`} muted preload="metadata"/>:s.render?<img src={s.render.url} alt=""/>:null}<span>{s.heading||`Shot ${i+1}`}<small>{s.seconds??4}s</small></span></Link>)}<Link className="gw-back-cut" href={back}>Open film editor <StudioIcon name="arrow-right"/></Link></div><SceneTimeline scene={scene} seconds={seconds} time={time} selected={selected} onSelect={item=>{selectItem(item);setStep('set');}} onTime={t=>{setPlaying(false);setTime(t);}} /></footer>}
      </div>
    </div>
  );
}
