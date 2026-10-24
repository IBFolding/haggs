"use client";

import { useEffect, useRef } from "react";

import { SurfaceLayer } from "./surface-layer";
import { actorShadow, atmosphere, lookFilter, moveProp, propShadow, updateLight, updateProp, type GreyScene, type Light, type Prop } from "../../../../../story/grey-scene";

/**
 * The live picture: backdrop, props behind the actor, the actor, props in
 * front, lights, air and the look, stacked in that order. Drag a prop to move
 * it, the corner to resize it, the dot above it to turn it. In the Light step
 * the lights are dots you drag. Everything is fractions of the frame, so it is
 * the same picture at any size. This is the quick preview; the render makes
 * the real one.
 */

type Drag = { kind: "move" | "size" | "turn" | "light"; id: string; dx: number; dy: number };

export function Compositor({
  scene, footage, actorUrl, vertical, selected, editing, time, playing, seconds, onTime, onSelect, onChange,
}: {
  scene: GreyScene;
  /** The original footage, used when there is no cut-out yet or you want to compare. */
  footage: { url: string; kind: "video" | "image" } | null;
  /** The cut-out video, when there is one. */
  actorUrl: string | null;
  vertical: boolean;
  selected: string | null;
  editing: "props" | "lights" | null;
  /** Where the playhead is, in seconds, and whether it is running. */
  time: number;
  playing: boolean;
  seconds: number;
  onTime: (t: number) => void;
  onSelect: (id: string | null) => void;
  onChange: (next: GreyScene, commit: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const clip = useRef<HTMLVideoElement>(null);
  const latest = useRef(scene);
  // While dragging, the newest move wins over what was last drawn.
  if (!drag.current) latest.current = scene;

  const frac = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height, r };
  };

  function start(e: React.PointerEvent, kind: Drag["kind"], id: string, at: { x: number; y: number }) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const { fx, fy } = frac(e);
    drag.current = { kind, id, dx: at.x - fx, dy: at.y - fy };
    onSelect(id);
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const { fx, fy, r } = frac(e);
    const s = latest.current;
    const set = (next: GreyScene) => {
      // Remember it now: the last move and the release can land before the page redraws.
      latest.current = next;
      onChange(next, false);
    };
    if (d.kind === "light") return set(updateLight(s, d.id, { x: fx + d.dx, y: fy + d.dy }));
    const p = s.props?.find((q) => q.id === d.id);
    if (!p) return;
    if (d.kind === "move") return set(moveProp(s, d.id, { x: fx + d.dx, y: fy + d.dy }));
    if (p.locked) return;
    const cx = p.x * r.width, cy = p.y * r.height, px = fx * r.width, py = fy * r.height;
    if (d.kind === "size") return set(updateProp(s, d.id, { w: (2 * Math.abs(px - cx)) / r.width }));
    return set(updateProp(s, d.id, { rotate: (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90 }));
  }

  function end() {
    if (!drag.current) return;
    drag.current = null;
    onChange(latest.current, true);
  }

  // The cut-out (or the footage) is the clock. Paused, it shows the playhead's frame; playing, it drives the playhead.
  useEffect(() => {
    const v = clip.current;
    if (!v) return;
    if (!playing) {
      v.pause();
      if (Math.abs(v.currentTime - time) > 0.04) v.currentTime = Math.min(time, Math.max(0, (v.duration || seconds) - 0.01));
      return;
    }
    void v.play().catch(() => undefined);
    let raf = 0;
    const tick = () => { onTime(v.currentTime); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, actorUrl, footage?.url, playing ? 0 : time]);

  const as = actorShadow(scene);
  const rad = (as.angle * Math.PI) / 180;
  const actorStyle = as.amount > 0 && actorUrl ? { filter: `drop-shadow(${(Math.cos(rad) * 2.2).toFixed(2)}cqw ${(Math.sin(rad) * 2.2).toFixed(2)}cqw 1.4cqw rgba(0,0,0,${(as.amount * 0.7).toFixed(2)}))` } : undefined;
  const air = atmosphere(scene);
  const bd = scene.backdrop;
  const props = (scene.props ?? []).filter((p) => !p.hidden);
  const behind = props.filter((p) => p.behind);
  const front = props.filter((p) => !p.behind);

  const propEl = (p: Prop) => {
    const on = editing === "props" && selected === p.id;
    return (
      <div
        key={p.id}
        className={`cp-prop${on ? " on" : ""}${p.locked ? " locked" : ""}`}
        style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, opacity: p.opacity, transform: `translate(-50%, -50%) rotate(${p.rotate}deg) scaleX(${p.flip ? -1 : 1})` }}
        onPointerDown={editing === "props" ? (e) => start(e, "move", p.id, p) : undefined}
        onPointerMove={move}
        onPointerUp={end}
      >
        {propShadow(p) > 0 && <i className="cp-pshadow" style={{ opacity: propShadow(p) }} />}
        <img src={p.url} alt={p.name} draggable={false} />
        {on && !p.locked && (
          <>
            <i className="cp-size" onPointerDown={(e) => start(e, "size", p.id, p)} onPointerMove={move} onPointerUp={end} aria-label="Resize" />
            <i className="cp-turn" onPointerDown={(e) => start(e, "turn", p.id, p)} onPointerMove={move} onPointerUp={end} aria-label="Turn" />
          </>
        )}
      </div>
    );
  };

  return (
    <div ref={box} className={`cp${vertical ? " vertical" : ""}`} onPointerDown={() => onSelect(null)}>
      <div className="cp-inner" style={{ filter: lookFilter(scene.look) }}>
        <div className="cp-bg" style={bd ? { backgroundImage: `url(${bd.url})`, backgroundSize: `${bd.scale * 100}% auto`, backgroundPosition: `${bd.x * 100}% ${bd.y * 100}%`, filter: bd.blur ? `blur(${bd.blur * 14}px)` : undefined } : undefined} />
        {(scene.surfaces ?? []).filter((x) => !x.hidden && x.mask && x.texture).map((x) => <SurfaceLayer key={x.id} surface={x} time={time} playing={playing} />)}
        {behind.map(propEl)}
        {actorUrl ? <video key={actorUrl} ref={clip} className="cp-actor" style={actorStyle} src={actorUrl} playsInline muted loop /> : footage && (footage.kind === "video" ? <video key={footage.url} ref={clip} className="cp-actor full" src={footage.url} playsInline muted loop /> : <img className="cp-actor full" src={footage.url} alt="" />)}
        {front.map(propEl)}
        {(scene.lights ?? []).map((l) => <LightGlow key={l.id} l={l} />)}
        {air.map((a) => <div key={a.kind} className={`cp-air ${a.kind}`} style={{ opacity: a.amount }} />)}
        {scene.look?.vignette ? <div className="cp-vig" style={{ opacity: scene.look.vignette }} /> : null}
      </div>
      {editing === "lights" && (scene.lights ?? []).map((l) => (
        <i
          key={l.id}
          className={`cp-lamp${selected === l.id ? " on" : ""}`}
          style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%`, background: l.color }}
          onPointerDown={(e) => start(e, "light", l.id, l)}
          onPointerMove={move}
          onPointerUp={end}
          aria-label={`${l.kind} light`}
        />
      ))}
    </div>
  );
}

function LightGlow({ l }: { l: Light }) {
  const r = l.size * 100;
  return <div className="cp-light" style={{ background: `radial-gradient(circle at ${l.x * 100}% ${l.y * 100}%, ${l.color} 0%, transparent ${r}%)`, opacity: l.intensity * 0.7 }} />;
}
