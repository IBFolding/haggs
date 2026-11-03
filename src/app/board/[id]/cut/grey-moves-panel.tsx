"use client";

import { useState } from "react";

import { CAM_SECONDS, type CamKey, type CamState } from "../../../../story/grey-camera";
import { MOVES, MOVE_INFO, defaultMoveOptions, describeMove, moveKeys, moveStart, type Move, type MoveOptions } from "../../../../story/grey-camera-moves";
import type { GreySubject } from "../../../../story/grey";

/** Named camera moves: pick one, set how long and how far, and it lays ordinary camera keys. Free, runs in the browser. */
export function GreyMovesPanel({ cam, subjects, onApply }: { cam: CamState; subjects: GreySubject[]; onApply: (keys: CamKey[], note: string) => void }) {
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
        {MOVES.map((m) => <button key={m} type="button" role="radio" aria-checked={m === move} className={`pill${m === move ? " on" : ""}`} onClick={() => pick(m)}>{m}</button>)}
      </div>
      <small className="gr-time">{info.says}.</small>
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
    </div>
  );
}
