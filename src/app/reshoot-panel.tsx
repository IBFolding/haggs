"use client";

import { useEffect, useRef, useState } from "react";

import { PRESETS, cameraWords, sameCamera, SAME, type Camera } from "../story/reshoot";
import { openKeys } from "./nav";
import { reshoot, reshootOpen } from "./cut-actions";

/**
 * Reshoot, inside the shot: the camera on a ring around the subject. Drag it
 * to go around, set how high and how close, and a frame from this shot comes
 * back from the new camera. Slide between Source and Result, and keep it as
 * the next shot only if you like it.
 */

const R = 78;
const C = 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function Dial({ move, onChange, thumb }: { move: Camera; onChange: (c: Camera) => void; thumb: { url: string; kind: "image" | "video"; at: number } }) {
  const svg = useRef<SVGSVGElement>(null);
  const rad = (move.az * Math.PI) / 180;
  const x = C + R * Math.sin(rad);
  const y = C + R * Math.cos(rad);
  // The subject faces the original camera, at the bottom.
  const at = (e: React.PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    let az = Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
    if (Math.abs(az) < 6) az = 0;
    onChange({ ...move, az });
  };
  return (
    <div className="dial-wrap">
    <span className="dial-thumb" aria-hidden="true">{thumb.kind === "video" ? <video src={`${thumb.url}#t=${thumb.at}`} muted playsInline preload="metadata" /> : <img src={thumb.url} alt="" />}</span>
    <svg
      ref={svg}
      viewBox="0 0 200 200"
      className="dial"
      role="slider"
      aria-label="Camera around the subject"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={move.az}
      aria-valuetext={move.az === 0 ? "Where the camera was" : `${Math.abs(move.az)} degrees to the ${move.az > 0 ? "right" : "left"}`}
      tabIndex={0}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); at(e); }}
      onPointerMove={(e) => e.buttons === 1 && at(e)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange({ ...move, az: clamp(move.az + 5, -180, 180) });
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange({ ...move, az: clamp(move.az - 5, -180, 180) });
      }}
    >
      <circle cx={C} cy={C} r={R} className="dial-ring" />
      <path d={`M ${C} ${C + R} A ${R} ${R} 0 0 ${move.az > 0 ? 0 : 1} ${x} ${y}`} className="dial-arc" style={{ display: Math.abs(move.az) < 6 ? "none" : undefined }} />
      <circle cx={C} cy={C + R} r="5" className="dial-source" />
      <text x={C} y={C + R + 18} textAnchor="middle" className="dial-note">source</text>
      <g transform={`translate(${C} ${C})`}>
        <circle r="30" className="dial-subject" />
      </g>
      <g transform={`translate(${x} ${y}) rotate(${-move.az})`} className="dial-cam">
        <rect x="-13" y="-9" width="22" height="18" rx="4" />
        <path d="M 9 -4 L 17 -9 L 17 9 L 9 4 Z" />
      </g>
    </svg>
    </div>
  );
}

type Made = { url: string; source: string; usd: number; label: string };
const labelOf = (m: Camera) => cameraWords(m).split(",")[0]!.replace(/^an? /, "");

export function ReshootPanel({
  source,
  onKeep,
}: {
  /** The shot being reshot: its picture or take, the moment to grab, and what happens in it. */
  source: { url: string; kind: "image" | "video"; at: number; beat: string };
  /** Keeps reshoots as shots after this one, in the order given. */
  onKeep: (made: { url: string; usd: number; label: string }[]) => void;
}) {
  const [move, setMove] = useState<Camera>({ az: 140, el: 0, zoom: 0 });
  // Partner: FLUX 3 with the move as words, priced per picture. Open weights: Comfy's Qwen multi-angle workflow with the move as numbers, billed as GPU time.
  const [engine, setEngine] = useState<"partner" | "open">("partner");
  useEffect(() => {
    try {
      if (localStorage.getItem("haggs.engine") === "open") setEngine("open");
    } catch {
      // Nothing remembered.
    }
  }, []);
  const pick = (e: "partner" | "open") => {
    setEngine(e);
    try {
      localStorage.setItem("haggs.engine", e);
    } catch {
      // A convenience only.
    }
  };
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Made[]>([]);
  const [shown, setShown] = useState(0);
  const [mix, setMix] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const words = sameCamera(move) ? "" : cameraWords(move);
  const COVERAGE = ["reverse", "wide", "close"].map((id) => PRESETS.find((p) => p.id === id)!);

  async function shoot(cams: { move: Camera }[]) {
    setError(null);
    for (let i = 0; i < cams.length; i++) {
      setBusy(cams.length > 1 ? `Coverage ${i + 1} of ${cams.length}…` : "Reshooting…");
      const r = engine === "open" ? await reshootOpen(source.url, source.at, source.kind, cams[i]!.move) : await reshoot(source.url, source.at, source.kind, cams[i]!.move, source.beat);
      if (!r.ok) {
        if (r.needsKey) openKeys();
        setError(r.reason);
        break;
      }
      setResults((all) => {
        setShown(all.length);
        return [...all, { url: r.url, source: r.source, usd: r.usd, label: labelOf(cams[i]!.move) }];
      });
      setMix(50);
    }
    setBusy(null);
  }

  const current = results[shown];
  const keep = (list: Made[]) => {
    onKeep([...list].reverse().map(({ url, usd, label }) => ({ url, usd, label })));
    setResults((all) => all.filter((m) => !list.includes(m)));
    setShown(0);
  };

  return (
    <div className="reshoot-panel">
      <header><b>Reshoot</b><span>Same scene, new camera. Slide to compare, keep what you like.</span></header>
      <div className="engine" role="radiogroup" aria-label="Engine">
        <button role="radio" aria-checked={engine === "partner"} className={engine === "partner" ? "on" : ""} onClick={() => pick("partner")}>FLUX 3 <small>$0.10</small></button>
        <button role="radio" aria-checked={engine === "open"} className={engine === "open" ? "on" : ""} onClick={() => pick("open")}>Open weights <small>Qwen multi-angle · GPU time</small></button>
      </div>
      <div className="reshoot-body">
        <div className="reshoot-controls">
          <Dial move={move} onChange={setMove} thumb={{ url: source.url, kind: source.kind, at: source.at }} />
          <label>Height <input type="range" min={-45} max={80} value={move.el} onChange={(e) => setMove({ ...move, el: Number(e.target.value) })} aria-valuetext={`${move.el} degrees`} /><i>{move.el === 0 ? "eye level" : move.el > 0 ? `${move.el}° up` : `${-move.el}° down`}</i></label>
          <label>Distance <input type="range" min={-1} max={1} step={0.25} value={move.zoom} onChange={(e) => setMove({ ...move, zoom: Number(e.target.value) })} /><i>{move.zoom === 0 ? "same" : move.zoom < 0 ? "closer" : "wider"}</i></label>
          <div className="reshoot-presets">
            {PRESETS.map((p) => <button key={p.id} className="plain" onClick={() => setMove(p.move)}>{p.label}</button>)}
            <button className="plain" onClick={() => setMove(SAME)}>Reset</button>
          </div>
        </div>
        <div className="reshoot-view">
          {current ? (
            <div className="compare" style={{ ["--mix" as string]: `${mix}%` }}>
              <img src={current.source} alt="Source" />
              <img src={current.url} alt={`Result: ${current.label}`} className="compare-top" />
              <input type="range" min={0} max={100} value={mix} onChange={(e) => setMix(Number(e.target.value))} aria-label="Slide between source and result" />
              <span className="compare-tag l">Source</span><span className="compare-tag r">{current.label}</span>
            </div>
          ) : (
            <p className="reshoot-hint">{words ? <>The camera will move to: <b>{words}</b>.</> : "Drag the camera around the subject, or pick an angle."}</p>
          )}
          {results.length > 1 && (
            <div className="reshoot-strip" role="tablist" aria-label="Reshoots">
              {results.map((m, i) => <button key={m.url} role="tab" aria-selected={i === shown} className={i === shown ? "on" : ""} onClick={() => { setShown(i); setMix(50); }}><img src={m.url} alt="" /><span>{m.label}</span></button>)}
            </div>
          )}
          {error && <p className="library-error" role="alert">{error}</p>}
          <div className="sheet-row">
            <button className="fire" disabled={busy !== null || !words} onClick={() => void shoot([{ move }])}>{busy && !busy.startsWith("Coverage") ? busy : "Reshoot"} <span className="cost">{engine === "open" ? "GPU time" : "$0.10"}</span></button>
            <button className="pill" disabled={busy !== null} onClick={() => void shoot(COVERAGE)} title="Reverse, wide and close-up of the same moment">{busy?.startsWith("Coverage") ? busy : `Get coverage · ${engine === "open" ? "3 runs" : "$0.30"}`}</button>
          </div>
          {results.length > 0 && (
            <div className="sheet-row">
              {current && <button className="pill on" onClick={() => keep([current])}>Keep this as the next shot</button>}
              {results.length > 1 && <button className="pill on" onClick={() => keep(results)}>Keep all {results.length}</button>}
              <button className="plain" onClick={() => { setResults([]); setShown(0); }}>Discard</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
