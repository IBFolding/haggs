"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChangeEvent } from "react";
import { HaggsWorldEngine } from "../../worlds/engine";
import { cameraAt, fromWorldPrompt, KINDS, makeWorld, PRESETS, shotAt, titleOf, validateWorld } from "../../worlds/spec";
import type { WorldKind, WorldObject, WorldPreset, WorldSpec } from "../../worlds/spec";
import styles from "./worlds.module.css";

const STORE = "haggs:worlds:latest:v1";
function saveDownload(name: string, value: Blob) {
  const url = URL.createObjectURL(value);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const jsonBlob = (value: unknown) => new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
const displayTime = (t: number) => `00:${t.toFixed(2).padStart(5, "0")}`;
function agentBrief(world: WorldSpec) {
  return `You are the art director and technical director for Haggs Worlds. Improve this editable 3D world with cinematic composition, purposeful prop placement, atmosphere, believable light and strong camera movement. Keep JSON strictly compatible with schemaVersion 1 (the field name is "version" and must be 1); do not invent object kinds. Objects must have id, kind, position [x,y,z], rotation [x,y,z], scale and #RRGGBB color. Supported kinds: ${KINDS.join(", ")}. Return a complete world JSON document with its three continuous camera shots. Do not claim Blender, ComfyUI or GPU inference ran unless you actually execute those systems.\n\nWORLD:\n${JSON.stringify(world, null, 2)}`;
}

export default function WorldsStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<InstanceType<typeof HaggsWorldEngine> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const worldRef = useRef<WorldSpec>(makeWorld());
  const [world, setWorld] = useState<WorldSpec>(() => makeWorld());
  const [selected, setSelected] = useState<WorldObject | null>(null);
  const [status, setStatus] = useState("Starting live 3D engine…");
  const [prompt, setPrompt] = useState("An ancient floating island world with a glowing portal");
  const [kind, setKind] = useState<WorldKind>("crystal");
  const [tool, setTool] = useState<"translate" | "rotate" | "scale">("translate");
  const [filmMode, setFilmMode] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeShot, setActiveShot] = useState(0);

  const refresh = () => {
    const source = worldRef.current;
    setWorld({ ...source, objects: [...source.objects], film: { ...source.film, shots: [...source.film.shots] }, environment: { ...source.environment } });
  };
  useEffect(() => {
    if (!canvasRef.current) return;
    let engine: InstanceType<typeof HaggsWorldEngine>;
    try {
      engine = new HaggsWorldEngine(
        canvasRef.current,
        (obj: WorldObject | null) => setSelected(obj ? { ...obj } : null),
        () => { const source = worldRef.current; setWorld({ ...source, objects: [...source.objects], film: { ...source.film, shots: [...source.film.shots] } }); },
        (t: number, isPlaying: boolean) => { setTime(t); setPlaying(isPlaying); },
      );
      engineRef.current = engine;
      let starter = worldRef.current;
      try {
        const saved = localStorage.getItem(STORE);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (validateWorld(parsed)) starter = parsed;
        }
      } catch { /* Storage blocked or previous save invalid. The default world still works. */ }
      worldRef.current = starter; engine.load(starter); setWorld({ ...starter }); setStatus("Live Three.js · unsaved changes stay on this device");
    } catch (error) {
      setStatus(`Could not start WebGL: ${error instanceof Error ? error.message : "unknown error"}`);
      return;
    }
    return () => { engine.dispose(); engineRef.current = null; };
  }, []);
  const applyWorld = (next: WorldSpec) => {
    if (!validateWorld(next)) { setStatus("World JSON failed validation. Nothing was replaced."); return; }
    const engine = engineRef.current;
    worldRef.current = next; setWorld({ ...next }); setSelected(null); setTime(0); setPlaying(false); setFilmMode(false);
    engine?.setFilmMode(false); engine?.load(next);
    setStatus(`${next.name} · ready to edit`);
  };
  const makeFromPrompt = () => {
    const next = fromWorldPrompt(prompt, (Date.now() % 100000) + 1);
    applyWorld(next);
    setStatus("Procedural starting world created. Prompt matching is local, not AI inference.");
  };
  const choosePreset = (preset: WorldPreset) => {
    applyWorld(makeWorld(preset, (Date.now() % 100000) + 1));
  };
  const changeEnvironment = (field: "fog" | "daylight" | "motion", value: number) => {
    worldRef.current.environment[field] = value;
    engineRef.current?.updateEnvironment();
    refresh();
  };
  const addObject = () => {
    engineRef.current?.add(kind); refresh(); setStatus(`Added ${kind}. Drag the handles to position it.`);
  };
  const remove = () => { engineRef.current?.removeSelected(); refresh(); setStatus("Object removed."); };
  const chooseTool = (value: "translate" | "rotate" | "scale") => { setTool(value); engineRef.current?.setTool(value); };
  const toggleFilm = () => {
    const next = !filmMode; setFilmMode(next); engineRef.current?.setFilmMode(next);
    engineRef.current && (engineRef.current.playing = false);
    setPlaying(false);
    setStatus(next ? "Film camera preview · scrub the three shots" : "World editor · orbit, click and move objects");
  };
  const seek = (value: number) => { engineRef.current?.setTime(value); setTime(value); setPlaying(false); if (engineRef.current) engineRef.current.playing = false; };
  const togglePlay = () => {
    const engine = engineRef.current; if (!engine) return;
    if (!filmMode) { setFilmMode(true); engine.setFilmMode(true); }
    if (engine.time >= worldRef.current.film.duration) { engine.setTime(0); setTime(0); }
    engine.playing = !engine.playing; setPlaying(engine.playing);
  };
  const cameraKey = (end: boolean) => {
    if (filmMode) { setStatus("Switch to Edit world and position the camera before capturing a key."); return; }
    engineRef.current?.setCameraKey(activeShot, end); refresh();
    setStatus(`Recorded ${end ? "end" : "start"} camera for ${worldRef.current.film.shots[activeShot]?.name}.`);
  };
  const exportWorld = () => {
    if (!validateWorld(worldRef.current)) { setStatus("Export blocked: world failed validation."); return; }
    saveDownload("haggs-world.json", jsonBlob(worldRef.current));
    setStatus("World JSON exported. Use it with the Blender Film Engine.");
  };
  const exportGLB = async () => {
    try {
      const blob = await engineRef.current?.exportGLB();
      if (!blob) return;
      saveDownload("haggs-world.glb", blob as Blob);
      setStatus("Geometry exported as GLB. Film cameras and atmosphere are in the world JSON.");
    } catch (error) { setStatus(`GLB export failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  };
  const takeStill = () => {
    const data = engineRef.current?.screenshot(); if (!data) return;
    const a = document.createElement("a"); a.href = data; a.download = "haggs-world-preview.png"; a.click();
    setStatus("Browser preview PNG saved (not a Cycles render).");
  };
  const saveLocal = () => {
    if (!validateWorld(worldRef.current)) { setStatus("Save blocked: invalid world."); return; }
    try { localStorage.setItem(STORE, JSON.stringify(worldRef.current)); setStatus("Saved in this browser. Export JSON for a portable backup."); }
    catch { setStatus("Local storage unavailable. Use Export world JSON instead."); }
  };
  const importWorld = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    if (file.size > 2_000_000) { setStatus("File too large (max 2 MB)."); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateWorld(parsed)) { setStatus("Invalid world JSON; existing world kept."); return; }
      applyWorld(parsed);
    } catch { setStatus("Could not read the JSON file."); }
  };
  const copyBrief = async () => {
    try { await navigator.clipboard.writeText(agentBrief(worldRef.current)); setStatus("Claude/Codex art direction brief copied with complete world JSON."); }
    catch { setStatus("Clipboard unavailable in this browser. Export JSON instead."); }
  };
  const selectedValue = selected && world.objects.find(o => o.id === selected.id);
  const selectedShot = world.film.shots[activeShot];
  const shot = shotAt(world, time);
  const position = cameraAt(shot, time).position;

  return (
    <main className={styles.studio}>
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>HAGGS / WORLD ENGINE / V1</div>
          <h1>Build worlds. Shoot films.</h1>
          <p>Live procedural 3D, editable objects, cinematic camera paths. Blender and ComfyUI can pick up the exported scene.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" onClick={saveLocal}>Save world</button>
          <Link className={styles.makeFilm} href="/film-engine">Make a Film ↗</Link>
          <button type="button" onClick={exportWorld} className={styles.primary}>Export film scene ↗</button>
        </div>
      </div>
      <div className={styles.layout}>
        <section className={styles.stageColumn}>
          <div className={styles.stage}>
            <canvas ref={canvasRef} aria-label="Interactive 3D world; drag to orbit and select objects" />
            <div className={styles.stageTop}>
              <span className={styles.stageChip}><i /> LIVE WORLD</span>
              <span className={styles.stageChip}>{filmMode ? "CINEMATIC CAMERA" : "ORBIT / SELECT / TRANSFORM"}</span>
            </div>
            <div className={styles.stageBottom}>
              <div><small>SCENE 001</small><strong>{world.name}</strong></div>
              <span>THREE.JS · WEBGL</span>
            </div>
          </div>
          <div className={styles.player}>
            <button type="button" className={styles.primary} onClick={togglePlay}>{playing ? "Pause" : "Play film"}</button>
            <button type="button" onClick={toggleFilm}>{filmMode ? "Edit world" : "Preview cameras"}</button>
            <input aria-label="Film timeline" type="range" min={0} max={world.film.duration} step={1 / world.film.fps} value={time} onChange={e => seek(+e.target.value)} />
            <output>{displayTime(time)} / {displayTime(world.film.duration)}</output>
          </div>
          <div className={styles.shots} aria-label="Shot timeline">
            {world.film.shots.map((s, i) => (
              <button type="button" key={s.id} onClick={() => { setActiveShot(i); seek(s.start); }}
                className={`${styles.shot} ${shot.id === s.id ? styles.shotActive : ""}`}>
                <span>{s.id} <b>{s.name}</b></span><small>{s.start.toFixed(1)}–{s.end.toFixed(1)}s · {s.lensMm}mm</small>
              </button>
            ))}
          </div>
          <p className={styles.status} role="status">{status}</p>
        </section>
        <aside className={styles.inspector}>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>Create a world</strong><span>01</span></div>
            <label htmlFor="world-prompt" className={styles.fieldLabel}>Describe the place</label>
            <textarea id="world-prompt" value={prompt} rows={3} onChange={e => setPrompt(e.target.value)} maxLength={1500} />
            <button type="button" onClick={makeFromPrompt} className={styles.primary}>Build starting world</button>
            <p className={styles.hint}>Offline procedural presets, not AI generation. Use “Copy AI brief” to direct Claude/Codex.</p>
            <div className={styles.presetRow}>
              {PRESETS.map(p => <button type="button" key={p} className={world.preset === p ? styles.active : ""} onClick={() => choosePreset(p)}>{titleOf[p]}</button>)}
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>Shape the scene</strong><span>02</span></div>
            <div className={styles.toolRow}>
              {(["translate", "rotate", "scale"] as const).map(value => <button type="button" key={value} onClick={() => chooseTool(value)} className={tool === value ? styles.active : ""}>{value === "translate" ? "Move" : value === "rotate" ? "Rotate" : "Scale"}</button>)}
            </div>
            <div className={styles.inline}>
              <select value={kind} onChange={e => setKind(e.target.value as WorldKind)} aria-label="New object type">{KINDS.filter(k => k !== "ground").map(k => <option key={k} value={k}>{k}</option>)}</select>
              <button type="button" onClick={addObject}>+ Add object</button>
            </div>
            {selectedValue ? (
              <div className={styles.selection}>
                <span>SELECTED / {selectedValue.kind.toUpperCase()}</span>
                <strong>{selectedValue.id}</strong>
                <small>Position: {selectedValue.position.map(v => v.toFixed(2)).join(", ")} · Scale: {selectedValue.scale.toFixed(2)}</small>
                <button type="button" onClick={remove} className={styles.danger}>Remove selected object</button>
              </div>
            ) : <p className={styles.hint}>Click anything in the viewport. Drag the handles to place, rotate or resize it.</p>}
            <div className={styles.sliders}>
              {([
                ["daylight", "Sunlight"],
                ["fog", "Atmosphere"],
                ["motion", "Motion"]
              ] as const).map(([key, label]) => (
                <label key={key}><span>{label} <output>{Math.round(world.environment[key] * 100)}%</output></span>
                  <input type="range" min={0} max={1} step={.01} value={world.environment[key]} onChange={e => changeEnvironment(key, +e.target.value)} />
                </label>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelTitle}><strong>Direct the film</strong><span>03</span></div>
            <p className={styles.hint}>Pick a shot, position the editor camera, then capture its start and end. Preview to see the move.</p>
            <div className={styles.toolRow}><button type="button" onClick={() => cameraKey(false)}>Set start camera</button><button type="button" onClick={() => cameraKey(true)}>Set end camera</button></div>
            <p className={styles.hint}>Current: {selectedShot?.name ?? "—"} · Camera {position.map(n => n.toFixed(1)).join(", ")}</p>
            <div className={styles.toolRow}><button type="button" onClick={takeStill}>Save PNG</button><button type="button" onClick={() => void exportGLB()}>Export GLB</button></div>
            <div className={styles.toolRow}><button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button><button type="button" onClick={() => void copyBrief()}>Copy AI brief</button></div>
            <input ref={fileRef} type="file" accept=".json,application/json" className={styles.hidden} onChange={e => void importWorld(e)} />
          </section>
        </aside>
      </div>
      <div className={styles.footerNote}>Runs locally in your browser. Save exports to keep scenes portable. No ComfyUI model or paid GPU is invoked on this page.</div>
    </main>
  );
}
