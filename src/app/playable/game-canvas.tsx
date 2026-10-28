"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { keyOut } from "../../playable/art";
import { draw, loadPicture, matchLayout, toWorld, type Pictures } from "../../playable/render";
import { TEMPLATE_INFO, slotsOf, type GameSpec } from "../../playable/spec";
import { hudOf, initGame, stepGame, type GameState, type Input } from "../../playable/templates";
import { tapCell } from "../../playable/templates/match";

type Phase = "intro" | "playing" | "paused" | "won" | "lost";

const KEYS: Record<string, keyof Input> = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "action",
};

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * The live game: a canvas, the loop, keys and touch, and the cards over it.
 * A new spec with the same template carries on with the new rules and art, so
 * a chat edit can be felt mid-run; a new template starts over at the intro.
 */
export function GameCanvas({ spec }: { spec: GameSpec }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const specRef = useRef(spec);
  const [first] = useState(() => initGame(spec, 1));
  const stateRef = useRef<GameState>(first);
  const inputRef = useRef<Input>({});
  const picturesRef = useRef<Pictures>(new Map());
  const phaseRef = useRef<Phase>("intro");
  const [phase, setPhaseState] = useState<Phase>("intro");
  const [hud, setHud] = useState<string[]>([]);
  const [runs, setRuns] = useState(0);

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // A different template under a running game, or a different match board: back to the intro.
  useEffect(() => {
    const before = specRef.current;
    specRef.current = spec;
    const board = (s: GameSpec) => (s.template === "match" ? `${s.rules.rows}x${s.rules.cols}x${s.rules.kinds}` : "");
    if (before.template !== spec.template || board(before) !== board(spec)) {
      stateRef.current = initGame(spec, 1);
      setPhase("intro");
    }
  }, [spec, setPhase]);

  // Pictures for every slot that has one; a slot whose art is removed goes back to its shape.
  const urls = JSON.stringify(slotsOf(spec).map((s) => [s.key, s.kind === "sprite", s.art.url ?? ""]));
  useEffect(() => {
    let live = true;
    const wanted = new Map((JSON.parse(urls) as [string, boolean, string][]).map(([key, sprite, url]) => [key, { sprite, url }]));
    const pictures = picturesRef.current;
    for (const key of [...pictures.keys()]) if (!wanted.get(key)?.url) pictures.delete(key);
    for (const [key, { sprite, url }] of wanted) {
      if (!url) continue;
      void loadPicture(url, sprite, keyOut).then((p) => { if (live) pictures.set(key, p); }, () => undefined);
    }
    return () => { live = false; };
  }, [urls]);

  const start = useCallback(() => {
    stateRef.current = initGame(specRef.current, Math.floor(Math.random() * 2 ** 31));
    inputRef.current = {};
    setRuns((n) => n + 1);
    setPhase("playing");
    frameRef.current?.focus();
  }, [setPhase]);

  // The loop. It always draws, so the intro shows the world behind its card.
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    let shown = "";
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(1, Math.round(rect.width * ratio));
        const h = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const spec = specRef.current;
        if (phaseRef.current === "playing") {
          stateRef.current = stepGame(spec, stateRef.current, inputRef.current, dt);
          if (stateRef.current.status !== "playing") setPhase(stateRef.current.status);
        }
        const ctx = canvas.getContext("2d");
        if (ctx) draw(ctx, spec, stateRef.current, picturesRef.current, w, h);
        const words = hudOf(spec, stateRef.current);
        const joined = words.join("|");
        if (joined !== shown) { shown = joined; setHud(words); }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [setPhase]);

  // Keys, while the game is the thing being used (never while typing in the chat).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const which = KEYS[e.code];
      if (phaseRef.current === "playing") {
        if (which) { (inputRef.current as Record<string, boolean>)[which] = true; e.preventDefault(); }
        if (e.code === "KeyP" || e.code === "Escape") setPhase("paused");
        return;
      }
      if (document.activeElement === frameRef.current && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        if (phaseRef.current === "paused") setPhase("playing");
        else start();
      }
    };
    const up = (e: KeyboardEvent) => {
      const which = KEYS[e.code];
      if (which) (inputRef.current as Record<string, boolean>)[which] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [setPhase, start]);

  const worldPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return toWorld(rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top);
  };

  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== "playing") return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that's already gone can't be captured; the press still counts.
    }
    const at = worldPoint(e);
    const spec = specRef.current;
    const s = stateRef.current;
    if (spec.template === "match" && s.template === "match") {
      const cell = matchLayout(spec).cellAt(at.x, at.y);
      if (cell) tapCell(spec, s, cell);
      if (s.status !== "playing") setPhase(s.status);
      return;
    }
    inputRef.current = { ...inputRef.current, action: true, point: at };
  };
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (inputRef.current.point) inputRef.current = { ...inputRef.current, point: worldPoint(e) };
  };
  const pointerUp = () => {
    inputRef.current = { ...inputRef.current, action: false, point: null };
  };

  const info = TEMPLATE_INFO[spec.template];
  return (
    <div className="pl-stage">
      <div className="pl-frame" ref={frameRef} tabIndex={0} aria-label={`${spec.title}, a ${info.genre.toLowerCase()}`}>
        <canvas
          ref={canvasRef}
          className="pl-canvas"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
        />
        {phase === "playing" || phase === "paused" ? (
          <div className="pl-hud" aria-live="off">
            {hud.map((h, i) => <span key={i}>{h}</span>)}
          </div>
        ) : null}
        {phase !== "playing" ? (
          <div className="pl-card-over" role="dialog" aria-label={phase === "intro" ? spec.title : phase === "won" ? "You won" : phase === "lost" ? "Game over" : "Paused"}>
            {phase === "intro" ? (
              <>
                <span className="pl-eyebrow">{info.genre}</span>
                <h2>{spec.title}</h2>
                <p>{spec.text.intro}</p>
                <p className="pl-controls">{info.controls}</p>
                <button className="pl-go" onClick={start}>Play</button>
              </>
            ) : phase === "paused" ? (
              <>
                <h2>Paused</h2>
                <div className="pl-pair">
                  <button className="pl-go" onClick={() => { setPhase("playing"); frameRef.current?.focus(); }}>Resume</button>
                  <button className="pl-ghost" onClick={start}>Restart</button>
                </div>
              </>
            ) : (
              <>
                <span className={`pl-eyebrow ${phase === "won" ? "pl-won" : "pl-lost"}`}>{phase === "won" ? "You win" : "Game over"}</span>
                <h2>{phase === "won" ? spec.text.win : spec.text.lose}</h2>
                <p className="pl-controls">{hud.slice(0, 2).join(" · ")}</p>
                <button className="pl-go" onClick={start}>Play again</button>
              </>
            )}
          </div>
        ) : null}
      </div>
      <div className="pl-stage-bar">
        <span className="pl-mono">{info.controls}{spec.template !== "match" ? " · P to pause" : ""}</span>
        {phase === "playing" ? <button className="pl-ghost pl-small" onClick={() => setPhase("paused")}>Pause</button> : null}
        <button className="pl-ghost pl-small" onClick={start} disabled={runs === 0 && phase === "intro"}>Replay</button>
      </div>
    </div>
  );
}
