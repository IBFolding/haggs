"use client";

import { BuildLink } from "../../../../return-bar";
import type { Point } from "../../../../../comfy/actor-matte";

/** Separating the actor from the grey room, so everything behind them can change. */
export function CutoutPanel({ isVideo, matte, describe, onDescribe, picking, onPicking, dots, onClearDots, running, price, problem, onCutOut }: {
  isVideo: boolean;
  matte: { price: string } | undefined;
  describe: string;
  onDescribe: (v: string) => void;
  picking: boolean;
  onPicking: (v: boolean) => void;
  dots: { at: Point }[];
  onClearDots: () => void;
  running: boolean;
  price: string | null;
  problem: string | null;
  onCutOut: () => void;
}) {
  return (
    <section className="gs-sec" aria-label="Cut out the actor">
      <h3>Cut out the actor</h3>
      <p className="gs-soft">Separate the actor from the grey room, so everything behind them can change.</p>
      {!isVideo ? (
        <p className="gs-soft">The cut-out works on video. This shot is still a picture; animate it in the editor first.</p>
      ) : (
        <>
          <label className="gs-field">
            Who stays?
            <input type="text" maxLength={120} value={describe} onChange={(e) => onDescribe(e.target.value)} placeholder="the woman in the grey cardigan" />
            <small>Describe them. It finds them again in every frame, so it follows people who move. Leave it blank to keep every person.</small>
          </label>
          <div className="gs-pick">
            <button className={`pill${picking ? " on" : ""}`} aria-pressed={picking} onClick={() => onPicking(!picking)}>{picking ? "Click the actor on the picture…" : "Or click them on the picture"}</button>
            {dots.length > 0 && <button className="plain" onClick={onClearDots}>Clear {dots.length} point{dots.length === 1 ? "" : "s"}</button>}
          </div>
          {dots.length > 0 && <p className="gs-soft">A click marks the same spot in every frame, so it works best for people who stay roughly in place.</p>}
          <button className="fire" disabled={running} onClick={onCutOut}>
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
    </section>
  );
}
