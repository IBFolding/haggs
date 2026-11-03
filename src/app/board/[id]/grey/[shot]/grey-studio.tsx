"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "../../../../../activity/activity";
import { openKeys } from "../../../../nav";
import { loadBank } from "../../../../bank-picker";
import type { Quote } from "../../../../workflow-actions";
import { quoteGreyLocalWorkflow as quoteWorkflow, runGreyLocalWorkflow as runWorkflow } from "../../../../grey-legacy-actions";
import { actorMattePrompt, MATTE_INPUT, type Point } from "../../../../../comfy/actor-matte";
import { Nav } from "../../../../nav";
import { MediaThumb } from "../../../../media-thumb";
import { AssetsPanel, type AssetTab } from "./assets-panel";
import { Compositor } from "./compositor";
import { sceneForShot } from "../../../../../story/grey-source";
import { finishCutout, undoPending, restoreGreyEdit, sameGreyEdit, type GreyEditState } from "../../../../../story/grey-edit-safety";
import { CutoutPanel } from "./cutout-panel";
import { GreyRoom } from "../../cut/grey";
import { Inspector } from "./inspector";
import { LayersPanel, addImageLayer } from "./layers-panel";
import { StepCard, type StepTile } from "./step-card";
import { LOOKS } from "./light-panel";
import { GreyMovesPanel } from "../../cut/grey-moves-panel";
import { checkDrop } from "../../../../../story/drop-files";
import { defaultGrey, tidy } from "../../../../../story/grey";
import { MoreOptions, usePersistedFlag } from "./collapsible";
import { GreySpendingPanel } from "../../cut/grey-spending-panel";
import { DropError, DropOverlay, useFileDrop } from "../../../../drop-zone";
import { uploadFile } from "../../../../upload-client";
import { RenderPanel } from "./render-panel";
import { addLight, createHistory, dropKey, keyTimes, mergeEdit, normalizeScene, removeLight, removeProp, replaceRoomSource, resolveScene, setLook, type GreyScene } from "../../../../../story/grey-scene";
import type { BankItem } from "../../../../../story/bank";
import { commit, view } from "../../../../../story/boards";
import { defaultKv, idbKv } from "../../../../../story/kv";
import type { Project, Shot } from "../../../../../story/model";
import { createProjectStore } from "../../../../../story/store";
import { applySet, type SavedSet } from "../../../../../story/set-bank";
import { appendGreySetupShot } from "../../../../../story/grey-setup-shot";
import { addGreyTake } from "../../../../../story/grey-take";
import { addTake, takesOf } from "../../../../../story/takes";
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

const STEP_COPY: Record<StepId, { title: string; says: string; now: string }> = {
  blockout: { title: "Blockout", says: "Choose the room your actor stands in.", now: "pick the room your actor stands in." },
  cut: { title: "Cut out", says: "Isolate your actor from the background.", now: "remove the background from your actor." },
  set: { title: "Set", says: "Position and scale your actor and props.", now: "place your actor and props in the scene." },
  light: { title: "Air and look", says: "Set the light, mood and visual look for the shot.", now: "dial in the lighting, atmosphere and look." },
  render: { title: "Render", says: "Make a draft, relight, make it real or take it into Blender.", now: "render your shot." },
};

const clean = <T extends { keys?: unknown }>(item: T): T => { if (item.keys === undefined) { const { keys: _k, ...rest } = item; return rest as T; } return item; };

const money = (n: number) => creditsText(n);
export function GreyStudio({ id, shotId, boardId }: { id: string; shotId: string; boardId?: string | undefined }) {
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const saveFailed=useRef(false),durableFailed=useRef(false);
  const durableStore=useMemo(()=>createProjectStore(idbKv()),[]);
  const [saveIssue,setSaveIssue]=useState("");
  const saves = useMemo(() => createSaveQueue(store,600,()=>{saveFailed.current=true;setSaveIssue("Changes could not be saved. Keep this page open and retry.");},()=>{if(!durableFailed.current){saveFailed.current=false;setSaveIssue("");}}), [store]);
  const [draftHeading,setDraftHeading]=useState("");
  const [draftBeat,setDraftBeat]=useState("");
  const [createdDraft,setCreatedDraft]=useState<string|null>(null);
  const [shotBusy,setShotBusy]=useState(false);
  const shotPending=useRef(false);
  const full = useRef<Project | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<"scene" | "blockout">("scene");
  const [tab, setTab] = useState<AssetTab>("room");
  const [drawer, setDrawer] = useState(false);
  const [step, setStep] = useState<StepId | null>(null);
  const [leftOpen, setLeftOpen] = usePersistedFlag("haggs.grey.left", true);
  const [rightOpen, setRightOpen] = usePersistedFlag("haggs.grey.right", true);
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
  const roomInput = useRef<HTMLInputElement>(null);
  const objectInput = useRef<HTMLInputElement>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [scene, setSceneState] = useState<GreyScene>({});
  const liveScene = useRef<GreyScene>({});
  const liveGrey=useRef<GreyEditState["grey"]>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const history = useRef(createHistory<GreyEditState>({grey:undefined,scene:{}}));
  const [, bump] = useState(0);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animate, setAnimate] = useState(false);
  // A room photo dragged in from the desktop. It uses the same upload and the same set-the-source step as the Room tab. Nothing paid runs.
  const stageDrop = useFileDrop({ kinds: ["image"] }, (files) => void dropRoom(files[0]!), false);
  async function dropRoom(file: File) {
    const r = await uploadFile(file);
    if (!r.ok) return stageDrop.setError(r.reason);
    if (r.kind !== "image") return stageDrop.setError("Choose a room photo.");
    change(replaceRoomSource(liveScene.current, { url: r.url, kind: "image" }), true);
    setSelected(null);
  }

  useEffect(() => {
    void store.load(id).then((found) => {
      if (!found) return setMissing(true);
      full.current = found;
      const board = view(found, boardId);
      setProject(board);
      const first = sceneForShot(board.shots.find((x) => x.id === shotId));
      liveScene.current = first;
      liveGrey.current=board.shots.find(x=>x.id===shotId)?.grey;
      history.current = createHistory<GreyEditState>({grey:liveGrey.current,scene:first});
      setSceneState(first);
      const start = first.source ?? board.shots.find((x) => x.id === shotId)?.render;
      setMode(start?"scene":"blockout");setCreatedDraft(null);setDraftBeat("");
      setDraftHeading(`${board.shots.find(x=>x.id===shotId)?.heading||"Shot"} — next`.slice(0,160));
      setTab(start?.kind === "video" && !first.matte ? "actors" : "room");
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
  function persist(next: GreyEditState) {
    if (!full.current) return;
    const current = view(full.current, boardId);
    const updated: Project = { ...current, shots: current.shots.map(x => x.id === shotId ? restoreGreyEdit(x,next) : x) };
    full.current = commit(full.current, boardId, updated);
    setProject(updated);
    saves.queue(full.current);
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

  /** The general workspace can fall back to memory; navigation requires a real IndexedDB write. */
  async function flushDurably() {
    try {
      let snapshot:Project|null;
      do {await saves.flush();snapshot=full.current;if(snapshot)await durableStore.save(snapshot);}while(full.current!==snapshot);
      durableFailed.current=false;saveFailed.current=false;setSaveIssue("");
    }catch{durableFailed.current=true;saveFailed.current=true;throw Error("Changes could not be saved to local storage. Keep this page open and retry.");}
  }
  async function retrySave() {
    if(shotPending.current)return;shotPending.current=true;setShotBusy(true);
    try{await flushDurably();}catch(e){setSaveIssue((e as Error).message);}finally{shotPending.current=false;setShotBusy(false);}
  }
  async function saveAndOpen(target:string) {
    if(shotPending.current)return;shotPending.current=true;setShotBusy(true);
    try{await flushDurably();if(!saveFailed.current)window.location.assign(`/board/${encodeURIComponent(id)}/grey/${encodeURIComponent(target)}${boardId?`?b=${encodeURIComponent(boardId)}`:""}`);}
    catch(e){setSaveIssue((e as Error).message);}
    finally{shotPending.current=false;setShotBusy(false);}
  }
  async function createSetupShot() {
    if(shotPending.current||!full.current)return;shotPending.current=true;setShotBusy(true);
    try {
      await flushDurably();
      if(!createdDraft){const result=appendGreySetupShot(full.current,boardId,shotId,liveScene.current,draftHeading,draftBeat);full.current=result.project;setProject(view(result.project,boardId));setCreatedDraft(result.shot.id);saves.queue(result.project);}
      await flushDurably();
    } catch(e){setSaveIssue((e as Error).message);}
    finally{shotPending.current=false;setShotBusy(false);}
  }

  /** A finished render becomes a new take on this shot, saved by this page so nothing else overwrites it. */
  function addTakeHere(url: string, usd: number, origin: string) {
    if (shot?.render && !scene.source) change({ ...scene, source: { url: shot.render.url, kind: shot.render.kind } }, true);
    setProject((current) => {
      if (!current) return current;
      const updated: Project = { ...current, shots: current.shots.map((x) => (x.id === shotId ? addTake(x, { url, kind: "video", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, origin, liveScene.current) : x)) };
      saves.queue((full.current = commit(full.current ?? updated, boardId, updated)));
      return updated;
    });
  }

  /** Every change shows at once. It counts as one undo step when you let go, or a moment after the last slider move. */
  function changeState(next:GreyEditState,commitNow=false) {
    if(sameGreyEdit(next,{grey:liveGrey.current,scene:liveScene.current}))return;
    clearTimeout(settle.current);
    // A discrete AI/apply edit must not swallow an earlier slider edit still waiting to settle.
    if(commitNow&&pending.current)history.current.push({grey:liveGrey.current,scene:liveScene.current});
    setShowOriginal(false);liveGrey.current=next.grey;liveScene.current=next.scene;
    setSceneState(next.scene);persist(next);
    const done=()=>{pending.current=false;history.current.push(next);bump(n=>n+1);};
    if(commitNow)done();else{pending.current=true;settle.current=setTimeout(done,500);}
  }
  function change(next: GreyScene, commitNow = false) {changeState({grey:liveGrey.current,scene:next},commitNow);}
  function restoreState(next:GreyEditState) {
    liveGrey.current=next.grey;liveScene.current=next.scene;setSceneState(next.scene);setSelected(null);persist(next);bump(n=>n+1);
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
    const prev = undoPending(history.current, pending.current ? {grey:liveGrey.current,scene:liveScene.current} : undefined);
    pending.current = false;
    if (prev) restoreState(prev);
  }
  function redo() {
    if (pending.current) return;
    const next = history.current.redo();
    if (next) restoreState(next);
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
    const requestedSource = liveScene.current.source;
    const footage = requestedSource?.url ?? shot.render.url;
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
    const current = liveScene.current;
    const result = finishCutout(current, requestedSource, { url: r.url, at: Date.now(), price: r.price });
    if (!result) return setProblem("The source changed while the cut-out was running. The result was not applied; please run it again for the current source.");
    change(result, true);
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
  const current: StepId = step ?? (footage ? next : "blockout");
  function go(id: StepId) {
    setSelected(null);
    setStep(id);
    setMode("scene");
    setTab(id === "blockout" ? "room" : id === "cut" ? "actors" : id === "set" ? "objects" : "lights");
  }
  const swatchOf = (l: { warmth: number; saturation: number }) => l.warmth > 0.3 ? "linear-gradient(135deg,#f4b062,#8a4b2a)" : l.warmth < -0.3 ? "linear-gradient(135deg,#5b8fd0,#1d2c4a)" : l.saturation < -0.2 ? "linear-gradient(135deg,#a8a8a0,#4a4a46)" : "linear-gradient(135deg,#9a9a9a,#444)";
  function chooseRoom(list: FileList | null) { const r = checkDrop(Array.from(list ?? []), { kinds: ["image"] }); stageDrop.setError(r.error); if (r.accepted[0]) void dropRoom(r.accepted[0]); }
  async function chooseObject(list: FileList | null) {
    const r = checkDrop(Array.from(list ?? []), { kinds: ["image"] });
    if (!r.accepted[0]) return stageDrop.setError(r.error);
    const res = await addImageLayer(r.accepted[0], liveScene.current, "object");
    if (!res.ok) return stageDrop.setError(res.reason);
    change(res.scene, true); setSelected(res.selected);
  }
  const openDrawer = () => setDrawer(true);
  let primary: { label: string; onClick: () => void; disabled?: boolean; note?: string | undefined };
  let tiles: StepTile[];
  if (current === "blockout") {
    primary = { label: "Choose room photo", onClick: () => roomInput.current?.click() };
    tiles = [{ id: "blockout", label: "Grey blockout", icon: "areas", onClick: () => setMode("blockout") }];
  } else if (current === "cut") {
    primary = { label: running ? "Cutting out…" : matte ? "Cut out again" : "Auto cut out", onClick: () => void cutOut(), disabled: running || !isVideo, note: !isVideo ? "The cut-out works on video. This shot is a picture." : price ? `Cost: ${price}` : undefined };
    tiles = [{ id: "pick", label: "Pick actor", icon: "pick", on: picking, onClick: () => setPicking(!picking) }, { id: "orig", label: "Show original", icon: "original", on: showOriginal, onClick: () => setShowOriginal((v) => !v) }];
  } else if (current === "set") {
    primary = { label: "Add an object", onClick: () => objectInput.current?.click() };
    tiles = (["objects", "actors", "surfaces"] as const).map((t) => ({ id: t, label: t === "objects" ? "Objects" : t === "actors" ? "Actors" : "Areas", icon: t === "surfaces" ? "areas" : t, on: tab === t, onClick: () => setTab(t) }));
  } else if (current === "light") {
    primary = { label: "Add a key light", onClick: () => { const n = addLight(liveScene.current, "key"); change(n, true); setSelected(n.lights!.at(-1)!.id); } };
    tiles = LOOKS.map((l) => ({ id: l.name, label: l.name, swatch: swatchOf(l.look), on: scene.look ? JSON.stringify(scene.look) === JSON.stringify(l.look) : false, onClick: () => change(setLook(liveScene.current, l.look), true) }));
  } else {
    primary = { label: "Render shot", onClick: openDrawer };
    tiles = [{ id: "draft", label: "Draft (fast)", icon: "draft", onClick: openDrawer }, { id: "final", label: "Final", icon: "final", onClick: openDrawer }, { id: "up", label: "Upscale (4K)", icon: "upscale", onClick: openDrawer }];
  }
  const shotLink = (id2: string) => `/board/${id}/grey/${id2}${boardId ? `?b=${boardId}` : ""}`;
  const strip = project.shots.filter((x) => x.render);

  return (
    <div className="app">
      <Nav current="Editor" />
      <div className="canvas gw-canvas">
        <div className="gw" aria-busy={shotBusy} inert={shotBusy?true:undefined}>
          <header className="gw-head">
            <Link className="plain" href={back}>← Back to the cut</Link>
            <h1>Grey Room</h1>
            <span className="gs-shot" title={shot.beat}>{shot.heading || shot.beat.slice(0, 60)}</span>
            <div className="gw-seg" role="tablist" aria-label="View">
              <button role="tab" aria-selected={mode === "scene"} className={mode === "scene" ? "on" : ""} onClick={() => setMode("scene")} title="Build the set around your footage">Scene</button>
              <button role="tab" aria-selected={mode === "blockout"} className={mode === "blockout" ? "on" : ""} onClick={() => { setMode("blockout"); setSelected(null); }} title="Work out the camera, the figures and the light in grey, for free">Blockout</button>
            </div>
            <details className="gr-shot-tools">
            <summary>Shots and setup</summary><div className="gr-shot-pop">
            <label>Open shot<select aria-label="Open Grey Room shot" value={shotId} disabled={shotBusy} onChange={e=>void saveAndOpen(e.target.value)}>{project.shots.map((s,i)=><option key={s.id} value={s.id}>{i+1}. {s.heading||"Untitled shot"}{s.render?"":" · draft"}</option>)}</select></label>
            <p>Create a draft with this room, people, props, materials and camera. Footage, masks, takes and approvals stay on the original shot.</p>
            <label>New shot name<input aria-label="New setup shot name" maxLength={160} value={draftHeading} disabled={shotBusy||!!createdDraft} onChange={e=>setDraftHeading(e.target.value)}/></label>
            <label>What happens in the new shot?<textarea aria-label="New setup shot action" maxLength={4000} value={draftBeat} disabled={shotBusy||!!createdDraft} placeholder="Optional — leave blank to keep this shot's action" onChange={e=>setDraftBeat(e.target.value)}/></label>
            {!createdDraft&&<button className="pill" disabled={shotBusy||!draftHeading.trim()} onClick={()=>void createSetupShot()}>{shotBusy?"Saving…":"Create draft from this setup"}</button>}
            {createdDraft&&<p role="status">{saveIssue?"Draft is kept in this session until saving succeeds.":"Draft created."} <button className="pill" disabled={shotBusy||!!saveIssue} onClick={()=>void saveAndOpen(createdDraft)}>Open new draft</button><button className="plain" disabled={shotBusy||!!saveIssue} onClick={()=>{setCreatedDraft(null);setDraftBeat("");}}>Create another</button></p>}
          </div></details>
            <span className="gs-tools">
              <button className="pill" onClick={undo} disabled={!pending.current && !history.current.canUndo} title="Undo (⌘Z)">Undo</button>
              <button className="pill" onClick={redo} disabled={pending.current || !history.current.canRedo} title="Redo (⇧⌘Z)">Redo</button>
              <button className={`pill${showOriginal ? " on" : ""}`} aria-pressed={showOriginal} onClick={() => setShowOriginal((v) => !v)} title="Hold your original footage up against the set">Compare original</button>
              <button className="fire" onClick={() => setDrawer(true)} title="Make a draft, relight, make it real, or take it into Blender">Render</button>
              <GreySpendingPanel />
            </span>
          </header>

          {saveIssue&&<p role="alert">{saveIssue} <button className="pill" disabled={shotBusy} onClick={()=>void retrySave()}>Retry save</button></p>}
          <ol className="gs-steps gw-guide" aria-label="Where you are">
            {STEPS.map((s2, i) => (
              <li key={s2.id}>
                <button className={`gs-step${(mode === "scene" && current === s2.id) ? " on" : ""}${done[s2.id] ? " past" : ""}${next === s2.id && mode === "scene" ? " next" : ""}`} aria-current={mode === "scene" && current === s2.id ? "step" : undefined} onClick={() => go(s2.id)}>
                  <i>{done[s2.id] ? "✓" : i + 1}</i>{s2.label}
                </button>
              </li>
            ))}
          </ol>
          <p className="gw-now" role="status"><b>Now:</b> {mode === "blockout" ? "work out the camera and stand-ins in grey. It costs nothing." : STEP_COPY[current].now}</p>

          {mode === "blockout" ? (
            <div className="gs-blockout gw-blockout">
              <GreyRoom
                key={shot.id}
                hideSpending
                shot={shot}
                scene={scene}
                onScene={s => change(s)}
                onDesign={(grey,nextScene)=>changeState({grey,scene:nextScene},true)}
                vertical={vertical}
                names={project.threads.filter((t) => t.kind === "character" && shot.threadIds.includes(t.id)).map((t) => t.name)}
                onGrey={(grey)=>changeState({grey,scene:liveScene.current})}
                onApprove={() => updateShot((x) => ({ ...x, approved: true }))}
                onTake={(url, usd, guideScene, guideFrame, guideTime) => updateShot((x) => addGreyTake(x, { url, kind: "image", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, "Grey room", guideScene ?? liveScene.current, liveScene.current, guideFrame, guideTime))}
                onShot={(url, usd, guideScene, guideFrame, guideTime, seconds) => updateShot((x) => addGreyTake(x, { url, kind: "video", usd, promptHash: x.render?.promptHash ?? "", at: Date.now() }, "Grey room shot", guideScene ?? liveScene.current, liveScene.current, guideFrame, guideTime, seconds))}
              />
              <div className="gs-nav">
                <span />
                <button className="pill on" onClick={() => go("cut")}>Next: Cut out →</button>
              </div>
            </div>
          ) : (
            <div className="gw-main">
              <aside className={`gw-left${leftOpen ? "" : " folded"}`} aria-label="Layers and assets">
                <button type="button" className="gw-side-toggle" aria-expanded={leftOpen} onClick={() => setLeftOpen(!leftOpen)} title={leftOpen ? "Fold the layers panel" : "Open the layers panel"} aria-label={leftOpen ? "Fold the layers panel" : "Open the layers panel"}>{leftOpen ? "«" : "»"}</button>
                <div hidden={!leftOpen}><LayersPanel scene={shown} selected={selected} onSelect={setSelected} onChange={edit} accessories={accessories} /></div>
              </aside>

              <section className="gw-center" aria-label="Preview">
                <div ref={stage} className={`gw-stage dz-host${stageDrop.active ? " over" : ""}${picking ? " picking" : ""}`} onClick={pick} {...stageDrop.props}>
                  <DropOverlay active={stageDrop.active} label="Drop to use as the room photo" />
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
                  {current === "blockout" && !stageDrop.active && <span className="gw-drop-hint" aria-hidden="true">Drop a room photo here</span>}
                  <span className="gw-ratio" aria-hidden="true">{vertical ? "9:16" : "16:9"}</span>
                  {scene.backdrop && !matte && !showOriginal && footage?.kind === "video" && <span className="gs-chip warn">Background replacement needs a subject cut-out. Surface edits keep the original shot.</span>}
                  {picking && !matte && dots.map((d, i) => <i key={i} className="gs-dot" style={{ left: `${d.fx * 100}%`, top: `${d.fy * 100}%` }}>{i + 1}</i>)}
                </div>
                <DropError error={stageDrop.error} />
                {(() => {
                  const names = project.threads.filter((t) => t.kind === "character" && shot.threadIds.includes(t.id)).map((t) => t.name);
                  const base = shot.grey ?? defaultGrey(names.length ? names : ["Subject"]);
                  return (
                    <section className="gw-camrow" aria-label="Camera move">
                      <h3>Camera move</h3>
                      <GreyMovesPanel compact cam={base.cam} subjects={base.subjects} onApply={(keys) => changeState({ grey: tidy({ ...base, camKeys: keys, subjects: base.subjects, light: base.light }), scene: liveScene.current }, true)} />
                    </section>
                  );
                })()}
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

              <StepCard
                index={STEPS.findIndex((x) => x.id === current) + 1}
                title={STEP_COPY[current].title}
                says={STEP_COPY[current].says}
                open={rightOpen}
                onToggle={() => setRightOpen(!rightOpen)}
                primary={primary}
                tiles={tiles}
                more={<>
                  <AssetsPanel
                    tab={tab}
                    onTab={setTab}
                    scene={shown}
                    savedScene={scene}
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
                  <MoreOptions label="Selected layer and scene look" open={Boolean(selected) || current === "light"}>
                    <Inspector scene={shown} selected={selected} onSelect={setSelected} onChange={edit} footageUrl={footage?.url ?? null} isVideo={isVideo} places={places} props={accessories} />
                  </MoreOptions>
                  {current === "blockout" && <button type="button" className="pill" onClick={() => setMode("blockout")} title="Work out the camera, the figures and the light in grey, for free">Open the grey blockout</button>}
                </>}
              >
                {current === "render" && (
                  <section className="gw-versions" aria-label="Result versions">
                    <h3>Result versions</h3>
                    {takesOf(shot).length === 0 ? <p className="gs-soft">Nothing rendered yet.</p> : (
                      <ul>{[...takesOf(shot)].reverse().slice(0, 4).map((t, i, all) => (
                        <li key={t.id}><span className="gw-ver-thumb"><MediaThumb url={t.url} kind={t.kind} /></span><b>v{takesOf(shot).length - i}</b><span>{t.origin ?? "Take"}</span>{all.length > 0 && <small>{t.url === shot.render?.url ? "On the shot" : ""}</small>}</li>
                      ))}</ul>
                    )}
                  </section>
                )}
              </StepCard>
              <input ref={roomInput} type="file" accept="image/*" hidden aria-label="Choose room photo" onChange={(e) => { chooseRoom(e.target.files); e.target.value = ""; }} />
              <input ref={objectInput} type="file" accept="image/*" hidden aria-label="Add an object picture" onChange={(e) => { void chooseObject(e.target.files); e.target.value = ""; }} />
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
