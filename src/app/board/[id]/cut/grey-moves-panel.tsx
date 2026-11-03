"use client";

import { useState } from "react";

import { CAM_SECONDS, type CamKey, type CamState } from "../../../../story/grey-camera";
import { MOVES, MOVE_INFO, defaultMoveOptions, describeMove, moveKeys, moveStart, type Move, type MoveOptions } from "../../../../story/grey-camera-moves";
import type { GreySubject } from "../../../../story/grey";
import { MoreOptions } from "../grey/[shot]/collapsible";

const MOVE_PATH: Record<Move, string> = {
  "Arc": "M4 16c2-8 14-8 16 0M17 13l3 3-4 1",
  "Push in": "M4 12h14M13 7l5 5-5 5",
  "Pull out": "M20 12H6M11 7l-5 5 5 5",
  "Crane up": "M12 20V6M7 11l5-5 5 5",
  "Crane down": "M12 4v14M7 13l5 5 5-5",
  "Orbit": "M20 12a8 8 0 1 1-3-6.2M20 4v4h-4",
  "Bullet time": "M4 8h4v8H4zM10 6h4v12h-4zM16 8h4v8h-4z",
  "Dolly zoom": "M3 12h5M16 12h5M8 8l4 4-4 4M16 8l-4 4 4 4",
  "Whip": "M4 8h16M4 12h12M4 16h8",
};
function MoveIcon({ move }: { move: Move }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={MOVE_PATH[move]} /></svg>;
}

/** Named camera moves: pick one, set how long and how far, and it lays ordinary camera keys. Free, runs in the browser. */
export function GreyMovesPanel({ cam, subjects, onApply, compact = false }: { cam: CamState; subjects: GreySubject[]; onApply: (keys: CamKey[], note: string) => void; compact?: boolean }) {
  const [move, setMove] = useState<Move>("Arc");
  const [options, setOptions] = useState<MoveOptions>(() => defaultMoveOptions("Arc"));
  const info = MOVE_INFO[move];
  const from = subjects.some((s) => s.id === options.from) ? options.from : undefined;
  const fromLabel = subjects.find((s) => s.id === from)?.label;
  const dolly = move === "Dolly zoom";
  const pick = (m: Move) => { setMove(m); setOptions((o) => ({ ...defaultMoveOptions(m), way: o.way, ...(o.from ? { from: o.from } : {}) })); };
  const lay = () => {
    const keys = moveKeys(move, moveStart(cam, subjects, from), { ...options, from });
    if (keys.length > 1) onApply(keys, `${describeMove(move, options, fromLabel)}. Press play to watch it; the old path was replaced.`);
  };
  return (
    <div className="gr-moves" role="group" aria-label="Camera moves">
      <div className="gr-path-bar" role="radiogroup" aria-label="Choose a camera move">
        {MOVES.map((m) => <button key={m} type="button" role="radio" aria-checked={m === move} className={`gr-move${m === move ? " on" : ""}`} onClick={() => pick(m)}><MoveIcon move={m} /><span>{m}</span></button>)}
      </div>
      <small className="gr-time">{info.says}.</small>
      {compact ? <>
      <div className="gr-path-bar"><button type="button" className="pill on" onClick={lay}>Add {move.toLowerCase()} to the path</button></div>
      <MoreOptions label="More options: length, distance, direction">
      <div className="gr-controls">
        <label>How long <input type="range" aria-label="Move duration in seconds" min={1} max={CAM_SECONDS} step={0.5} value={options.seconds} onChange={(e) => setOptions({ ...options, seconds: Number(e.target.value) })} /><b>{options.seconds.toFixed(1)} s</b></label>
        <label>{info.unit === "°" ? "How far round" : "How far"} <input type="range" aria-label={`Move size in ${info.unit === "°" ? "degrees" : "metres"}`} min={info.min} max={info.max} step={info.step} value={options.amount} onChange={(e) => setOptions({ ...options, amount: Number(e.target.value) })} /><b>{options.amount}{info.unit === "°" ? "°" : " m"}</b></label>
        {(info.turns || dolly) && (
          <label>Direction
            <select aria-label="Move direction" value={options.way} onChange={(e) => setOptions({ ...options, way: e.target.value === "left" ? "left" : "right" })}>
              {dolly ? <><option value="right">In</option><option value="left">Out</option></> : <><option value="right">Right</option><option value="left">Left</option></>}
            </select><span />
          </label>
        )}
        <label>Start from
          <select aria-label="Start the move from" value={from ?? ""} onChange={(e) => setOptions({ ...options, from: e.target.value || undefined })}>
            <option value="">Where the camera is</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>The front of {s.label}</option>)}
          </select><span />
        </label>
      </div>
      </MoreOptions></> : <>
      <div className="gr-controls">
        <label>How long <input type="range" aria-label="Move duration in seconds" min={1} max={CAM_SECONDS} step={0.5} value={options.seconds} onChange={(e) => setOptions({ ...options, seconds: Number(e.target.value) })} /><b>{options.seconds.toFixed(1)} s</b></label>
        <label>{info.unit === "°" ? "How far round" : "How far"} <input type="range" aria-label={`Move size in ${info.unit === "°" ? "degrees" : "metres"}`} min={info.min} max={info.max} step={info.step} value={options.amount} onChange={(e) => setOptions({ ...options, amount: Number(e.target.value) })} /><b>{options.amount}{info.unit === "°" ? "°" : " m"}</b></label>
        {(info.turns || dolly) && (
          <label>Direction
            <select aria-label="Move direction" value={options.way} onChange={(e) => setOptions({ ...options, way: e.target.value === "left" ? "left" : "right" })}>
              {dolly ? <><option value="right">In</option><option value="left">Out</option></> : <><option value="right">Right</option><option value="left">Left</option></>}
            </select><span />
          </label>
        )}
        <label>Start from
          <select aria-label="Start the move from" value={from ?? ""} onChange={(e) => setOptions({ ...options, from: e.target.value || undefined })}>
            <option value="">Where the camera is</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>The front of {s.label}</option>)}
          </select><span />
        </label>
      </div>
      <div className="gr-path-bar"><button type="button" className="pill on" onClick={lay}>Add {move.toLowerCase()} to the path</button></div>
      </>}
    </div>
  );
}
