"use client";
import {prepareCutMedia} from "../../../prepare-cut-media";

import { ReframePanel } from "./reframe-panel";
import { reframeStyle } from "../../../../story/reframe";
import { EditorDialog } from "./editor-dialog";
import { PassPanel } from "./pass-panel";
import { ContinuityPanel } from "./continuity-panel";
import { Section } from "./section";
import { ReviewPanel } from "./review-panel";
import { ExportTargets } from "./export-targets";
import { presetById } from "../../../../story/export-presets";
import { LookPicker } from "./fx-picker";
import { MediaThumb } from "../../../media-thumb";
import { galleryShot } from "../../../gallery-log";
import { track as inHeader } from "../../../../activity/activity";
import { useReturnedPick } from "../../../bank-picker";
import type { BankItem } from "../../../../story/bank";
import { listVersions, removeVersion, restoreVersion, saveVersion, type Version } from "../../../../story/versions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { atTime, buildCut, cutList, ffmpegScript, captionSpan } from "../../../../story/cut";
import { fcpxml } from "../../../../story/fcpxml";
import { needsApproval, tidy } from "../../../../story/grey";
import { GreyRoom, GreySequence } from "./grey";
import { Tracks, usePreviewSound, VoiceLines, VoiceMix } from "./sound";
import { moveShot, newShot, setLook, type Shot } from "../../../../story/model";
import { LookBar } from "../../../look-picker";
import { bridgeFrames, bridgingShot } from "../../../../story/bridge";
import { cloudEstimate } from "../../../../providers/cloud-price";
import { frameAt, makeCard, makeTitle } from "../../../cut-actions";
import { addMarker, editMarker, removeMarker, stepMarker } from "../../../../story/markers";
import { reshootFrameAt } from "../../../../story/reshoot";
import { ReshootPanel } from "../../../reshoot-panel";
import { addTake, chooseTake, cycleTake, removeTake, splitShot, takesOf, toggleFavorite, trimHead, trimTail } from "../../../../story/takes";
import { shoot } from "../../../shoot";
import { EditTools } from "./tools";
import { defaultKv } from "../../../../story/kv";
import type { Project } from "../../../../story/model";
import { commit, view } from "../../../../story/boards";
import { addCutdown } from "../../../../story/cutdown";
import { createProjectStore } from "../../../../story/store";
import { createSaveQueue } from "../../../../story/use-autosave";
import { Nav, openKeys } from "../../../nav";
import { PROJECT_SAVED } from "../../../agent";
import { ProjectTabs } from "../../../project-tabs";
import { creditsText } from "../../../../story/price-text";

function clock(seconds: number): string {
  const whole = Math.max(0, seconds);
  const m = Math.floor(whole / 60);
  const s = whole - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  // Attached before the click and revoked on a later tick, for the same reasons
  // as the project export: Firefox ignores a detached anchor, and revoking on
  // the same tick can cancel the download before the blob is read.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function Editor({ id, boardId, classic = false, renderEnabled = false }: { id: string; boardId?: string | undefined; classic?: boolean; renderEnabled?: boolean }) {
  /** The whole project; the state below is one board's view of it. */
  const full = useRef<Project | null>(null);
  const kv = useMemo(() => defaultKv(), []);
  const store = useMemo(() => createProjectStore(kv), [kv]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const saveFailed = useRef(false);
  const saves = useMemo(() => createSaveQueue(store, 600, () => {saveFailed.current=true;setSaveState("failed");}, () => {saveFailed.current=false;setSaveState("saved");}), [store]);
  const saveBeforeGrey = async () => {await saves.flush();return !saveFailed.current;};
  useEffect(() => {
    const flush = () => { void saves.flush(); };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); void saves.flush(); };
  }, [saves]);
  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const [mode, setMode] = useState<"simple" | "advanced">("advanced");
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const timelineScroll = useRef(0);
  const toolsScroll = useRef(0);
  const [showAllLanes, setShowAllLanes] = useState(false);
  const [laneRequest,setLaneRequest]=useState({name:"",count:0});
  useEffect(()=>{if(!laneRequest.count)return;const frame=requestAnimationFrame(()=>{const selector=laneRequest.name==="music"?".music-maker input":laneRequest.name==="effects"?'[aria-label="Describe a sound effect"]':laneRequest.name==="titles"?'[aria-label="Title words"]':".voices-head button";document.querySelector<HTMLElement>(selector)?.focus()});return()=>cancelAnimationFrame(frame)},[laneRequest]);
  const [revealedLanes, setRevealedLanes] = useState<string[]>([]);
  useEffect(() => {
    try {
      setMode(localStorage.getItem("haggs.cut.view") === "simple" ? "simple" : "advanced");
      setShowAllLanes(localStorage.getItem("haggs.cut.allLanes") === "true");
      setTimelineCollapsed(localStorage.getItem("haggs.cut.timelineCollapsed") === "true");
      setToolsCollapsed(localStorage.getItem("haggs.cut.toolsCollapsed") === "true");
    } catch { /* Storage restrictions must not block editing. */ }
  }, []);
  const changeMode = (next: "simple" | "advanced") => {
    setMode(next);
    try { localStorage.setItem("haggs.cut.view", next); } catch { /* Session-only preference. */ }
  };
  const advanced = classic || mode === "advanced";
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [t, setT] = useState(0);
  const [card, setCard] = useState<{ text: string; sub: string; busy: boolean } | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionName, setVersionName] = useState("");
  const router = useRouter();
  // Back from building a character, place or accessory: it goes in as a reference, on the Edit tab.
  const [bankPick, setBankPick] = useState<BankItem | null>(null);
  useReturnedPick(["character", "place", "accessory"], (item) => { setMode("advanced"); setTab("tools"); setBankPick(item); });
  const [win, setWin] = useState<{ from: number; to: number | null; name: string; problem: string }>({ from: 0, to: null, name: "", problem: "" });
  const [markerEdit, setMarkerEdit] = useState<string | null>(null);
  const [fxDrag, setFxDrag] = useState<{ id: string; start: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const tRef = useRef(0);
  const track = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // The producer changed this project from the chat: load it again, so this page's next save keeps the change.
  useEffect(() => {
    const reload = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== id) return;
      void store.load(id).then((found) => {
        if (!found) return;
        full.current = found;
        setProject(view(found, boardId));
      });
    };
    window.addEventListener(PROJECT_SAVED, reload);
    return () => window.removeEventListener(PROJECT_SAVED, reload);
  }, [store, id, boardId]);

  useEffect(() => {
    void store.load(id).then((found) => {
      if (found) {
        full.current = found;
        setProject(view(found, boardId));
      } else setMissing(true);
    });
  }, [store, id, boardId]);

  const cut = useMemo(() => (project ? buildCut(project) : null), [project]);
  const here = cut ? atTime(cut, t) : null;
  usePreviewSound(cut, t, playing);
  const [rendering, setRendering] = useState(false);
  /** Preview only: hide the words laid over the picture so you can watch it clean. The render still has them. */
  const [showText, setShowText] = useState(true);
  /** The preview, with its captions, overlays and look, fills the screen. Esc leaves it. */
  const toggleFullscreen = useCallback(() => {
    const el = viewRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void el.requestFullscreen?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === viewRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  /** Export only: draw the captions into the picture. Off, they ship as a separate subtitle file. */
  const [burn, setBurn] = useState(false);
  const [rendered, setRendered] = useState<{ url: string; srt?: string } | { reason: string } | null>(null);

  const seek = useCallback((to: number) => {
    tRef.current = to;
    setT(to);
  }, []);

  // The clock is the master and the video follows it, so a scrub or a clip
  // change cannot leave the picture and the playhead disagreeing.
  useEffect(() => {
    if (!playing || !cut) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const next = tRef.current + (now - last) / 1000;
      last = now;
      if (next >= cut.total) {
        seek(cut.total);
        setPlaying(false);
        return;
      }
      seek(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, cut, seek]);

  const clipId = here?.clip.shotId;
  // Where in the footage we are: a trimmed or split shot starts partway in.
  const offset = (here?.clip.from ?? 0) + (here?.offset ?? 0);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (Math.abs(el.currentTime - offset) > 0.35) el.currentTime = offset;
    if (playing && el.paused) void el.play().catch(() => undefined);
    if (!playing && !el.paused) el.pause();
  }, [clipId, offset, playing]);

  /** Undo and redo: every edit remembers the board before it. Edits within 600ms of each other (a slider, a drag) count as one. */
  const past = useRef<Project[]>([]);
  const future = useRef<Project[]>([]);
  const lastEdit = useRef(0);
  const [historyTick, setHistoryTick] = useState(0);
  // The latest board, readable outside React's updaters (which run twice in development and so can't change history).
  const now = useRef<Project | null>(null);
  useEffect(() => { now.current = project; }, [project]);
  useEffect(() => { void listVersions(kv, id, boardId).then(setVersions); }, [kv, id, boardId]);
  /** Any edit to the board from the editor, saved the same way the board saves. */
  const apply = useCallback(
    (change: (current: Project) => Project) => {
      const current = now.current;
      if (!current) return;
      const next = change(current);
      if (next === current) return;
      const t0 = Date.now();
      if (t0 - lastEdit.current > 600 || past.current.length === 0) past.current = [...past.current.slice(-99), current];
      lastEdit.current = t0;
      future.current = [];
      now.current = next;
      setProject(next);
      setHistoryTick((n) => n + 1);
      setSaveState("saving");
      saves.queue((full.current = commit(full.current ?? next, boardId, next)));
    },
    [saves, boardId],
  );
  const travel = useCallback(
    (dir: "undo" | "redo") => {
      const from = dir === "undo" ? past : future;
      const to = dir === "undo" ? future : past;
      const current = now.current;
      const target = from.current.at(-1);
      if (!current || !target) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, current];
      lastEdit.current = 0;
      now.current = target;
      setProject(target);
      setHistoryTick((n) => n + 1);
      setSaveState("saving");
      saves.queue((full.current = commit(full.current ?? target, boardId, target)));
    },
    [saves, boardId],
  );
  const onShot = useCallback(
    (shotId: string, change: (shot: Shot) => Shot) =>
      apply((current) => ({ ...current, shots: current.shots.map((s) => (s.id === shotId ? change(s) : s)) })),
    [apply],
  );
  const [rolling, setRolling] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** Where the film is going; sets the loudness Render MP4 levels to. */
  const [target, setTarget] = useState<string | null>(null);
  async function rollAgain(shotId: string) {
    if (!project) return;
    setProblem(null);
    setRolling(shotId);
    const result = await inHeader({ label: `Shot ${project.shots.findIndex((s) => s.id === shotId) + 1}`, href: `/board/${project.id}/cut`, failure: (x) => (x.ok ? null : x.reason), after: galleryShot(project.shots.find((s) => s.id === shotId)?.beat ?? "", project.shots.find((s) => s.id === shotId)?.model?.id ?? "") }, () => shoot(project, project.shots.findIndex((s) => s.id === shotId)));
    setRolling(null);
    if (!result.ok) {
      if (result.needsKey) openKeys();
      setProblem(result.reason);
      return;
    }
    onShot(shotId, (s) => addTake(s, result.render, result.origin));
  }

  /** Bridge to the next shot, or extend this one: frames taken, a shot made between, rendered as its first take. */
  const [expanding, setExpanding] = useState<string | null>(null);
  const expandPrice = cloudEstimate({ seconds: 4, resolution: "768P", references: 0 });
  async function expand(shotId: string, mode: "bridge" | "extend") {
    const latest = full.current ? view(full.current, boardId) : project;
    if (!latest) return;
    setProblem(null);
    setExpanding(`${shotId}:${mode}`);
    try {
      const plan = bridgeFrames(latest, shotId, mode);
      const start = await frameAt(plan.start.url, plan.start.at, plan.start.kind);
      if (!start.ok) throw new Error(start.reason);
      const end = plan.end ? await frameAt(plan.end.url, plan.end.at, plan.end.kind) : null;
      if (end && !end.ok) throw new Error(end.reason);
      const made = bridgingShot(latest.shots[plan.insertAt - 1]!, start, end && end.ok ? end : null, plan.nextBeat);
      const shots = [...latest.shots];
      shots.splice(plan.insertAt, 0, made);
      const placed = { ...latest, shots };
      apply(() => placed);
      setPicked(made.id);
      const result = await inHeader({ label: `New shot between`, href: `/board/${placed.id}/cut`, failure: (x) => (x.ok ? null : x.reason), after: galleryShot(placed.shots[plan.insertAt]?.beat ?? "", placed.shots[plan.insertAt]?.model?.id ?? "") }, () => shoot(placed, plan.insertAt));
      if (!result.ok) {
        if (result.needsKey) openKeys();
        throw new Error(`The new shot is on the board, but it didn't render: ${result.reason}`);
      }
      onShot(made.id, (s) => addTake(s, result.render, result.origin));
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "That couldn't be made.");
    } finally {
      setExpanding(null);
    }
  }

  /** Keep a reshoot as the next shot: its picture on a new shot straight after this one, ready to animate. */
  function keepReshoot(shotId: string, made: { url: string; usd: number; label: string }) {
    const source = project?.shots.find((x) => x.id === shotId);
    if (!source) return;
    const next: Shot = { ...newShot(), heading: source.heading, beat: `${source.beat.split(" — ")[0]} (${made.label})`, threadIds: [...source.threadIds], seconds: source.seconds ?? 3, model: source.model, ...(source.refs?.length ? { refs: [...source.refs] } : {}), render: { url: made.url, kind: "image", usd: made.usd, promptHash: "", at: Date.now() } };
    apply((current) => {
      const i = current.shots.findIndex((x) => x.id === shotId);
      const shots = [...current.shots];
      shots.splice(i + 1, 0, next);
      return { ...current, shots };
    });
    setPicked(next.id);
  }

  /** A title card at the playhead: words on black, placed after the shot it falls in (or at the end). */
  async function addCard() {
    if (!card || !project || !card.text.trim()) return;
    setCard({ ...card, busy: true });
    const made = await makeCard(card.text, card.sub, project.aspect ?? "16:9");
    if (!made.ok) {
      setProblem(made.reason);
      return setCard({ ...card, busy: false });
    }
    const shot: Shot = { ...newShot(), heading: card.text.trim().slice(0, 40), beat: `Title card: ${card.text.trim()}`, seconds: 3, render: { url: made.url, kind: "image", usd: 0, promptHash: "", at: Date.now() }, locked: true };
    const here2 = cut ? atTime(cut, tRef.current) : null;
    apply((current) => {
      const i = here2 ? current.shots.findIndex((x) => x.id === here2.clip.shotId) : current.shots.length - 1;
      const shots = [...current.shots];
      shots.splice(i + 1, 0, shot);
      return { ...current, shots };
    });
    setPicked(shot.id);
    setCard(null);
  }

  // Dragging a clip on the timeline moves its shot on the board.
  const dragged = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<string | null>(null);
  const dropOn = (targetId: string) => {
    const from = dragged.current;
    dragged.current = null;
    setDropAt(null);
    if (!from || from === targetId) return;
    apply((current) => {
      const a = current.shots.findIndex((s) => s.id === from);
      const b = current.shots.findIndex((s) => s.id === targetId);
      return a < 0 || b < 0 ? current : { ...current, shots: moveShot(current.shots, a, b) };
    });
  };

  const setSeconds = useCallback(
    (shotId: string, seconds: number | null) => apply((current) => ({ ...current, shots: current.shots.map((s) => (s.id === shotId ? { ...s, seconds } : s)) })),
    [apply],
  );

  // The timeline is drawn at a zoom (pixels per second), so every clip has a width you can see and grab.
  const [pps, setPps] = useState(36);
  const [cutdownOpen, setCutdownOpen] = useState(false);
  const [cutdownBusy, setCutdownBusy] = useState(false);
  const [tab, setTab] = useState<"shot" | "reshoot" | "voice" | "tools" | "sound" | "titles" | "review" | "passes">("shot");
  /** Reshoot has two ways in: from the footage you have, or blocked out in grey first. */
  const [reshootMode, setReshootMode] = useState<"footage" | "grey">("footage");
  const [title, setTitle] = useState({ text: "", place: "lower" as "lower" | "center" | "top", seconds: 3, busy: false, problem: "" });
  const laneNames = ["voice", "effects", "music", "titles"];
  const counts = [cut?.voices.length ?? 0, project?.effects?.length ?? 0, project?.music ? 1 : 0, project?.overlays?.length ?? 0];
  const visibleLanes = laneNames.filter((name, i) => classic || showAllLanes || (counts[i] ?? 0) > 0 || revealedLanes.includes(name));
  const laneTop = (name: string) => 128 + visibleLanes.indexOf(name) * 36;
  const laneHeight = 128 + visibleLanes.length * 36;
  const scroller = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);

  const scrub = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!cut || !lane.current) return;
      const box = lane.current.getBoundingClientRect();
      seek(Math.min(cut.total, Math.max(0, (event.clientX - box.left) / pps)));
    },
    [cut, seek, pps],
  );

  const fit = useCallback(() => {
    if (!cut || !scroller.current) return;
    setPps(Math.min(160, Math.max(6, (scroller.current.clientWidth - 40) / cut.total)));
  }, [cut]);

  // While it plays, keep the playhead in view.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const x = t * pps;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 80) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
  }, [t, pps, playing]);

  // Space plays and pauses; ← → step half a second (a hold of shift, five); unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented) return;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if ((e.key === " " || e.key === "Enter") && el?.closest("button, summary, a[href]")) return;
      if (!cut) return;
      const mod = e.metaKey || e.ctrlKey;
      const at = () => atTime(cut, tRef.current);
      const edit = (change: (p: Project, shotId: string, offset: number) => Project) => {
        const here2 = at();
        if (!here2) return;
        try {
          apply((current) => change(current, here2.clip.shotId, Math.round(here2.offset * 30) / 30));
        } catch (caught) {
          setProblem(caught instanceof Error ? caught.message : "That edit couldn't be made.");
        }
      };
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        travel(e.shiftKey ? "redo" : "undo");
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        travel("redo");
      } else if (mod) return;
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        const at = Math.round(tRef.current * 10) / 10;
        apply((current) => {
          const next = addMarker(current, at, "", cut.total);
          const added = next.markers!.find((m) => m.at === at && !(current.markers ?? []).some((c) => c.id === m.id));
          if (added) setMarkerEdit(added.id);
          return next;
        });
      } else if (e.key === "," || e.key === ".") {
        const to = stepMarker(now.current ?? ({ markers: [] } as unknown as Project), tRef.current, e.key === "." ? 1 : -1);
        if (to !== null) seek(to);
      } else if (e.key.toLowerCase() === "s") edit(splitShot);
      else if (e.key.toLowerCase() === "i") edit(trimHead);
      else if (e.key.toLowerCase() === "o") edit(trimTail);
      else if (e.key === "ArrowRight") seek(Math.min(cut.total, tRef.current + (e.shiftKey ? 5 : 0.5)));
      else if (e.key === "ArrowLeft") seek(Math.max(0, tRef.current - (e.shiftKey ? 5 : 0.5)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cut, seek, apply, travel]);

  if (missing) {
    return (
      <div className="app">
        <Nav current="Projects" />
        <div className="canvas">
          <div className="library">
            <div className="library-blank">
              <p>That project isn&rsquo;t here.</p>
              <p className="library-blank-sub">
                It may have been deleted, or made in another browser.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project || !cut) return <div className="app"><Nav current="Projects" /></div>;

  const selected = cut.clips.find((c) => c.shotId === picked) ?? here?.clip ?? null;
  const shot = selected ? project.shots.find((s) => s.id === selected.shotId) : undefined;

  const idxHere = cut.clips.findIndex((c) => c.shotId === here?.clip.shotId);
  const jump = (to: number) => {
    const c = cut.clips[Math.min(cut.clips.length - 1, Math.max(0, to))];
    if (c) {
      setPicked(c.shotId);
      seek(c.start);
    }
  };
  const tick = pps >= 80 ? 1 : pps >= 30 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(cut.total / tick) + 1 }, (_, i) => i * tick);
  const vertical = cut.aspect === "9:16";

  const previewStyle = here && (here.clip.fit === "fill" || here.clip.reframe) ? { objectFit: "cover" as const, objectPosition: `${(here.clip.focus?.x ?? 0.5) * 100}% ${(here.clip.focus?.y ?? 0.5) * 100}%`, ...(here.clip.reframe ? reframeStyle(here.clip.reframe,here.offset) : {}) } : undefined;

  const exportsBar = (
    <>
      {renderEnabled && (
        <button
          className="fire ed-render"
          disabled={rendering}
          onClick={async () => {
            setRendering(true);
            setRendered(null);
            // Tracked in the header, so you can leave this page and still see when it's done.
            const body = await inHeader(
              { label: `Rendering ${project.name}`, href: `/board/${project.id}/cut`, result: (b) => (b?.ok && b.url ? { url: b.url } : null), failure: (b) => (b?.ok && b.url ? null : (b?.reason ?? "The render didn't finish.")) },
              async () => {
                let renderable;
                try { renderable=await prepareCutMedia(cut); } catch(error) { return {ok:false,reason:error instanceof Error?error.message:"Images could not be prepared for export. Your edit is unchanged."}; }
                const res = await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: project.name, cut: target && presetById(target) ? { ...renderable, loudness: presetById(target)!.loudness } : renderable, burn }) }).catch(() => null);
                return (await res?.json().catch(() => null)) as { ok?: boolean; url?: string; reason?: string; srt?: string } | null;
              },
            );
            setRendered(body?.ok && body.url ? { url: body.url, ...(body.srt ? { srt: body.srt } : {}) } : { reason: body?.reason ?? "The render didn't finish." });
            setRendering(false);
          }}
        >
          {rendering ? "Rendering…" : "Render MP4"}
        </button>
      )}
      {renderEnabled && cut.clips.some((c) => c.caption) && (
        <label className="ed-burn" title="Off: the film is clean and the captions come as a subtitle file you can edit. On: they're drawn into the picture.">
          <input type="checkbox" checked={burn} onChange={(e) => setBurn(e.target.checked)} />
          Burn captions in
        </label>
      )}
      <details className="ed-more" hidden={!advanced} open={cutdownOpen} onToggle={e => setCutdownOpen(e.currentTarget.open)}>
        <summary>Cutdown</summary>
        {cutdownOpen && <EditorDialog label="Cutdown" onClose={() => setCutdownOpen(false)}><div>
          <p>A shorter cut from part of this one, on its own board. This cut stays exactly as it is.</p>
          {(() => {
            const total = Math.round(cut.total * 10) / 10;
            const to = win.to ?? total;
            const len = Math.max(0, Math.round((to - win.from) * 10) / 10);
            const tick = (n: number) => `${Math.min(100, Math.max(0, (n / Math.max(total, 0.1)) * 100))}%`;
            const clip = (n: number) => Math.min(total, Math.max(0, Math.round(n * 10) / 10));
            return (
              <div className="cd">
                <div className="cd-bar" aria-hidden="true"><i style={{ left: tick(win.from), width: `calc(${tick(to)} - ${tick(win.from)})` }} /><span style={{ left: tick(t) }} /></div>
                <div className="cd-grid">
                  <label>From<span><input type="number" min={0} max={total} step={0.1} value={win.from} onChange={(e) => setWin({ ...win, from: clip(Number(e.target.value) || 0) })} /><em>s</em></span><button className="plain" onClick={() => setWin({ ...win, from: clip(t) })}>Use playhead</button></label>
                  <label>To<span><input type="number" min={0} max={total} step={0.1} value={to} onChange={(e) => setWin({ ...win, to: clip(Number(e.target.value) || 0) })} /><em>s</em></span><button className="plain" onClick={() => setWin({ ...win, to: clip(t) })}>Use playhead</button></label>
                </div>
                <div className="cd-presets">
                  <small>{len}s of {total}s</small>
                  {[15, 30, 60].filter((n) => n < total).map((n) => <button key={n} className="plain" onClick={() => setWin({ ...win, from: 0, to: clip(n) })}>First {n}s</button>)}
                  <button className="plain" onClick={() => setWin({ ...win, from: clip(t), to: total })}>Playhead to end</button>
                </div>
              </div>
            );
          })()}
          <form className="cd-make" onSubmit={async (e) => {
            e.preventDefault();
            const f = full.current; const cur = now.current;
            if (!f || !cur || cutdownBusy) return;
            setCutdownBusy(true);
            try {
              const made = addCutdown(f, boardId, cur, win.name.trim() || `Cutdown ${win.from}–${win.to ?? Math.round(cut.total * 10) / 10}s`, win.from, win.to ?? cut.total);
              saves.queue(made.project);
              setSaveState("saving");
              await saves.flush();
              const saved = await store.load(id);
              if (!saved?.boards?.some((board) => board.id === made.board.id)) throw new Error("The new board could not be saved. Your original cut is unchanged. Try again.");
              full.current = saved;
              setCutdownOpen(false);
              setPlaying(false);
              seek(0);
              router.push(`/board/${id}/cut?b=${encodeURIComponent(made.board.id)}`);
            } catch (err) {
              setWin({ ...win, problem: err instanceof Error ? err.message : "That window didn't work." });
            } finally { setCutdownBusy(false); }
          }}>
            <input value={win.name} onChange={(e) => setWin({ ...win, name: e.target.value })} placeholder="Name it, e.g. 15s teaser" aria-label="Cutdown name" />
            <button className="fire" type="submit" disabled={cutdownBusy}>{cutdownBusy ? "Saving board…" : "Make a board"}</button>
          </form>
          {win.problem && <p className="library-error" role="alert">{win.problem}</p>}
          <button className="plain" type="button" onClick={() => setCutdownOpen(false)}>Cancel</button>
        </div></EditorDialog>}
      </details>
      <details className="ed-more" hidden={!advanced}>
        <summary>Versions{versions.length ? ` · ${versions.length}` : ""}</summary>
        <div>
          <form className="ed-version-new" onSubmit={(e) => { e.preventDefault(); const cur = now.current; if (!cur) return; void saveVersion(kv, id, boardId, cur, versionName).then(setVersions); setVersionName(""); }}>
            <input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Name this cut, e.g. Director's cut" aria-label="Version name" />
            <button className="plain" type="submit">Save a version</button>
          </form>
          {versions.length === 0 && <p>Save a version before a big change. Restoring one keeps today's cut as a safety copy first.</p>}
          <ul className="ed-versions">
            {versions.map((v) => (
              <li key={v.id}>
                <span>{v.name}<small>{new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{v.auto ? " · safety copy" : ""}</small></span>
                <button className="plain" onClick={() => { const cur = now.current; if (!cur) return; void restoreVersion(kv, id, boardId, v.id, cur).then((out) => { if (!out) return; setVersions(out.versions); apply(() => out.project); }); }}>Restore</button>
                <button className="plain" aria-label={`Delete ${v.name}`} onClick={() => void removeVersion(kv, id, boardId, v.id).then(setVersions)}>×</button>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <details className="ed-more">
        <summary>Export</summary>
        <div>
          <ExportTargets clips={cut.clips} target={target} onTarget={setTarget} apply={apply} onNeedKey={() => openKeys()} />
          <button className="plain" onClick={() => download(`${project.name}.cut.json`, cutList(cut, project.name), "application/json")}>Cut list (.json)</button>
          <button className="plain" disabled={cut.clips.some(c=>c.reframe)} title={cut.clips.some(c=>c.reframe)?"Render the reframe path to MP4 first; XML cannot preserve it yet.":undefined} onClick={() => download(`${project.name}.fcpxml`, fcpxml(cut, project.name, { origin: window.location.origin, markers: project.markers ?? [] }), "application/xml")}>Final Cut / Resolve (.fcpxml)</button>
          <button className="plain" onClick={() => download(`${project.name}.sh`, ffmpegScript(cut, project.name, window.location.origin), "text/x-shellscript")}>ffmpeg script (.sh)</button>
          {cut.clips.some(c=>c.reframe)&&<p role="status">Reframe paths export through Render MP4 and ffmpeg. Render first for Final Cut/Resolve; XML is unavailable while a path is active.</p>}
          <p>Render MP4 makes the film here, voices and soundtrack mixed in, next to your media. The script does the same anywhere ffmpeg is installed.</p>
        </div>
      </details>
    </>
  );

  return (
    <div className="app">
      <Nav current="Projects" />
      <ProjectTabs project={full.current ?? project} boardId={boardId} current="cut" greyShotId={shot?.id ?? here?.clip.shotId} beforeGreyNavigate={saveBeforeGrey} />

      {cut.clips.length === 0 ? (
        <div className="canvas">
          <div className="library-blank">
            <p>Nothing to cut yet.</p>
            <p className="library-blank-sub">
              The cut is made of the shots you have rendered, in board order.{" "}
              <Link href={`/board/${id}`}>Shoot one on the board</Link> and it appears here.
            </p>
          </div>
        </div>
      ) : (
        <div className="ed" data-tools-collapsed={toolsCollapsed} data-view={classic ? "classic" : mode}>
          <aside className="ed-library" aria-label="Shots in this cut">
            <span className="eyebrow muted">Shots</span>
            <ol>
              {cut.clips.map((c, i) => (
                <li key={c.shotId}>
                  <button aria-current={i === idxHere ? "true" : undefined} onClick={() => jump(i)} title={c.heading || `Shot ${c.index + 1}`}>
                    {c.kind === "video" ? <video src={`${c.url}#t=0.3`} muted playsInline preload="metadata" /> : <img src={c.url} alt="" loading="lazy" />}
                    <span><b>{c.heading || `Shot ${c.index + 1}`}</b><small>{c.kind === "video" ? "Video" : "Still"} · {c.seconds.toFixed(1)} s</small></span>
                  </button>
                </li>
              ))}
            </ol>
            {cut.skipped.length > 0 && <small className="ed-library-note">{cut.skipped.length} shot{cut.skipped.length === 1 ? "" : "s"} not shot yet</small>}
            <Link className="ph-ghost" href={`/board/${id}`}>+ Make a new shot</Link>
          </aside>

          <section className="ed-stage-area" aria-label="Preview">
            <div className={`ed-view${fullscreen ? " full" : ""}`} ref={viewRef} onClick={() => fullscreen && setPlaying((p) => !p)}>
              <div className={`stage${vertical ? " vertical" : ""}`} data-fx={here?.clip.fx}>
                {here &&
                  (here.clip.kind === "video" ? (
                    <video key={here.clip.shotId} ref={video} style={previewStyle} src={here.clip.url} playsInline preload="auto" muted={Boolean(project.sound?.clipMute)} onLoadedMetadata={(ev) => { ev.currentTarget.volume = Math.min(1, Math.pow(10, (project.sound?.clipGain ?? 0) / 20)); }} />
                  ) : (
                    <img key={here.clip.shotId} src={here.clip.url} alt={here.clip.heading} style={previewStyle} />
                  ))}
                {here && showText && here.clip.caption && t >= captionSpan(here.clip).start && t < captionSpan(here.clip).end && <span className="stage-caption">{here.clip.caption}</span>}
                {(project.overlays ?? []).filter((o) => t >= o.start && t < o.start + o.seconds).map((o) => <img key={o.id} className="stage-overlay" src={o.url} alt="" />)}
              </div>
            </div>
            {/* Which shot this is, under the picture and never over it. */}
            {here && <p className="stage-slate" title={here.clip.heading}>{here.clip.heading || `Shot ${here.clip.index + 1}`}</p>}
            <div className="ed-transport">
              <button className="pill" onClick={() => jump(idxHere - 1)} aria-label="Previous shot" disabled={idxHere <= 0}>⏮</button>
              <button
                className="fire"
                onClick={() => {
                  if (!playing && t >= cut.total) seek(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : t >= cut.total ? "Replay" : "Play"}
              </button>
              <button className="pill" onClick={() => jump(idxHere + 1)} aria-label="Next shot" disabled={idxHere >= cut.clips.length - 1}>⏭</button>
              <button className="pill" onClick={() => setShowText((v) => !v)} aria-label={showText ? "Captions on" : "Captions off"} aria-pressed={showText} title="Show or hide the captions on the preview. The render keeps them."><span aria-hidden="true">CC</span><span className="ed-control-label">{showText ? "Captions on" : "Captions off"}</span></button>
              <button className="pill" onClick={toggleFullscreen} aria-label="Full screen" aria-pressed={fullscreen} title="Fill the screen with the preview (F). Esc to leave."><span aria-hidden="true">⛶</span><span className="ed-control-label">Full screen</span></button>
              <span className="transport-time">{clock(t)} <i>/</i> {clock(cut.total)}</span>
              {cut.skipped.length > 0 && <span className="transport-note">{cut.skipped.length} shot{cut.skipped.length === 1 ? "" : "s"} not shot yet</span>}
              <span className="ed-spacer" />
              {rendered && ("url" in rendered ? (
                <span className="exports-done" role="status">Rendered. <a href={rendered.url} target="_blank" rel="noreferrer">Watch</a> · <a href={rendered.url} download>Download</a>{rendered.srt && <> · <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(rendered.srt)}`} download={`${project.name}.srt`}>Captions (.srt)</a></>}</span>
              ) : (
                <span className="library-error" role="alert">{rendered.reason}</span>
              ))}
              <span role={saveState === "failed" ? "alert" : "status"}>{saveState === "saved" ? "Saved locally" : saveState === "saving" ? "Saving…" : "Save failed. Retry before leaving."}</span><button className="plain" onClick={() => void saves.flush()}>Save now</button>
              <div className="ed-finish" role="group" aria-label="Finish">{exportsBar}</div>
            </div>
          </section>

          <aside className="ed-side" aria-label="Shot tools" data-collapsed={toolsCollapsed}>
            <button className="plain ed-tools-toggle" aria-expanded={!toolsCollapsed} aria-controls="ed-tools-content" onClick={(e) => {
              e.currentTarget.focus();
              const body = document.querySelector<HTMLElement>(".ed-side-body");
              if (!toolsCollapsed) toolsScroll.current = body?.scrollTop ?? 0;
              setToolsCollapsed(!toolsCollapsed);
              try { localStorage.setItem("haggs.cut.toolsCollapsed", String(!toolsCollapsed)); } catch {}
              if (toolsCollapsed) requestAnimationFrame(() => { if (body) body.scrollTop = toolsScroll.current; });
            }}>{toolsCollapsed ? "Expand Shot tools +" : "Collapse Shot tools −"}</button>
            <div id="ed-tools-content" className="ed-tools-content" hidden={toolsCollapsed}>
            {!classic && <div className="ed-view-switch" role="group" aria-label="Editor view">
              <button className="pill" aria-pressed={mode === "simple"} onClick={() => changeMode("simple")}>Simple view</button>
              <button className="pill" aria-pressed={mode === "advanced"} onClick={() => changeMode("advanced")}>All tools</button>
              <small>View only. Your settings stay applied.</small>
            </div>}
            {!advanced && <p className="takes-note">Advanced settings remain active. All tools shows Reshoot, Edit, Grey Room, versions and markers.{(tab === "tools" || tab === "reshoot") ? " Your open advanced panel is kept until you choose another tab." : ""}</p>}
            <div className="ed-tabs" role="tablist">
              {([["shot", "Shot"], ["reshoot", "Reshoot"], ["voice", "Voice"], ["tools", "Edit"], ["sound", "Sound"], ["titles", "Titles"], ["review", "Review"], ["passes", "Passes"]] as const).filter(([key]) => advanced || !["reshoot", "tools"].includes(key) || key === tab).map(([id2, label]) => (
                <button key={id2} role="tab" aria-selected={tab === id2} className={tab === id2 ? "on" : ""} onClick={(e) => { setTab(id2); e.currentTarget.scrollIntoView({ block: "nearest", inline: "center" }); }}>{label}</button>
              ))}
            </div>
            <div className="ed-side-body">
              {tab === "passes" && shot ? <PassPanel key={shot.id} project={project} shot={shot} onShot={onShot} /> : tab === "review" ? <ReviewPanel shots={project.shots} selectedId={selected?.shotId ?? null} time={Math.max(0, Math.min(selected?.seconds ?? 0, t - (selected?.start ?? 0)))} onShot={onShot} onSelect={(shotId) => { setPicked(shotId); const clip = cut.clips.find(c => c.shotId === shotId); if(clip) seek(clip.start); }} /> : tab === "titles" ? (
                <div className="tracks">
                  <p className="takes-note">Words laid over the picture for a few seconds, from the playhead. Several lines are fine.</p>
                  <textarea value={title.text} rows={3} maxLength={200} onChange={(e) => setTitle({ ...title, text: e.target.value })} placeholder={"ELLIS\nThe night shift"} aria-label="Title words" />
                  <div className="ed-row">
                    <label>Where <select value={title.place} onChange={(e) => setTitle({ ...title, place: e.target.value as typeof title.place })}><option value="lower">Lower left</option><option value="center">Middle</option><option value="top">Top</option></select></label>
                    <label>For <input type="number" min={0.5} max={30} step={0.5} value={title.seconds} onChange={(e) => setTitle({ ...title, seconds: Math.min(30, Math.max(0.5, Number(e.target.value) || 3)) })} />s</label>
                    <button className="pill on" disabled={title.busy || !title.text.trim()} onClick={async () => {
                      setTitle((x) => ({ ...x, busy: true, problem: "" }));
                      const made = await makeTitle(title.text, title.place, project.aspect ?? "16:9");
                      if (!made.ok) return setTitle((x) => ({ ...x, busy: false, problem: made.reason }));
                      apply((c) => ({ ...c, overlays: [...(c.overlays ?? []), { id: crypto.randomUUID(), name: title.text.trim().slice(0, 80), url: made.url, start: Math.round(t * 10) / 10, seconds: title.seconds }] }));
                      setTitle((x) => ({ ...x, busy: false, text: "" }));
                    }}>{title.busy ? "Making…" : "Add at playhead"}</button>
                  </div>
                  {title.problem && <p className="library-error" role="alert">{title.problem}</p>}
                  {(project.overlays ?? []).map((o) => (
                    <div key={o.id} className="trk-fx">
                      <b title={o.name}>{o.name.split("\n")[0]}</b>
                      <label>at <input type="number" min={0} step={0.1} value={o.start} onChange={(e) => apply((c) => ({ ...c, overlays: (c.overlays ?? []).map((x) => (x.id === o.id ? { ...x, start: Math.max(0, Number(e.target.value) || 0) } : x)) }))} /> s</label>
                      <label>for <input type="number" min={0.5} step={0.5} value={o.seconds} onChange={(e) => apply((c) => ({ ...c, overlays: (c.overlays ?? []).map((x) => (x.id === o.id ? { ...x, seconds: Math.max(0.5, Number(e.target.value) || 3) } : x)) }))} /> s</label>
                      <button className="plain danger" onClick={() => apply((c) => { const { overlays: _o, ...rest } = c; const left = (c.overlays ?? []).filter((x) => x.id !== o.id); return left.length ? { ...rest, overlays: left } : rest; })}>Remove</button>
                    </div>
                  ))}
                </div>
              ) : tab === "sound" ? (
                <>
                <Section name="Soundtrack and effects" initial classic={classic} reveal={laneRequest.count}><Tracks
                  filmSeconds={Math.round(cut.total)}
                  sound={project.sound}
                  onSound={(sound) => apply((current) => { const { sound: _old, ...rest } = current; return sound ? { ...rest, sound } : rest; })}
                  effects={project.effects ?? []}
                  onEffects={(effects) => apply((current) => { const { effects: _old, ...rest } = current; return effects.length ? { ...rest, effects } : rest; })}
                  music={project.music}
                  onMusic={(music) => apply((current) => { const { music: _old, ...rest } = current; return music ? { ...rest, music } : rest; })}
                  playhead={t}
                  voices={cut.voices.length}
                />
                </Section><Section name="Voice mix" classic={classic}><VoiceMix
                  sound={project.sound}
                  onChange={(sound) =>
                    apply((current) => {
                      const { sound: _old, ...rest } = current;
                      return sound ? { ...rest, sound } : rest;
                    })
                  }
                />
                </Section></>
              ) : !(selected && shot) ? (
                <p className="takes-note">Click a clip on the timeline to work on that shot.</p>
              ) : (
                <>
                  <h2 className="ed-shot-title"><span>{selected.index + 1}</span>{selected.heading || `Shot ${selected.index + 1}`}<small>{selected.seconds}s</small></h2>
                  {problem && <p className="library-error" role="alert">{problem}</p>}

                  {tab === "shot" && (
                    <>
                      <Section name="Timing" initial classic={classic}>
                      <div className="ed-row">
                        <label>
                          Holds for
                          <input type="number" min={0.5} step={0.5} value={shot.seconds ?? selected.seconds} onChange={(event) => { const value = Number(event.target.value); setSeconds(shot.id, Number.isFinite(value) && value > 0 ? value : null); }} />
                          s
                        </label>
                        {shot.seconds !== null && <button className="plain" onClick={() => setSeconds(shot.id, null)}>Reset</button>}
                        <label className="clip-lock" title="Title cards, black, anything finished: Animate stills leaves it alone">
                          <input type="checkbox" checked={shot.locked === true} onChange={(e) => onShot(shot.id, (s2) => { const { locked: _l, ...rest } = s2; return e.target.checked ? { ...rest, locked: true } : rest; })} />
                          Keep as it is
                        </label>
                      </div>
                      <div className="ed-row">
                        {(["fadeIn", "fadeOut"] as const).map((key) => (
                          <label key={key} title="Dip from, or to, black. Its own sound fades with it.">
                            {key === "fadeIn" ? "Fade in" : "Fade out"}
                            <input type="number" min={0} max={5} step={0.1} value={shot[key] ?? 0} onChange={(e) => { const v = Number(e.target.value); onShot(shot.id, (s2) => { const { [key]: _f, ...rest } = s2; return Number.isFinite(v) && v > 0 ? { ...rest, [key]: Math.min(5, v) } : rest; }); }} />
                            s
                          </label>
                        ))}
                      </div>
                      </Section><Section name="Picture" classic={classic}>
                      <div className="ed-row">
                        <label title="Fit keeps the whole picture and leaves bars. Fill crops it to the frame around the point you pick.">
                          Frame
                          <select value={shot.fit ?? "fit"} onChange={(e) => onShot(shot.id, (s2) => { const { fit: _f, focus: _p, ...rest } = s2; return e.target.value === "fill" ? { ...rest, fit: "fill" as const, ...(s2.focus ? { focus: s2.focus } : {}) } : rest; })}>
                            <option value="fit">Fit (bars)</option>
                            <option value="fill">Fill (crop)</option>
                          </select>
                        </label>
                        {shot.fit === "fill" && (["x", "y"] as const).map((axis) => (
                          <label key={axis}>
                            {axis === "x" ? "Across" : "Down"}
                            <input type="range" min={0} max={1} step={0.05} value={shot.focus?.[axis] ?? 0.5} onChange={(e) => { const v = Number(e.target.value); onShot(shot.id, (s2) => ({ ...s2, focus: { x: s2.focus?.x ?? 0.5, y: s2.focus?.y ?? 0.5, [axis]: v } })); }} />
                          </label>
                        ))}
                      </div>
                      <LookPicker shot={shot} onShot={onShot} onAll={(fx) => apply((current) => ({ ...current, shots: current.shots.map((s2) => { const { fx: _drop, ...rest } = s2; return fx ? { ...rest, fx } : rest; }) }))} />
                      </Section><Section name="Reframe path" classic={classic}><ReframePanel key={shot.id} shot={shot} time={Math.max(0,t-selected.start)} onShot={onShot} onSeek={at=>seek(selected.start+at)} /></Section><Section name="Caption" classic={classic}>
                      <div className="ed-row ed-caption">
                        <label title="Words on screen for this shot. They stay a separate layer: fix them here any time, and burn them in only when you export.">
                          Caption
                          <input type="text" maxLength={140} placeholder="No caption" value={shot.caption ?? ""} onChange={(e) => onShot(shot.id, (s2) => { const { caption: _c, ...rest } = s2; return e.target.value ? { ...rest, caption: e.target.value } : rest; })} />
                        </label>
                        {shot.caption && (["captionAt", "captionFor"] as const).map((key) => (
                          <label key={key} title={key === "captionAt" ? "Seconds into the shot before the caption appears" : "Seconds it stays up. Blank means to the end of the shot."}>
                            {key === "captionAt" ? "Shows at" : "Stays for"}
                            <input type="number" min={0} step={0.1} placeholder={key === "captionAt" ? "0" : "end"} value={shot[key] ?? ""} onChange={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); onShot(shot.id, (s2) => { const { [key]: _k, ...rest } = s2; return v !== null && Number.isFinite(v) && v >= 0 ? { ...rest, [key]: v } : rest; }); }} />
                            s
                          </label>
                        ))}
                      </div>
                      </Section><Section name="Cut tools" initial classic={classic}>
                      <div className="clip-actions">
                        <button className="pill" disabled={!(t > selected.start + 0.2 && t < selected.start + selected.seconds)} title="Cut off the start of this clip at the playhead (I)" onClick={() => apply((current) => trimHead(current, shot.id, Math.round((t - selected.start) * 30) / 30))}>Trim start to playhead</button>
                        <button className="pill" disabled={!(t >= selected.start + 0.2 && t < selected.start + selected.seconds - 0.05)} title="Cut off the end of this clip at the playhead (O)" onClick={() => apply((current) => trimTail(current, shot.id, Math.round((t - selected.start) * 30) / 30))}>Trim end to playhead</button>
                        <button className="pill" disabled={!(t > selected.start + 0.1 && t < selected.start + selected.seconds - 0.1)} title="Move the playhead inside this clip to split it there" onClick={() => apply((current) => splitShot(current, shot.id, Math.round((t - selected.start) * 30) / 30))}>Split at playhead</button>
                        <button className="pill" onClick={() => apply((current) => { const at = current.shots.findIndex((x) => x.id === shot.id); const shots = [...current.shots]; shots.splice(at + 1, 0, { ...newShot(), heading: shot.heading, threadIds: [...shot.threadIds] }); return { ...current, shots }; })}>Insert a shot after</button>
                        <button className="pill" disabled={expanding !== null || !cut.clips.some((c) => c.index > selected.index)} title="A shot between this one and the next: it starts on this shot's last frame and ends on the next one's first" onClick={() => void expand(shot.id, "bridge")}>{expanding === `${shot.id}:bridge` ? "Bridging…" : `Bridge to next · ${creditsText(expandPrice)}`}</button>
                        <button className="pill" disabled={expanding !== null} title="Carry this shot on from its last frame" onClick={() => void expand(shot.id, "extend")}>{expanding === `${shot.id}:extend` ? "Extending…" : `Extend · ${creditsText(expandPrice)}`}</button>
                      </div>
                      </Section><Section name="Continuity" classic={classic}><ContinuityPanel key={shot.id} project={project} shot={shot} onShot={onShot} /></Section><Section name="Look" classic={classic}>
                        <LookBar value={shot.look ?? {}} video onChange={(look) => onShot(shot.id, (s2) => setLook(s2, look))} />
                        <p className="takes-note">Its words go into this shot&rsquo;s prompt. Roll again to get a take with it; the takes you have stay.</p>
                      </Section><Section name="More" classic={classic}>
                        <Link hidden={!advanced} className="pill" href={`/board/${project.id}/grey/${shot.id}${boardId ? `?b=${boardId}` : ""}`} onClick={e=>{e.preventDefault();const href=e.currentTarget.href;void saveBeforeGrey().then(ok=>{if(ok)router.push(href);});}} title="Cut out the actor, build a new set around them, place props and lights, then render a new take">Open in Grey Room</Link>
                        <button className="pill on" disabled={rolling === shot.id || needsApproval(shot)} title={needsApproval(shot) ? "This real take is locked. Approve it under Reshoot → Block out in grey to alter it." : undefined} onClick={() => void rollAgain(shot.id)}>{rolling === shot.id ? "Rolling…" : "Roll again"}</button>
                      </Section>
                      <div className="takes" role="group" aria-label="Takes">
                        {takesOf(shot).map((take, i) => {
                          const on = take.url === shot.render?.url && take.at === shot.render?.at;
                          return (
                            <figure key={take.id} className={`take${on ? " on" : ""}`}>
                              <button className="take-pick" onClick={() => onShot(shot.id, (s2) => chooseTake(s2, take.id))} aria-pressed={on} title={on ? "On the shot" : "Put this take on the shot"}>
                                <MediaThumb url={take.url} kind={take.kind} at={0.3} />
                              </button>
                              <figcaption>
                                <span>Take {i + 1}{take.origin ? ` · ${take.origin}` : ""}{take.usd !== null ? ` · ${creditsText(take.usd)}` : ""}</span>
                                <button className={`take-star${take.favorite ? " on" : ""}`} aria-label={take.favorite ? "Unstar" : "Star"} onClick={() => onShot(shot.id, (s2) => toggleFavorite(s2, take.id))}>★</button>
                                {!on && <button className="take-x" aria-label="Remove take" onClick={() => onShot(shot.id, (s2) => removeTake(s2, take.id))}>×</button>}
                              </figcaption>
                            </figure>
                          );
                        })}
                      </div>
                      <p className="takes-note">Space plays. ← → step. ↑ ↓ on the timeline flip between takes. Rolling again adds a take and never replaces one.</p>
                    </>
                  )}

                  {(tab === "reshoot" || tab === "voice" || tab === "tools") && !(tab === "reshoot" && reshootMode === "grey") && needsApproval(shot) && (
                    <div className="gr-lock" role="status">
                      <span aria-hidden="true">🔒</span>
                      <div><b>This is a real take, locked.</b><small>Approve it and these tools can change it. What is there now is always kept as a take.</small></div>
                      <button className="pill" onClick={() => onShot(shot.id, (s2) => ({ ...s2, approved: true }))}>Approve to alter</button>
                    </div>
                  )}
                    {tab === "reshoot" && (
                      <div className="rs-modes" role="group" aria-label="How to reshoot">
                        <button className={`pill${reshootMode === "footage" ? " on" : ""}`} aria-pressed={reshootMode === "footage"} onClick={() => setReshootMode("footage")}>From the footage</button>
                        <button className={`pill${reshootMode === "grey" ? " on" : ""}`} aria-pressed={reshootMode === "grey"} onClick={() => setReshootMode("grey")} title="Work out the camera, stand-ins and light in grey, for free, then make it real">Block out in grey</button>
                      </div>
                    )}
                  <fieldset className="gr-fence" disabled={(tab === "reshoot" || tab === "voice" || tab === "tools") && !(tab === "reshoot" && reshootMode === "grey") && needsApproval(shot)}>
                    {tab === "reshoot" && reshootMode === "footage" && (shot.render
                      ? <ReshootPanel key={shot.id} source={{ url: shot.render.url, kind: shot.render.kind, at: reshootFrameAt(shot), beat: shot.beat }} onKeep={(list) => list.forEach((made) => keepReshoot(shot.id, made))} />
                      : <p className="takes-note">This shot has nothing to reshoot yet.</p>)}

                    {tab === "voice" && <VoiceLines shot={shot} project={project} onChange={(voices) => onShot(shot.id, (s2) => ({ ...s2, voices }))} />}

                    {tab === "tools" && (
                      <Section name="Edit tools" initial classic={classic}><EditTools project={project} shot={shot} stage={video} playhead={here && here.clip.shotId === shot.id ? (here.clip.from ?? 0) + here.offset : 0} onTake={(shotId, render, origin) => onShot(shotId, (s2) => addTake(s2, render, origin))} incoming={bankPick} onIncoming={() => setBankPick(null)} /></Section>
                    )}
                  </fieldset>

                  {tab === "reshoot" && reshootMode === "grey" && (
                    <GreyRoom
                      key={shot.id}
                      shot={shot}
                      vertical={vertical}
                      names={project.threads.filter((t) => t.kind === "character" && shot.threadIds.includes(t.id)).map((t) => t.name)}
                      onGrey={(g) => onShot(shot.id, (s2) => ({ ...s2, grey: g }))}
                      onApprove={() => onShot(shot.id, (s2) => ({ ...s2, approved: true }))}
                      onTake={(url, usd) => onShot(shot.id, (s2) => addTake(s2, { url, kind: "image", usd, promptHash: s2.render?.promptHash ?? "", at: Date.now() }, "Grey room"))}
                    />
                  )}
                  {tab === "reshoot" && reshootMode === "grey" && (
                    <GreySequence
                      shots={cut.clips.map((c) => { const sh = project.shots.find((x) => x.id === c.shotId); return { id: c.shotId, heading: c.heading, seconds: c.seconds, ...(sh?.grey ? { grey: sh.grey } : {}) }; })}
                      currentId={shot.id}
                      vertical={vertical}
                      names={(id) => { const sh = project.shots.find((x) => x.id === id); return sh ? project.threads.filter((t) => t.kind === "character" && sh.threadIds.includes(t.id)).map((t) => t.name) : []; }}
                      onSelect={(id) => setPicked(id)}
                      onSet={(changes) => apply((c) => ({ ...c, shots: c.shots.map((x) => (changes[x.id] ? { ...x, grey: tidy(changes[x.id]!) } : x)) }))}
                    />
                  )}
                </>
              )}
            </div>
            </div>
          </aside>

          <section className="ed-time" aria-label="Timeline" data-collapsed={timelineCollapsed}>
            <div className="ed-time-bar">
              <b>Timeline</b>
              <button className="plain ed-timeline-toggle" aria-expanded={!timelineCollapsed} aria-controls="ed-timeline-tracks" onClick={(e) => {
                e.currentTarget.focus();
                if (!timelineCollapsed) timelineScroll.current = scroller.current?.scrollLeft ?? 0;
                setTimelineCollapsed(!timelineCollapsed);
                try { localStorage.setItem("haggs.cut.timelineCollapsed", String(!timelineCollapsed)); } catch {}
                if (timelineCollapsed) requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollLeft = timelineScroll.current; });
              }}>{timelineCollapsed ? "Expand timeline +" : "Collapse timeline −"}</button>
              <span className="ed-time-summary">{cut.clips.length} clips · {clock(cut.total)}</span>
              <span className="ed-keys" title="Keyboard shortcuts">Space play · ←/→ step · S split · I/O trim · M marker · ⌘Z undo</span>
              <button hidden={!advanced} className="plain" onClick={() => apply((current) => { const at = Math.round(t * 10) / 10; const next = addMarker(current, at, "", cut!.total); const added = next.markers!.find((m) => m.at === at && !(current.markers ?? []).some((c) => c.id === m.id)); if (added) setMarkerEdit(added.id); return next; })} title="Leave a note at the playhead (M). , and . jump between notes">+ Marker</button>
              <button className="plain" onClick={() => setCard(card ? null : { text: "", sub: "", busy: false })} title="Words on black, placed after the clip under the playhead">+ Title card</button>
              <button className="plain" disabled={historyTick < 0 || past.current.length === 0} onClick={() => travel("undo")} title="Undo (⌘Z)">Undo</button>
              <button className="plain" disabled={future.current.length === 0} onClick={() => travel("redo")} title="Redo (⇧⌘Z)">Redo</button>
              <label className="ed-zoom">Zoom <input type="range" min={6} max={160} value={Math.round(pps)} onChange={(e) => setPps(Number(e.target.value))} aria-label="Timeline zoom" /></label>
              <button className="plain" onClick={fit}>Fit all</button>
            </div>
            {card && (
              <EditorDialog label="Title card" onClose={() => setCard(null)}><form className="ed-card" onSubmit={(e) => { e.preventDefault(); void addCard(); }}>
                <input autoFocus value={card.text} onChange={(e) => setCard({ ...card, text: e.target.value })} placeholder="Title" aria-label="Title card words" maxLength={80} />
                <input value={card.sub} onChange={(e) => setCard({ ...card, sub: e.target.value })} placeholder="Smaller line (optional)" aria-label="Smaller line" maxLength={100} />
                <button className="pill on" disabled={card.busy || !card.text.trim()}>{card.busy ? "Making…" : "Add the card"}</button>
                <button type="button" className="plain" onClick={() => setCard(null)}>Cancel</button>
              </form></EditorDialog>
            )}
            {markerEdit && (project.markers ?? []).some((m) => m.id === markerEdit) && (
              <EditorDialog label="Marker note" onClose={() => setMarkerEdit(null)}><form className="ed-card" onSubmit={(e) => { e.preventDefault(); setMarkerEdit(null); }}>
                <b className="ed-marker-at">{clock((project.markers ?? []).find((m) => m.id === markerEdit)!.at)}</b>
                <input autoFocus value={(project.markers ?? []).find((m) => m.id === markerEdit)!.text} onChange={(e) => apply((c) => editMarker(c, markerEdit, e.target.value))} placeholder="What needs doing here?" aria-label="Marker note" maxLength={200} />
                <button type="button" className="plain danger" onClick={() => { apply((c) => removeMarker(c, markerEdit)); setMarkerEdit(null); }}>Remove</button>
                <button className="pill on">Done</button>
              </form></EditorDialog>
            )}
            <div className="ed-tracks" id="ed-timeline-tracks" hidden={timelineCollapsed}>
            <div className="ed-heads" aria-label="Tracks" style={{ height: laneHeight }}>
              <div className={`ed-head${project.sound?.clipMute ? " muted" : ""}`} style={{ top: 28, height: 94 }}><b>Video</b><small>{cut.clips.length} clips</small><button className={`trk-m${project.sound?.clipMute ? " on" : ""}`} aria-pressed={Boolean(project.sound?.clipMute)} title={project.sound?.clipMute ? "Unmute the clips' sound" : "Mute the clips' sound"} onClick={() => apply((c) => ({ ...c, sound: { ...(c.sound ?? {}), clipMute: !c.sound?.clipMute } }))}>M</button></div>
              {([["Voice", 128, "voiceMute", cut.voices.length], ["Effects", 164, "fxMute", (project.effects ?? []).length], ["Music", 200, "musicMute", project.music ? 1 : 0]] as const).map(([name, top, flag, n]) => (
                <div key={name} className={`ed-head${project.sound?.[flag] ? " muted" : ""}`} hidden={!visibleLanes.includes(name === "Voice" ? "voice" : name.toLowerCase())} style={{ top: laneTop(name === "Voice" ? "voice" : name.toLowerCase()), height: 30 }}>
                  <b>{name}</b>
                  <small>{n}</small>
                  <button className={`trk-m${project.sound?.[flag] ? " on" : ""}`} aria-pressed={Boolean(project.sound?.[flag])} title={project.sound?.[flag] ? `Unmute ${name}` : `Mute ${name}`} onClick={() => apply((c) => ({ ...c, sound: { ...(c.sound ?? {}), [flag]: !c.sound?.[flag] } }))}>M</button>
                </div>
              ))}
              <div className="ed-head" hidden={!visibleLanes.includes("titles")} style={{ top: laneTop("titles"), height: 30 }}><b>Titles</b><small>{(project.overlays ?? []).length}</small></div>
            </div>
            <div className="ed-scroll" ref={scroller}>
              <div
                className="ed-lane"
                ref={lane}
                style={{ width: cut.total * pps + 24, height: laneHeight }}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }}
                onPointerMove={(event) => { if (event.buttons === 1) scrub(event); }}
                role="slider"
                aria-label="Playhead"
                aria-valuemin={0}
                aria-valuemax={cut.total}
                aria-valuenow={Math.round(t * 10) / 10}
                tabIndex={0}
                onKeyDown={(event) => {
                  if ((event.key === "ArrowUp" || event.key === "ArrowDown") && here) {
                    event.preventDefault();
                    onShot(here.clip.shotId, (s2) => cycleTake(s2, event.key === "ArrowUp" ? -1 : 1));
                  }
                }}
              >
                <div className="ed-ruler">{ticks.map((sec) => <span key={sec} style={{ left: sec * pps }}>{clock(sec)}</span>)}{(project.markers ?? []).map((m) => <button key={m.id} className="ed-marker" style={{ left: m.at * pps }} title={`${clock(m.at)} ${m.text || "Marker"}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => { seek(m.at); setMarkerEdit(m.id); }}>{m.text ? m.text.slice(0, 14) : "●"}</button>)}</div>
                <div className="ed-clips">
                  {cut.clips.map((clip) => {
                    const w = clip.seconds * pps;
                    return (
                      <button
                        key={clip.shotId}
                        draggable
                        onDragStart={(e) => { dragged.current = clip.shotId; e.dataTransfer.effectAllowed = "move"; }}
                        onDragOver={(e) => { if (dragged.current) { e.preventDefault(); setDropAt(clip.shotId); } }}
                        onDragLeave={() => setDropAt((d) => (d === clip.shotId ? null : d))}
                        onDrop={(e) => { e.preventDefault(); dropOn(clip.shotId); }}
                        onDragEnd={() => { dragged.current = null; setDropAt(null); }}
                        className={`clip${selected?.shotId === clip.shotId ? " picked" : ""}${dropAt === clip.shotId ? " drop" : ""}`}
                        style={{ left: clip.start * pps, width: Math.max(4, w - 3) }}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => { setPicked(clip.shotId); seek(clip.start); }}
                        title={`${clip.index + 1}. ${clip.heading || "Shot"} — ${clip.seconds}s`}
                      >
                        <MediaThumb url={clip.url} kind={clip.kind} />
                        {w > 54 && <span className="clip-label">{clip.heading || `Shot ${clip.index + 1}`}</span>}
                        {w > 30 && <span className="clip-len">{clip.seconds}s</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="ed-vlane" hidden={!visibleLanes.includes("voice")} style={{ top: laneTop("voice") }} aria-label="Voice-over">
                  {cut.voices.length === 0 && <span className="ed-empty">Voice-over lines sit here. Add one from a shot&rsquo;s Voice tab.</span>}
                  {cut.voices.map((v) => <button key={v.id} className="ed-voice" style={{ left: v.start * pps, width: Math.max(48, 2.4 * pps) }} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setPicked(v.shotId); setTab("voice"); }} title={v.text}>{v.text}</button>)}
                </div>
                <div className="ed-fxlane" hidden={!visibleLanes.includes("effects")} style={{ top: laneTop("effects") }} aria-label="Sound effects">
                  {(project.effects ?? []).length === 0 && <button className="ed-empty" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("sound")}>+ Add a sound effect at the playhead</button>}
                  {(project.effects ?? []).map((e) => {
                    const start = fxDrag?.id === e.id ? fxDrag.start : e.start;
                    return (
                      <button
                        key={e.id}
                        className="ed-fx"
                        style={{ left: start * pps, width: Math.max(40, e.seconds * pps) }}
                        title={`${e.name} · ${start.toFixed(1)}s. Drag to move.`}
                        onPointerDown={(ev) => {
                          ev.stopPropagation();
                          const x0 = ev.clientX, s0 = e.start;
                          let last = s0;
                          const move = (m: PointerEvent) => { last = Math.max(0, Math.round((s0 + (m.clientX - x0) / pps) * 10) / 10); setFxDrag({ id: e.id, start: last }); };
                          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setFxDrag(null); if (last !== s0) apply((c) => ({ ...c, effects: (c.effects ?? []).map((x) => (x.id === e.id ? { ...x, start: last } : x)) })); else setTab("sound"); };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }}
                      >
                        ♫ {e.name}
                      </button>
                    );
                  })}
                </div>
                <div className="ed-mlane" hidden={!visibleLanes.includes("music")} style={{ top: laneTop("music") }} aria-label="Soundtrack">
                  {cut.music ? <button className="ed-music" style={{ width: cut.total * pps }} onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("sound")}>♪ {cut.music.name}</button> : <button className="ed-empty" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("sound")}>+ Add a soundtrack</button>}
                </div>
                <div className="ed-tlane" hidden={!visibleLanes.includes("titles")} style={{ top: laneTop("titles") }} aria-label="Titles over the picture">
                  {(project.overlays ?? []).length === 0 && <button className="ed-empty" onPointerDown={(e) => e.stopPropagation()} onClick={() => setTab("titles")}>+ Put a title over the picture</button>}
                  {(project.overlays ?? []).map((o) => <button key={o.id} className="ed-title" style={{ left: o.start * pps, width: Math.max(40, o.seconds * pps) }} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setTab("titles"); seek(o.start); }} title={`${o.name} · ${o.start}s for ${o.seconds}s`}>T {o.name.split("\n")[0]}</button>)}
                </div>
                <span className="ed-playhead" style={{ left: t * pps }} />
              </div>
            </div>
            </div>
            {!classic && <details className="ed-add-lane" hidden={timelineCollapsed}>
              <summary>+ Add lane</summary>
              <div>
                {([["voice", "voice", "Voice-over", "Voice-over lines sit here. Add one from a shot’s Voice tab."], ["effects", "sound", "Sound effect", "+ Add a sound effect at the playhead"], ["music", "sound", "Music", "+ Add a soundtrack"], ["titles", "titles", "Title", "+ Put a title over the picture"]] as const).map(([name, targetTab, label, description]) => <button key={name} className="plain" onClick={() => { setRevealedLanes((old) => old.includes(name) ? old : [...old, name]); setTab(targetTab); setLaneRequest(old=>({name,count:old.count+1})); }}><b>{label}</b><small>{description}</small></button>)}
                <label><input type="checkbox" checked={showAllLanes} onChange={(e) => { setShowAllLanes(e.target.checked); try { localStorage.setItem("haggs.cut.allLanes", String(e.target.checked)); } catch {} }} />Show all lanes</label>
              </div>
            </details>}
          </section>
        </div>
      )}
    </div>
  );
}
