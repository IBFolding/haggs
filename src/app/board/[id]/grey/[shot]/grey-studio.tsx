"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { openKeys } from "../../../../nav";
import { loadBank } from "../../../../bank-picker";
import { quoteWorkflow, runWorkflow, type Quote } from "../../../../workflow-actions";
import { actorMattePrompt, MATTE_INPUT, type Point } from "../../../../../comfy/actor-matte";
import { Nav } from "../../../../nav";
import { MediaThumb } from "../../../../media-thumb";
import { AssetsPanel, type AssetTab } from "./assets-panel";
import { Compositor } from "./compositor";
import { CutoutPanel } from "./cutout-panel";
import { GreyRoom } from "../../cut/grey";
import { Inspector } from "./inspector";
import { RenderPanel } from "./render-panel";
import { createHistory, dropKey, keyTimes, mergeEdit, normalizeScene, removeLight, removeProp, resolveScene, type GreyScene } from "../../../../../story/grey-scene";
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
 * The Grey Room: take one shot of filmed footage and build a new set around the
 * people in it, in one workspace. The shelf on the left holds everything you can
 * bring in, the picture is in the middle, and the right side changes to whatever
 * you have selected. The steps along the top are a guide, not gates: each one
 * takes you to the right place, and shows what is already done.
 * The original footage is never touched; the result comes back to the editor
 * as a new take.
 */

type StepId = "blockout" | "cut" | "set" | "light" | "render";
const STEPS: { id: StepId; label: string }[] = [
  { id: "blockout", label: "Blockout" },
  { id: "cut", label: "Cut out" },
  { id: "set", label: "Set" },
  { id: "light", label: "Air and look" },
  { id: "render", label: "Render" },
];

const clean = <T extends { keys?: unknown }>(item: T): T => { if (item.keys === undefined) { const { keys: _k, ...rest } = item; return rest as T; } return item; };

const money = (n: number) => creditsText(n);
export function GreyStudio({ id, shotId, boardId }: { id: string; shotId: string; boardId?: string | undefined }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const saves = useMemo(() => createSaveQueue(store), [store]);
  const full = useRef<Project | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<"scene" | "blockout">("scene");
  const [tab, setTab] = useState<AssetTab>("room");
  const [drawer, setDrawer] = useState(false);
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
      const first = normalizeScene(board.shots.find((x) => x.id === shotId)?.greyScene);
      history.current = createHistory<GreyScene>(first);
      setSceneState(first);
      const start = first.source ?? board.shots.find((x) => x.id === shotId)?.render;
      setTab(start?.kind === "video" && !first.matte ? "actors" : "room");
    });
    void loadBank().then((all) => { setPlaces(all.filter((i) => i.kind === "place")); setAccessories(all.filter((i) => i.kind === "accessory" && i.image)); setActors(all.filter(i => i.kind === "character" && i.image)); });
  }, [store, id, boardId, shotId]);

  // What the cut-out will cost on Comfy.
  useEffect(() => {
    void quoteWorkflow({ file: JSON.stringify(actorMattePrompt({ describe: "person" })) }, {}).then(setQuote);
  }, []);

  const shot: Shot | undefined = project?.shots.find((s) => s.id === shotId);
  const back = `/board/${id}/cut${boardId ? `?b=${boardId}` : ""}`;

  /** Writes the scene onto the shot and saves the project. */
  function persist(next: GreyScene) {
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? { ...x, greyScene: next } : x)) };
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  /** Any other change to this shot (its grey blockout, an approval, a new picture), saved by this page. */
  function updateShot(change: (x: Shot) => Shot) {
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? change(x) : x)) };
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  /** A finished render becomes a new take on this shot, saved by this page so nothing else overwrites it. */
  function addTakeHere(url: string, usd: number, origin: string) {
    if (shot?.render && !scene.source) change({ ...scene, source: { url: shot.render.url, kind: shot.render.kind } }, true);
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? addTake(x, { url, kind: "video", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, origin) : x)) };
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  /** Every change shows at once. It counts as one undo step when you let go, or a moment after the last slider move. */
  function change(next: GreyScene, commitNow = false) {
    setShowOriginal(false);
    setSceneState(next);
    clearTimeout(settle.current);
    const done = () => { history.current.push(next); persist(next); bump((n) => n + 1); };
    if (commitNow) done();
    else settle.current = setTimeout(done, 500);
  }

  /** Puts a saved set on every other shot of this board. Each keeps its own cut-out. */
  function useEverywhere(saved: SavedSet) {
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? x : { ...x, greyScene: applySet(normalizeScene(x.greyScene), saved) })) };
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
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (e.key === "Escape") { if (drawer) setDrawer(false); else setSelected(null); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const prop = scene.props?.find((p) => p.id === selected);
        const lamp = scene.lights?.find((l) => l.id === selected);
        if (prop && !prop.locked) { e.preventDefault(); change(removeProp(scene, selected), true); setSelected(null); }
        else if (lamp) { e.preventDefault(); change(removeLight(scene, selected), true); setSelected(null); }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // Picking something on the picture opens its place on the shelf.
  useEffect(() => {
    if (!selected) return;
    const prop = scene.props?.find((p) => p.id === selected);
    if (prop) setTab(prop.role === "actor" ? "actors" : "objects");
    else if (scene.surfaces?.some((x) => x.id === selected)) setTab("surfaces");
    else if (scene.lights?.some((l) => l.id === selected)) setTab("lights");
    else if (selected === "backdrop") setTab("room");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

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
    if (!project || !shot?.render) return;
    setRunning(true);
    setProblem(null);
    const footage = scene.source?.url ?? shot.render.url;
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
    change({ ...scene, matte: { url: r.url, at: Date.now(), price: r.price } }, true);
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

  const footage = scene.source ?? shot.render;
  const vertical = (project.aspect ?? "16:9") === "9:16";
  const matte = scene.matte;
  const shown = resolveScene(scene, time);
  const marks = keyTimes(scene);
  const isVideo = footage?.kind === "video";
  const seconds = shot.seconds ?? 4;
  const price = !quote ? null : quote.perSecond && quote.min > 0 ? `about ${money(quote.min * seconds)} for ${Math.round(seconds)}s` : quote.label;

  const done: Record<StepId, boolean> = {
    blockout: Boolean(shot.grey),
    cut: Boolean(matte),
    set: Boolean(scene.backdrop || scene.props?.length || scene.surfaces?.some((x) => x.mask)),
    light: Boolean(scene.lights?.length || scene.look || scene.atmos?.some((a) => a.amount > 0)),
    render: false,
  };
  // The next thing worth doing: the first step not finished, leaving out the optional blockout and the cut-out on a still picture.
  const next: StepId = (["cut", "set", "light"] as const).find((id) => !done[id] && (id !== "cut" || isVideo)) ?? "render";
  function go(id: StepId) {
    setSelected(null);
    if (id === "blockout") return setMode("blockout");
    setMode("scene");
    if (id === "render") return setDrawer(true);
    setTab(id === "cut" ? "actors" : id === "set" ? "room" : "lights");
  }
  const shotLink = (id2: string) => `/board/${id}/grey/${id2}${boardId ? `?b=${boardId}` : ""}`;
  const strip = project.shots.filter((x) => x.render);

  return (
    <div className="app">
      <Nav current="Editor" />
      <div className="canvas gw-canvas">
        <div className="gw">
          <header className="gw-head">
            <Link className="plain" href={back}>← Back to the cut</Link>
            <h1>Grey Room</h1>
            <span className="gs-shot" title={shot.beat}>{shot.heading || shot.beat.slice(0, 60)}</span>
            <div className="gw-seg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={mode === "scene"} className={mode === "scene" ? "on" : ""} onClick={() => setMode("scene")} title="Build the set around your footage">Scene</button>
              <button role="tab" aria-selected={mode === "blockout"} className={mode === "blockout" ? "on" : ""} onClick={() => { setMode("blockout"); setSelected(null); }} title="Work out the camera, the figures and the light in grey, for free">Blockout</button>
            </div>
            <span className="gs-tools">
              <button className="pill" onClick={undo} disabled={!history.current.canUndo} title="Undo (⌘Z)">Undo</button>
              <button className="pill" onClick={redo} disabled={!history.current.canRedo} title="Redo (⇧⌘Z)">Redo</button>
              <button className={`pill${showOriginal ? " on" : ""}`} aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)} title="Hold your original footage up against the set">Compare original</button>
              <button className="fire" onClick={() => setDrawer(true)} title="Make a draft, relight, make it real, or take it into Blender">Render</button>
            </span>
          </header>

          <ol className="gs-steps gw-guide" aria-label="Where you are">
            {STEPS.map((s2, i) => (
              <li key={s2.id}>
                <button className={`gs-step${(s2.id === "blockout" && mode === "blockout") ? " on" : ""}${done[s2.id] ? " past" : ""}${next === s2.id && mode === "scene" ? " next" : ""}`} aria-current={next === s2.id && mode === "scene" ? "step" : undefined} onClick={() => go(s2.id)}>
                  <i>{done[s2.id] ? "✓" : i + 1}</i>{s2.label}
                </button>
              </li>
            ))}
          </ol>

          {mode === "blockout" ? (
            <div className="gs-blockout gw-blockout">
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
                <button className="pill on" onClick={() => go("cut")}>Next: Cut out →</button>
              </div>
            </div>
          ) : (
            <div className="gw-main">
              <aside className="gw-left" aria-label="Library">
                <AssetsPanel
                  tab={tab}
                  onTab={setTab}
                  scene={shown}
                  places={places}
                  props={accessories}
                  actors={actors}
                  vertical={vertical}
                  footageUrl={footage?.url ?? null}
                  isVideo={isVideo}
                  others={project.shots.filter((x) => x.id !== shotId).length}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={edit}
                  onReplace={(n) => change(n, true)}
                  onUseEverywhere={useEverywhere}
                  cutout={<CutoutPanel isVideo={isVideo} matte={matte} describe={describe} onDescribe={setDescribe} picking={picking} onPicking={setPicking} dots={dots} onClearDots={() => setDots([])} running={running} price={price} problem={problem} onCutOut={() => void cutOut()} />}
                />
              </aside>

              <section className="gw-center" aria-label="Preview">
                <div ref={stage} className={`gw-stage${picking ? " picking" : ""}`} onClick={pick}>
                  {footage ? (
                    <Compositor
                      scene={showOriginal ? {} : shown}
                      footage={footage}
                      actorUrl={!showOriginal && matte ? matte.url : null}
                      vertical={vertical}
                      selected={selected}
                      editing={showOriginal || picking ? null : "all"}
                      time={time}
                      playing={playing}
                      seconds={seconds}
                      onTime={setTime}
                      onSelect={setSelected}
                      onChange={(n, commit) => change(mergeEdit(scene, shown, n, time, animate), commit)}
                    />
                  ) : <p className="gs-note">This shot has no footage yet.</p>}
                  {scene.backdrop && !matte && !showOriginal && footage?.kind === "video" && <span className="gs-chip warn">Background replacement needs a subject cut-out. Surface edits keep the original shot.</span>}
                  {picking && !matte && dots.map((d, i) => <i key={i} className="gs-dot" style={{ left: `${d.fx * 100}%`, top: `${d.fy * 100}%` }}>{i + 1}</i>)}
                </div>
                <div className="gs-time gw-time" aria-label="Playhead">
                  <button className="pill" onClick={() => { if (!playing && time >= seconds - 0.05) setTime(0); setPlaying((p) => !p); }}>{playing ? "Pause" : "Play"}</button>
                  <div className="gs-track">
                    <input type="range" min={0} max={seconds} step={0.05} value={Math.min(time, seconds)} aria-label="Time" onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }} />
                    {marks.map((m) => <i key={m} className={`gs-key${Math.abs(m - time) < 0.05 ? " on" : ""}`} style={{ left: `${(m / seconds) * 100}%` }} title={`Key at ${m}s`} onClick={() => { setPlaying(false); setTime(m); }} />)}
                  </div>
                  <span className="gs-clock">{time.toFixed(1)}s</span>
                  <button className={`pill${animate ? " on" : ""}`} aria-pressed={animate} onClick={() => setAnimate((a) => !a)} title="While on, moving something at this moment makes it move over time">{animate ? "Animating" : "Animate"}</button>
                  {marks.some((m) => Math.abs(m - time) < 0.05) && <button className="plain" onClick={() => change({ ...scene, props: scene.props?.map((p) => ({ ...p, keys: dropKey(p.keys, time) })).map(clean), lights: scene.lights?.map((l) => ({ ...l, keys: dropKey(l.keys, time) })).map(clean), ...(scene.backdrop ? { backdrop: clean({ ...scene.backdrop, keys: dropKey(scene.backdrop.keys, time) }) } : {}) } as GreyScene, true)}>Remove key here</button>}
                </div>
                <p className="gs-note">{showOriginal ? "Your original footage." : "Live composite preview. Added images remain flat layers until cut out."} Your footage is never changed; the result comes back as a new take.</p>
                {strip.length > 1 && (
                  <ol className="gw-shots" aria-label="Shots in this cut">
                    {strip.map((x, i) => (
                      <li key={x.id} className={x.id === shotId ? "on" : ""}>
                        <Link href={shotLink(x.id)} aria-current={x.id === shotId ? "page" : undefined} title={x.heading || x.beat}>
                          <MediaThumb url={x.render!.url} kind={x.render!.kind} />
                          <small>{i + 1}</small>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <aside className="gw-right" aria-label="Controls">
                <Inspector scene={shown} selected={selected} onSelect={setSelected} onChange={edit} footageUrl={footage?.url ?? null} isVideo={isVideo} places={places} props={accessories} />
              </aside>
            </div>
          )}
        </div>
      </div>

      {/* Stays mounted when closed, so a draft or a pass that is still running is not lost. */}
      <aside className={`gw-drawer${drawer ? " open" : ""}`} aria-label="Render and export" aria-hidden={!drawer} {...(drawer ? {} : { inert: true })}>
        <header><h2>Render and export</h2><button className="plain" onClick={() => setDrawer(false)} aria-label="Close">Close</button></header>
        <div className="gw-drawer-body"><RenderPanel scene={scene} project={project} shot={shot} places={places} onTake={addTakeHere} /></div>
      </aside>
      {drawer && <button className="gw-scrim" aria-label="Close render panel" onClick={() => setDrawer(false)} />}
    </div>
  );
}
