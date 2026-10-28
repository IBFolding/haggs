"use client";

import { TrajectoryPanel } from "./trajectory-panel";
import { galleryEdit } from "../../../gallery-log";
import { track as inHeader } from "../../../../activity/activity";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CAM_SECONDS, PRESETS, camAt, dropKey, drawnKeys, presetKeys, setKey, wordsToKeys } from "../../../../story/grey-camera";
import { ROOM, defaultGrey, describeGrey, needsApproval, project, realPrompt, tidy, type GreyFrame } from "../../../../story/grey";
import type { Shot } from "../../../../story/model";
import { editEstimate } from "../../../../providers/cloud-edits";
import { runEdit } from "../../../actions";
import { creditsText } from "../../../../story/price-text";

/**
 * The grey room: work the shot out with a camera, stand-ins and a light, all
 * in grey, for free, until the framing is right. Then make it real from the
 * blockout. A real take that already exists is locked until you approve
 * changing it, so nothing finished is altered by accident.
 */

/** The grey frame: a wall, a floor with a grid, and grey stand-ins lit from the light's side. Drawn the same big or small. */
export function GreyScene({ grey, vertical, svgRef, className = "gr-view" }: { grey: GreyFrame; vertical: boolean; svgRef?: React.Ref<SVGSVGElement>; className?: string }) {
  const aspect = vertical ? 9 / 16 : 16 / 9;
  const W = vertical ? 900 : 1600;
  const H = vertical ? 1600 : 900;
  const id = useId().replace(/:/g, "");
  const view = useMemo(() => {
    // The floor as a grid, and each stand-in as a capsule from its feet to its head.
    const grid: [number, number, number, number][] = [];
    for (let i = -ROOM; i <= ROOM; i += 1) {
      const a = project(grey.cam, { x: i, y: 0, z: -ROOM }, aspect), b = project(grey.cam, { x: i, y: 0, z: ROOM }, aspect);
      const c = project(grey.cam, { x: -ROOM, y: 0, z: i }, aspect), d = project(grey.cam, { x: ROOM, y: 0, z: i }, aspect);
      if (a && b) grid.push([a.u, a.v, b.u, b.v]);
      if (c && d) grid.push([c.u, c.v, d.u, d.v]);
    }
    const figs = grey.subjects.flatMap((s) => {
      const feet = project(grey.cam, { x: s.x, y: 0, z: s.z }, aspect), head = project(grey.cam, { x: s.x, y: 1.75, z: s.z }, aspect);
      return feet && head ? [{ s, feet, head, depth: feet.depth }] : [];
    }).sort((p, q) => q.depth - p.depth);
    return { grid, figs };
  }, [grey, aspect]);

  const lit = Math.cos(((grey.light.az - grey.cam.angle) * Math.PI) / 180);
  const px = (u: number) => u * W;
  const py = (v: number) => v * H;
  return (
    <svg ref={svgRef} className={className} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Grey frame. ${describeGrey(grey)}`}>
      <defs>
        <linearGradient id={`${id}w`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8a8a8e" /><stop offset="1" stopColor="#5d5d62" /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6f6f74" /><stop offset="1" stopColor="#9a9a9f" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}w)`} />
      <rect y={py(project(grey.cam, { x: 0, y: 0, z: ROOM * 2 }, aspect)?.v ?? 0.55)} width={W} height={H} fill={`url(#${id}f)`} />
      {view.grid.map((l, i) => <line key={i} x1={px(l[0])} y1={py(l[1])} x2={px(l[2])} y2={py(l[3])} stroke="#ffffff" strokeOpacity=".12" strokeWidth="2" />)}
      {view.figs.map(({ s, feet, head }) => {
        const w = Math.max(18, Math.abs(py(feet.v) - py(head.v)) * 0.22);
        const shade = Math.round(150 + lit * 40);
        return (
          <g key={s.id}>
            <ellipse cx={px(feet.u)} cy={py(feet.v)} rx={w * 1.1} ry={w * 0.35} fill="#000" opacity=".28" />
            <line x1={px(feet.u)} y1={py(feet.v)} x2={px(head.u)} y2={py(head.v) + w * 0.5} stroke={`rgb(${shade},${shade},${shade + 6})`} strokeWidth={w} strokeLinecap="round" />
            <circle cx={px(head.u)} cy={py(head.v)} r={w * 0.62} fill={`rgb(${shade + 20},${shade + 20},${shade + 26})`} />
            <text x={px(head.u)} y={py(head.v) - w * 0.9} fill="#111" fontSize={Math.max(22, w * 0.5)} textAnchor="middle" fontFamily="sans-serif" fontWeight="700">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The whole cut in grey: one frame per shot, in order. Pick one to work on it, give every shot a starting frame, or carry a camera down the line. */
export function GreySequence({ shots, currentId, vertical, names, onSelect, onSet }: { shots: { id: string; heading: string; seconds: number; grey?: GreyFrame }[]; currentId: string; vertical: boolean; names: (id: string) => string[]; onSelect: (id: string) => void; onSet: (changes: Record<string, GreyFrame>) => void }) {
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const shot = shots[at];
    const t = setTimeout(() => { if (at + 1 >= shots.length) { setPlaying(false); setAt(0); } else setAt(at + 1); }, Math.max(600, (shot?.seconds ?? 2) * 1000));
    return () => clearTimeout(t);
  }, [playing, at, shots]);
  const here = shots.findIndex((s) => s.id === currentId);
  const missing = shots.filter((s) => !s.grey);
  const shown = playing ? shots[at] : undefined;
  return (
    <div className="gr-seq">
      <div className="gr-seq-bar">
        <b>The whole cut in grey</b>
        <button className="plain" disabled={missing.length === 0} onClick={() => onSet(Object.fromEntries(missing.map((s) => [s.id, defaultGrey(names(s.id).length ? names(s.id) : ["Subject"])])))}>Give every shot a frame{missing.length ? ` (${missing.length})` : ""}</button>
        <button className="plain" disabled={here < 0 || !shots[here]?.grey || here >= shots.length - 1} onClick={() => { const g = shots[here]!.grey!; onSet(Object.fromEntries(shots.slice(here + 1).map((s) => [s.id, { ...(s.grey ?? defaultGrey(names(s.id).length ? names(s.id) : ["Subject"])), cam: { ...g.cam }, light: { ...g.light } }]))); }} title="Use this shot's camera and light on every shot after it">Camera to the shots after</button>
        <button className="pill" onClick={() => { setAt(0); setPlaying((p) => !p); }} disabled={shots.every((s) => !s.grey)}>{playing ? "Stop" : "Play in grey"}</button>
      </div>
      {shown?.grey && <div className="gr-seq-play"><GreyScene grey={{ ...shown.grey, cam: camAt(shown.grey.cam, shown.grey.camKeys, 0) }} vertical={vertical} className="gr-view" /><small>{shown.heading || `Shot ${at + 1}`} · {shown.seconds}s</small></div>}
      <ol className="gr-strip">
        {shots.map((s, i) => (
          <li key={s.id} className={s.id === currentId ? "on" : ""}>
            <button onClick={() => onSelect(s.id)} aria-label={`Shot ${i + 1}${s.grey ? "" : ", no grey frame yet"}`}>
              {s.grey ? <GreyScene grey={{ ...s.grey, cam: camAt(s.grey.cam, s.grey.camKeys, 0) }} vertical={vertical} className="gr-mini" /> : <span className="gr-none">{i + 1}</span>}
              <small>{i + 1}</small>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** How far the plan view reaches, in metres each way: the room and the camera's usual places. */
const PLAN = 8;
const MONEY = (n: number) => creditsText(n);
const LENS_NAME = (mm: number) => (mm <= 24 ? "wide" : mm >= 85 ? "telephoto" : "natural");

export function GreyRoom({ shot, vertical, names, onGrey, onApprove, onTake }: { shot: Shot; vertical: boolean; names: string[]; onGrey: (g: GreyFrame) => void; onApprove: () => void; onTake: (url: string, usd: number) => void }) {
  const saved = shot.grey ?? defaultGrey(names.length ? names : ["Subject"]);
  const [t, setT] = useState(0);
  const [rec, setRec] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [words, setWords] = useState("");
  const [drawing, setDrawing] = useState<{ x: number; z: number }[] | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  // The camera as it is at the playhead; with no keys that is just the camera.
  const grey = { ...saved, cam: camAt(saved.cam, saved.camKeys, t) };
  const svg = useRef<SVGSVGElement>(null);
  const plan = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<null | { kind: "cam" } | { kind: "sub"; id: string } | { kind: "draw" }>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const locked = needsApproval(shot);
  const set = (next: GreyFrame) => onGrey(tidy(next));
  /** A camera change: a key at the playhead when recording or already keyed, otherwise the still camera. */
  const setCam = (patch: Partial<GreyFrame["cam"]>) => {
    const n = { ...grey.cam, ...patch };
    set({ ...saved, subjects: grey.subjects, light: grey.light, ...(rec || saved.camKeys?.length ? { camKeys: setKey(saved.camKeys, t, n) } : { cam: n }) });
  };
  const keyed = (saved.camKeys ?? []).some((k) => Math.abs(k.t - t) <= 0.04);
  const withKeys = (camKeys: NonNullable<GreyFrame["camKeys"]>, note: string) => { set({ ...saved, camKeys, subjects: grey.subjects, light: grey.light }); setT(0); setMoved(note); };

  useEffect(() => {
    if (!playing) return;
    const start = performance.now() - t * 1000;
    let raf = 0;
    const tickFrame = () => {
      const now = (performance.now() - start) / 1000;
      if (now >= CAM_SECONDS) { setT(CAM_SECONDS); setPlaying(false); return; }
      setT(now);
      raf = requestAnimationFrame(tickFrame);
    };
    raf = requestAnimationFrame(tickFrame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  /** Plan view: the room from above, camera and stand-ins you can drag. */
  const planAt = (e: { clientX: number; clientY: number }) => {
    const r = plan.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * 2 * PLAN, z: (0.5 - (e.clientY - r.top) / r.height) * 2 * PLAN };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = planAt(e);
    if (drag.kind === "draw") { setDrawing((pts) => [...(pts ?? []), p]); return; }
    if (drag.kind === "cam") {
      // Plan up is +z; camera position = (sin a, −cos a) × distance.
      const angle = (Math.atan2(p.x, -p.z) * 180) / Math.PI;
      setCam({ angle, distance: Math.hypot(p.x, p.z) });
    } else set({ ...grey, subjects: grey.subjects.map((s) => (s.id === drag.id ? { ...s, x: p.x, z: p.z } : s)) });
  };
  const endDrag = () => {
    if (drag?.kind === "draw" && drawing) {
      const keys = drawnKeys(drawing, grey.cam);
      if (keys.length) withKeys(keys, "Camera path drawn. Press play to watch it.");
      else setMoved("Draw a longer line to make a path.");
      setDrawing(null);
    }
    setDrag(null);
  };
  const a = (grey.cam.angle * Math.PI) / 180;
  const R = PLAN;
  const toPlan = (x: number, z: number) => ({ x: 150 + (x / R) * 150 * 1, y: 150 - (z / R) * 150 });
  const camP = toPlan(Math.sin(a) * grey.cam.distance, -Math.cos(a) * grey.cam.distance);

  async function makeReal() {
    setBusy(true);
    setProblem(null);
    try {
      const el = svg.current!;
      const xml = new XMLSerializer().serializeToString(el);
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("The blockout couldn't be drawn.")); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; });
      const canvas = document.createElement("canvas");
      canvas.width = vertical ? 864 : 1536;
      canvas.height = vertical ? 1536 : 864;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL("image/jpeg", 0.92);
      const r = await inHeader({ label: `Making a real picture from the grey room`, href: window.location.pathname + window.location.search, failure: (x) => (x.ok ? null : x.reason), after: galleryEdit(realPrompt(shot.beat, grey)) }, () => runEdit({ tool: "kontext", frame, prompt: realPrompt(shot.beat, grey), ratio: vertical ? "9:16" : "16:9" }));
      if (!r.ok) return setProblem(r.reason);
      onTake(r.url, r.usd);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gr">
      <p className="gr-says">Work the shot out in grey. Nothing here costs anything until you make it real.</p>

      <GreyScene grey={grey} vertical={vertical} svgRef={svg} />
      <TrajectoryPanel value={grey.trajectory} vertical={vertical} onChange={trajectory=>{const {trajectory:_,...rest}=grey;onGrey(trajectory?{...rest,trajectory}:rest)}} />

      <div className="gr-grid">
        <div>
          <svg ref={plan} className="gr-plan" viewBox="0 0 300 300" onPointerMove={onMove} onPointerDown={(e) => { if (drawing) { e.currentTarget.setPointerCapture(e.pointerId); setDrawing([planAt(e)]); setDrag({ kind: "draw" }); } }} onPointerUp={endDrag} onPointerLeave={endDrag} aria-label="The room from above. Drag the camera and the figures." style={drawing ? { cursor: "crosshair", touchAction: "none" } : undefined}>
            <rect x="0" y="0" width="300" height="300" rx="14" fill="#161618" />
            <rect x={toPlan(-ROOM, ROOM).x} y={toPlan(-ROOM, ROOM).y} width={toPlan(ROOM, 0).x - toPlan(-ROOM, 0).x} height={toPlan(0, -ROOM).y - toPlan(0, ROOM).y} fill="none" stroke="#ffffff22" strokeDasharray="4 4" />
            <path d={`M ${camP.x} ${camP.y} L ${toPlan(0, 0).x - 40 * Math.cos(a)} ${toPlan(0, 0).y - 40 * Math.sin(a)} L ${toPlan(0, 0).x + 40 * Math.cos(a)} ${toPlan(0, 0).y + 40 * Math.sin(a)} Z`} fill="#35e48a" opacity=".12" />
            {grey.subjects.map((s) => {
              const p = toPlan(s.x, s.z);
              return <g key={s.id} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind: "sub", id: s.id }); }} style={{ cursor: "grab" }}><circle cx={p.x} cy={p.y} r="11" fill="#c8c8cc" /><text x={p.x} y={p.y + 24} fontSize="11" textAnchor="middle" fill="#aaa">{s.label}</text></g>;
            })}
            {(saved.camKeys?.length ?? 0) > 1 && <polyline points={saved.camKeys!.map((k) => { const r = (k.angle * Math.PI) / 180; const q = toPlan(Math.sin(r) * k.distance, -Math.cos(r) * k.distance); return `${q.x},${q.y}`; }).join(" ")} fill="none" stroke="#35e48a" strokeWidth="1.5" strokeDasharray="3 3" opacity=".7" />}
            {drawing && drawing.length > 1 && <polyline points={drawing.map((q) => { const v = toPlan(q.x, q.z); return `${v.x},${v.y}`; }).join(" ")} fill="none" stroke="#f5c451" strokeWidth="2" />}
            <g onPointerDown={(e) => { if (drawing) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ kind: "cam" }); }} style={{ cursor: "grab" }} transform={`translate(${camP.x} ${camP.y}) rotate(${grey.cam.angle})`}>
              <path d="M0 -13 L11 11 L-11 11 Z" fill="#35e48a" />
            </g>
          </svg>
          <p className="gr-hint">{describeGrey(grey)}</p>

          <div className="gr-path" aria-label="Camera path">
            <div className="gr-path-bar">
              <button className="pill" onClick={() => { if (t >= CAM_SECONDS) setT(0); setPlaying((p) => !p); }} disabled={!saved.camKeys?.length}>{playing ? "Pause" : "Play"}</button>
              <label className={`pill${rec ? " on" : ""}`}><input type="checkbox" checked={rec} onChange={(e) => setRec(e.target.checked)} /> Record</label>
              <button className="plain" disabled={!rec && !saved.camKeys?.length} onClick={() => set({ ...saved, subjects: grey.subjects, light: grey.light, camKeys: setKey(saved.camKeys, t, grey.cam) })}>{keyed ? "Key set" : "Set key here"}</button>
              <button className="plain" disabled={!keyed} onClick={() => { const rest = dropKey(saved.camKeys, t); const { camKeys: _, ...bare } = saved; set(rest ? { ...saved, camKeys: rest } : { ...bare, cam: grey.cam }); }}>Remove key</button>
              <button className="plain danger" disabled={!saved.camKeys?.length} onClick={() => { const { camKeys: _, ...bare } = saved; set({ ...bare, cam: grey.cam }); setT(0); setMoved("Camera path cleared."); }}>Clear path</button>
            </div>
            <div className="gs-track">
              <input type="range" min={0} max={CAM_SECONDS} step={0.05} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="Time in the shot" />
              <div className="gr-dots" aria-hidden>{(saved.camKeys ?? []).map((k) => <i key={k.t} style={{ left: `${(k.t / CAM_SECONDS) * 100}%` }} />)}</div>
            </div>
            <small className="gr-time">{t.toFixed(1)} s of {CAM_SECONDS}{rec ? " · recording: moving the camera sets a key" : saved.camKeys?.length ? " · keyed: moving the camera sets a key here" : ""}</small>
            <div className="gr-path-bar">
              {PRESETS.map((name) => <button key={name} className="pill" onClick={() => withKeys(presetKeys(name, grey.cam), `${name}: path laid.`)}>{name}</button>)}
              <button className={`pill${drawing ? " on" : ""}`} onClick={() => setDrawing(drawing ? null : [])}>{drawing ? "Draw a line on the plan…" : "Draw a path"}</button>
            </div>
            <form className="gr-add" onSubmit={(e) => { e.preventDefault(); if (!words.trim()) return; const r = wordsToKeys(words, grey.cam); if (r.keys.length > 1) withKeys(r.keys, `Camera path made from your words: ${r.keys.length - 1} move${r.keys.length === 2 ? "" : "s"}.${r.unknown ? ` Skipped “${r.unknown}”.` : ""}`); else setMoved(`Didn’t understand “${r.unknown ?? words}”. Try push in, pull back, orbit left or right, crane up or down, zoom in or out, hold.`); }}>
              <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="Say it: push in, then orbit left and rise" aria-label="Describe the camera move" />
              <button className="plain" type="submit">Make path</button>
            </form>
            {moved && <small className="gr-time" role="status">{moved}</small>}
          </div>
        </div>

        <div className="gr-controls">
          <label>Camera height <input type="range" min={0.3} max={5} step={0.1} value={grey.cam.height} onChange={(e) => setCam({ height: Number(e.target.value) })} /><b>{grey.cam.height.toFixed(1)} m</b></label>
          <label>Lens <input type="range" min={14} max={135} step={1} value={grey.cam.lens} onChange={(e) => setCam({ lens: Number(e.target.value) })} /><b>{grey.cam.lens} mm · {LENS_NAME(grey.cam.lens)}</b></label>
          <label>Camera distance <input type="range" min={1} max={12} step={0.1} value={grey.cam.distance} onChange={(e) => setCam({ distance: Number(e.target.value) })} /><b>{grey.cam.distance.toFixed(1)} m</b></label>
          <label>Light from <input type="range" min={0} max={359} step={1} value={grey.light.az} onChange={(e) => set({ ...grey, light: { ...grey.light, az: Number(e.target.value) } })} /><b>{Math.round(grey.light.az)}°</b></label>
          <label>Light height <input type="range" min={5} max={90} step={1} value={grey.light.el} onChange={(e) => set({ ...grey, light: { ...grey.light, el: Number(e.target.value) } })} /><b>{Math.round(grey.light.el)}°</b></label>
          <form className="gr-add" onSubmit={(e) => { e.preventDefault(); const v = label.trim(); if (v && grey.subjects.length < 6) set({ ...grey, subjects: [...grey.subjects, { id: `s${Date.now().toString(36)}`, label: v, x: 0, z: 0 }] }); setLabel(""); }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add a figure: Rowan, a car…" aria-label="Add a figure" maxLength={24} />
            <button className="plain" type="submit">Add</button>
            <button className="plain" type="button" onClick={() => set({ ...grey, subjects: grey.subjects.slice(0, -1) })}>Remove last</button>
            <button className="plain" type="button" onClick={() => onGrey(defaultGrey(names.length ? names : ["Subject"]))}>Reset</button>
          </form>
        </div>
      </div>

      {locked ? (
        <div className="gr-lock" role="status">
          <span aria-hidden="true">🔒</span>
          <div><b>This shot has a real take, so it is locked.</b><small>Approve it to make a new version from this grey frame. The take you have stays as it is.</small></div>
          <button className="pill" onClick={onApprove}>Approve to alter</button>
        </div>
      ) : (
        <div className="gr-make">
          <button className="fire" disabled={busy || grey.subjects.length === 0} onClick={() => void makeReal()}>{busy ? "Making it real…" : "Make it real"} <span className="cost">about {MONEY(editEstimate({ tool: "kontext", seconds: 0 }))}</span></button>
          <small>Keeps this framing, this camera and where everyone stands. Lands as a new take.</small>
        </div>
      )}
      {problem && <p className="library-error" role="alert">{problem}</p>}
    </div>
  );
}
