"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { lanes as lanesOf, layout } from "../../story/flow";
import type { Project } from "../../story/model";

/**
 * The board drawn as a flow chart. Story order runs left to right; each
 * subplot has its own lane; the story line runs through every card in order,
 * so you can see the plot leave the main line and come back. Drag a card to
 * move it in time or into another lane. Drop pictures on the canvas to start
 * scenes from images. Select a card to see which other shots its characters
 * appear in.
 */

const COL = 212;
const LANE = 196;
const CARD_W = 184;
const CARD_H = 156;
const GUTTER = 156;

export type Picture = { url: string; name: string };

type Props = {
  project: Project;
  selected: string | null;
  stale: string[];
  running: string[];
  onSelect: (id: string) => void;
  onPlace: (id: string, col: number, lane: string | null) => void;
  onPictures: (pictures: Picture[], col: number, lane: string | null) => void;
};

/** Shrinks a dropped image so a board of pictures stays small enough to keep on this device. */
async function shrink(file: File): Promise<Picture> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL("image/jpeg", 0.85), name: file.name.replace(/\.[^.]+$/, "") };
}

export function FlowCanvas({ project, selected, stale, running, onSelect, onPlace, onPictures }: Props) {
  const lanes = lanesOf(project);
  const { nodes, story, threads } = layout(project);
  const at = new Map(nodes.map((n) => [n.id, n]));
  const area = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.7);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState(false);
  const [top, setTop] = useState(0);

  const cols = Math.max(nodes.length + 1, 4);
  const width = GUTTER + cols * COL;
  const height = lanes.length * LANE;
  const pos = (col: number, lane: number) => ({ x: GUTTER + col * COL + (COL - CARD_W) / 2, y: lane * LANE + (LANE - CARD_H) / 2 });

  /** Where on the grid a point in the canvas lands. */
  const cell = (clientX: number, clientY: number) => {
    const box = area.current!.getBoundingClientRect();
    const x = (clientX - box.left + area.current!.scrollLeft) / zoom - GUTTER;
    const y = (clientY - box.top + area.current!.scrollTop) / zoom;
    return {
      col: Math.max(0, Math.min(nodes.length, Math.round(x / COL - 0.5))),
      lane: Math.max(0, Math.min(lanes.length - 1, Math.floor(y / LANE))),
    };
  };

  function down(event: ReactPointerEvent, id: string) {
    if (event.button !== 0) return;
    const node = at.get(id)!;
    const p = pos(node.col, node.lane);
    const box = area.current!.getBoundingClientRect();
    const x = (event.clientX - box.left + area.current!.scrollLeft) / zoom;
    const y = (event.clientY - box.top + area.current!.scrollTop) / zoom;
    (event.target as Element).setPointerCapture(event.pointerId);
    setDrag({ id, x: p.x, y: p.y, dx: x - p.x, dy: y - p.y, moved: false });
  }

  function move(event: ReactPointerEvent) {
    if (!drag) return;
    const box = area.current!.getBoundingClientRect();
    const x = (event.clientX - box.left + area.current!.scrollLeft) / zoom - drag.dx;
    const y = (event.clientY - box.top + area.current!.scrollTop) / zoom - drag.dy;
    setDrag({ ...drag, x, y, moved: drag.moved || Math.abs(x - drag.x) + Math.abs(y - drag.y) > 6 });
  }

  function up(event: ReactPointerEvent) {
    if (!drag) return;
    const { id, moved } = drag;
    setDrag(null);
    if (!moved) {
      onSelect(id);
      return;
    }
    const target = cell(event.clientX, event.clientY);
    onPlace(id, target.col, lanes[target.lane]!.id);
  }

  async function dropFiles(event: React.DragEvent) {
    event.preventDefault();
    setHover(false);
    const files = [...event.dataTransfer.files].filter((f) => f.type.startsWith("image/")).slice(0, 24);
    if (!files.length) return;
    const target = cell(event.clientX, event.clientY);
    onPictures(await Promise.all(files.map(shrink)), target.col, lanes[target.lane]!.id);
  }

  const center = (id: string) => {
    const n = at.get(id)!;
    const p = pos(n.col, n.lane);
    return { x: p.x + CARD_W / 2, y: p.y + CARD_H / 2 };
  };
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mid = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  };
  const chosen = project.shots.find((s) => s.id === selected);
  const shownThreads = threads.filter((e) => {
    const thread = project.threads.find((t) => t.id === e.thread);
    return thread?.kind === "plot" || (chosen?.threadIds.includes(e.thread) ?? false);
  });

  return (
    <div className="flow">
      <div className="flow-tools">
        <span className="flow-hint">Drag a card to move it in time or into a subplot. Drop pictures anywhere to start scenes from them.</span>
        <button className="sh-icon" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.12, +(z - 0.15).toFixed(2)))}>−</button>
        <span className="flow-zoom">{Math.round(zoom * 100)}%</span>
        <button className="sh-icon" title="Fit the whole story, every subplot, on screen" onClick={() => { const w = area.current?.clientWidth ?? 0; if (w && width) { setZoom(Math.max(0.12, Math.min(1, +((w - 24) / width).toFixed(2)))); area.current?.scrollTo({ left: 0 }); } }}>Fit</button>
        <button className="sh-icon" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)))}>+</button>
      </div>
      <div className="flow-wrap">
      {/* Lane names stay pinned to the left edge while the plane scrolls under them. */}
      <div className="flow-labels" aria-hidden>
        {lanes.map((lane, i) => (
          <span key={lane.id ?? "main"} className="flow-lane-name" style={{ top: i * LANE * zoom - top + 8, borderColor: lane.color }}>
            {lane.name}
          </span>
        ))}
      </div>
      <div
        ref={area}
        onScroll={(e) => setTop(e.currentTarget.scrollTop)}
        className={`flow-area${hover ? " dropping" : ""}`}
        onPointerMove={move}
        onPointerUp={up}
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes("Files")) {
            e.preventDefault();
            setHover(true);
          }
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => void dropFiles(e)}
      >
        <div className="flow-plane" style={{ width: width * zoom, height: height * zoom }}>
          <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0", position: "relative" }}>
            {lanes.map((lane, i) => (
              <div key={lane.id ?? "main"} className="flow-lane" style={{ top: i * LANE, height: LANE, width }} />
            ))}
            <svg className="flow-lines" width={width} height={height} aria-hidden>
              {shownThreads.map((e) => (
                <path key={`${e.thread}-${e.from}-${e.to}`} d={curve(center(e.from), center(e.to))} stroke={e.color} className="flow-thread" />
              ))}
              {story.map((e) => (
                <path key={`s-${e.from}-${e.to}`} d={curve(center(e.from), center(e.to))} className="flow-story" />
              ))}
            </svg>
            {project.shots.map((s, i) => {
              const node = at.get(s.id)!;
              const p = drag?.id === s.id && drag.moved ? { x: drag.x, y: drag.y } : pos(node.col, node.lane);
              const cast = project.threads.filter((t) => t.kind === "character" && s.threadIds.includes(t.id));
              return (
                <article
                  key={s.id}
                  className={`flow-card${selected === s.id ? " picked" : ""}${stale.includes(s.id) ? " stale" : ""}${drag?.id === s.id && drag.moved ? " lifted" : ""}`}
                  style={{ left: p.x, top: p.y, width: CARD_W, height: CARD_H }}
                  onPointerDown={(e) => down(e, s.id)}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(s.id)}
                  tabIndex={0}
                  aria-label={`Shot ${i + 1}: ${s.heading || "untitled"}`}
                >
                  <div className="flow-frame">
                    {running.includes(s.id) ? (
                      <span className="shot-busy" />
                    ) : s.render ? (
                      s.render.kind === "video" ? <video src={s.render.url} muted playsInline preload="metadata" /> : <img src={s.render.url} alt="" draggable={false} />
                    ) : (
                      <span className="shot-empty">not shot</span>
                    )}
                    <span className="flow-no">{i + 1}</span>
                    {s.seconds ? <span className="flow-secs">{s.seconds}s</span> : null}
                  </div>
                  <p className="flow-title">{s.heading || s.beat.slice(0, 40) || "Untitled shot"}</p>
                  <div className="flow-cast">
                    {cast.slice(0, 4).map((c) => (
                      c.ref ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={c.id} className="flow-face" src={c.ref} alt={c.name} title={c.name} draggable={false} style={{ borderColor: c.color }} />
                      ) : (
                        <i key={c.id} style={{ background: c.color }} title={c.name}>{c.name.slice(0, 1)}</i>
                      )
                    ))}
                    {cast.length > 4 && <em>+{cast.length - 4}</em>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
