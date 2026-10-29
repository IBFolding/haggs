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
import { LightPanel } from "./light-panel";
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
  { id: "light", label: "Air and look", says: "Place lights, set the colour of the frame and what is in the air." },
  { id: "render", label: "Review & export", says: "Check the set, then make a new take for the cut." },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const clean = <T extends { keys?: unknown }>(item: T): T => { if (item.keys === undefined) { const { keys: _k, ...rest } = item; return rest as T; } return item; };

const money = (n: number) => creditsText(n);
export function GreyStudio({ id, shotId, boardId }: { id: string; shotId: string; boardId?: string | undefined }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const saves = useMemo(() => createSaveQueue(store), [store]);
  const full = useRef<Project | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState<StepId>("set");
  const [places, setPlaces] = useState<BankItem[]>([]);
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
    });
    void loadBank().then((all) => { setPlaces(all.filter((i) => i.kind === "place")); setAccessories(all.filter((i) => i.kind === "accessory" && i.image)); });
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
    <div className="app">
      <Nav current="Editor" />
      <div className="gs">
        <header className="gs-head">
          <Link className="plain" href={back}>← Back to the cut</Link>
          <h1>Grey Room</h1>
          <span className="gs-shot" title={shot.beat}>{shot.heading || shot.beat.slice(0, 60)}</span>
          <span className="gs-tools">
            <button className="pill" onClick={undo} disabled={!history.current.canUndo} title="Undo (⌘Z)">Undo</button>
            <button className="pill" onClick={redo} disabled={!history.current.canRedo} title="Redo (⇧⌘Z)">Redo</button>
            <button className={`pill${showOriginal ? " on" : ""}`} aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)} title="Hold your original footage up against the set">Compare original</button>
          </span>
        </header>

        <ol className="gs-steps" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button className={`gs-step${s.id === step ? " on" : ""}${i < here ? " past" : ""}`} aria-current={s.id === step ? "step" : undefined} onClick={() => { setStep(s.id); setSelected(null); }}>
                <i>{i + 1}</i>{s.label}
              </button>
            </li>
          ))}
        </ol>

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
        <div className="gs-body">
          <section className="gs-stage" aria-label="Preview">
            <div ref={stage} className={`gs-pickwrap${picking ? " picking" : ""}`} onClick={pick}>
              {footage ? (
                <Compositor
                  scene={showOriginal ? {} : shown}
                  footage={footage}
                  actorUrl={!showOriginal && matte ? matte.url : null}
                  vertical={vertical}
                  selected={selected}
                  editing={showOriginal ? null : step === "set" ? "props" : step === "light" ? "lights" : null}
                  time={time}
                  playing={playing}
                  seconds={seconds}
                  onTime={setTime}
                  onSelect={setSelected}
                  onChange={(next, commit) => change(mergeEdit(scene, shown, next, time, animate), commit)}
                />
              ) : <p className="gs-note">This shot has no footage yet.</p>}
              {step !== "cut" && !matte && !showOriginal && footage?.kind === "video" && <span className="gs-chip warn">Background replacement needs a subject cut-out. Surface edits keep the original shot.</span>}
              {step === "cut" && !matte && dots.map((d, i) => <i key={i} className="gs-dot" style={{ left: `${d.fx * 100}%`, top: `${d.fy * 100}%` }}>{i + 1}</i>)}
            </div>
            <div className="gs-time" aria-label="Playhead">
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
          </section>

          <aside className="gs-side" aria-label={STEPS[here]!.label}>
            <h2>{here + 1}. {STEPS[here]!.label}</h2>
            <p className="gs-says">{STEPS[here]!.says}</p>

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

            {step === "set" && <SetPanel scene={shown} places={places} props={accessories} vertical={vertical} footageUrl={footage?.url ?? null} isVideo={isVideo} others={project.shots.filter((x) => x.id !== shotId).length} selected={selected} onSelect={setSelected} onChange={edit} onReplace={(n) => change(n, true)} onUseEverywhere={useEverywhere} />}
            {step === "light" && <LightPanel scene={shown} selected={selected} onSelect={setSelected} onChange={edit} />}
            {step === "render" && <RenderPanel scene={scene} project={project} shot={shot} places={places} onTake={addTakeHere} />}

            <div className="gs-nav">
              <button className="pill" disabled={here === 0} onClick={() => { setStep(STEPS[here - 1]!.id); setSelected(null); }}>Back</button>
              <button className="fire" disabled={here === STEPS.length - 1} onClick={() => { setStep(STEPS[here + 1]!.id); setSelected(null); }}>Next</button>
            </div>
          </aside>
        </div>
        )}
      </div>
    </div>
  );
}
