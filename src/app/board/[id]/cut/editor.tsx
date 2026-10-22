"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { atTime, buildCut, cutList, ffmpegScript } from "../../../../story/cut";
import { Soundtrack, usePreviewSound, VoiceLines } from "./sound";
import { moveShot, newShot, type Shot } from "../../../../story/model";
import { bridgeFrames, bridgingShot } from "../../../../story/bridge";
import { cloudEstimate } from "../../../../providers/cloud-price";
import { frameAt } from "../../../cut-actions";
import { addTake, chooseTake, cycleTake, removeTake, splitShot, takesOf, toggleFavorite } from "../../../../story/takes";
import { shoot } from "../../../shoot";
import { EditTools } from "./tools";
import { defaultKv } from "../../../../story/kv";
import type { Project } from "../../../../story/model";
import { commit, view } from "../../../../story/boards";
import { createProjectStore } from "../../../../story/store";
import { createSaveQueue } from "../../../../story/use-autosave";
import { Nav, openKeys } from "../../../nav";
import { PROJECT_SAVED } from "../../../agent";
import { ProjectTabs } from "../../../project-tabs";

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

export function Editor({ id, boardId }: { id: string; boardId?: string | undefined }) {
  /** The whole project; the state below is one board's view of it. */
  const full = useRef<Project | null>(null);
  const store = useMemo(() => createProjectStore(defaultKv()), []);
  const saves = useMemo(() => createSaveQueue(store), [store]);

  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const tRef = useRef(0);
  const track = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

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
  const [rendered, setRendered] = useState<{ url: string } | { reason: string } | null>(null);

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

  /** Any edit to the board from the editor, saved the same way the board saves. */
  const apply = useCallback(
    (change: (current: Project) => Project) => {
      setProject((current) => {
        if (!current) return current;
        const next = change(current);
        saves.queue((full.current = commit(full.current ?? next, boardId, next)));
        return next;
      });
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
  async function rollAgain(shotId: string) {
    if (!project) return;
    setProblem(null);
    setRolling(shotId);
    const result = await shoot(project, project.shots.findIndex((s) => s.id === shotId));
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
      const result = await shoot(placed, plan.insertAt);
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
    (shotId: string, seconds: number | null) => {
      setProject((current) => {
        if (!current) return current;
        const next = {
          ...current,
          shots: current.shots.map((s) => (s.id === shotId ? { ...s, seconds } : s)),
        };
        saves.queue((full.current = commit(full.current ?? next, boardId, next)));
        return next;
      });
    },
    [saves],
  );

  const scrub = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!cut || !track.current) return;
      const box = track.current.getBoundingClientRect();
      const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      seek(fraction * cut.total);
    },
    [cut, seek],
  );

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

  return (
    <div className="app">
      <Nav current="Projects" />
      <ProjectTabs project={full.current ?? project} boardId={boardId} current="cut" />

      <div className="cut">
        <header className="board-head">
          <h1 className="cut-title">{project.name}</h1>
          <span className="board-count">
            {cut.clips.length} clip{cut.clips.length === 1 ? "" : "s"} · {clock(cut.total)}
          </span>
        </header>

        {cut.clips.length === 0 ? (
          <div className="library-blank">
            <p>Nothing to cut yet.</p>
            <p className="library-blank-sub">
              The cut is made of the shots you have rendered, in board order.{" "}
              <Link href={`/board/${id}`}>Shoot one on the board</Link> and it appears here.
            </p>
          </div>
        ) : (
          <>
            <div className="stage">
              {here &&
                (here.clip.kind === "video" ? (
                  <video
                    key={here.clip.shotId}
                    ref={video}
                    src={here.clip.url}
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <img key={here.clip.shotId} src={here.clip.url} alt={here.clip.heading} />
                ))}
              {here && <span className="stage-slate">{here.clip.heading || `Shot ${here.clip.index + 1}`}</span>}
            </div>

            <div className="transport">
              <button
                className="fire"
                onClick={() => {
                  if (!playing && t >= cut.total) seek(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? "Pause" : t >= cut.total ? "Replay" : "Play"}
              </button>
              <span className="transport-time">
                {clock(t)} <i>/</i> {clock(cut.total)}
              </span>
              {cut.skipped.length > 0 && (
                <span className="transport-note">
                  {cut.skipped.length} shot{cut.skipped.length === 1 ? "" : "s"} not shot yet, so not in the cut
                </span>
              )}
            </div>

            <div
              className="timeline"
              ref={track}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                scrub(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) scrub(event);
              }}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={cut.total}
              aria-valuenow={Math.round(t * 10) / 10}
              tabIndex={0}
              onKeyDown={(event) => {
                // Up and down flip the clip under the playhead between its takes.
                if ((event.key === "ArrowUp" || event.key === "ArrowDown") && here) {
                  event.preventDefault();
                  onShot(here.clip.shotId, (s) => cycleTake(s, event.key === "ArrowUp" ? -1 : 1));
                }
                if (event.key === "ArrowRight") seek(Math.min(cut.total, t + 0.5));
                if (event.key === "ArrowLeft") seek(Math.max(0, t - 0.5));
                if (event.key === " ") {
                  event.preventDefault();
                  setPlaying((p) => !p);
                }
              }}
            >
              {cut.clips.map((clip) => (
                <button
                  key={clip.shotId}
                  draggable
                  onDragStart={(e) => { dragged.current = clip.shotId; e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { if (dragged.current) { e.preventDefault(); setDropAt(clip.shotId); } }}
                  onDragLeave={() => setDropAt((d) => (d === clip.shotId ? null : d))}
                  onDrop={(e) => { e.preventDefault(); dropOn(clip.shotId); }}
                  onDragEnd={() => { dragged.current = null; setDropAt(null); }}
                  className={`clip${selected?.shotId === clip.shotId ? " picked" : ""}${dropAt === clip.shotId ? " drop" : ""}`}
                  style={{ flexGrow: clip.seconds, flexBasis: 0 }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setPicked(clip.shotId);
                    seek(clip.start);
                  }}
                  title={`${clip.heading || "Shot"} — ${clip.seconds}s`}
                >
                  {clip.kind === "video" ? (
                    <video src={`${clip.url}#t=0.1`} muted preload="metadata" />
                  ) : (
                    <img src={clip.url} alt="" />
                  )}
                  <span className="clip-label">{clip.heading || `Shot ${clip.index + 1}`}</span>
                  <span className="clip-len">{clip.seconds}s</span>
                </button>
              ))}
              <span className="playhead" style={{ left: `${(t / cut.total) * 100}%` }} />
            </div>

            {selected && shot && (
              <div className="clip-inspect">
                <b>{selected.heading || `Shot ${selected.index + 1}`}</b>
                <label>
                  Holds for
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={shot.seconds ?? selected.seconds}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSeconds(shot.id, Number.isFinite(value) && value > 0 ? value : null);
                    }}
                  />
                  seconds
                </label>
                {shot.seconds !== null && (
                  <button className="plain" onClick={() => setSeconds(shot.id, null)}>
                    Use the {selected.kind === "video" ? "model's" : "default"} length
                  </button>
                )}
                <label className="clip-lock" title="Title cards, black, anything finished: Animate stills leaves it alone">
                  <input type="checkbox" checked={shot.locked === true} onChange={(e) => onShot(shot.id, (s) => { const { locked: _l, ...rest } = s; return e.target.checked ? { ...rest, locked: true } : rest; })} />
                  Keep as it is
                </label>
                <div className="clip-actions">
                  <button className="pill on" disabled={rolling === shot.id} onClick={() => void rollAgain(shot.id)}>
                    {rolling === shot.id ? "Rolling…" : "Roll again"}
                  </button>
                  <button
                    className="pill"
                    disabled={!(t > selected.start + 0.1 && t < selected.start + selected.seconds - 0.1)}
                    title="Move the playhead inside this clip to split it there"
                    onClick={() => apply((current) => splitShot(current, shot.id, Math.round((t - selected.start) * 30) / 30))}
                  >
                    Split at playhead
                  </button>
                  <button
                    className="pill"
                    onClick={() =>
                      apply((current) => {
                        const at = current.shots.findIndex((s) => s.id === shot.id);
                        const shots = [...current.shots];
                        shots.splice(at + 1, 0, { ...newShot(), heading: shot.heading, threadIds: [...shot.threadIds] });
                        return { ...current, shots };
                      })
                    }
                  >
                    Insert a shot after
                  </button>
                  <button
                    className="pill"
                    disabled={expanding !== null || !cut.clips.some((c) => c.index > selected.index)}
                    title="Make a shot between this one and the next: it starts on this shot's last frame and ends on the next one's first"
                    onClick={() => void expand(shot.id, "bridge")}
                  >
                    {expanding === `${shot.id}:bridge` ? "Bridging…" : `Bridge to next · $${expandPrice.toFixed(2)}`}
                  </button>
                  <button
                    className="pill"
                    disabled={expanding !== null}
                    title="Carry this shot on from its last frame"
                    onClick={() => void expand(shot.id, "extend")}
                  >
                    {expanding === `${shot.id}:extend` ? "Extending…" : `Extend · $${expandPrice.toFixed(2)}`}
                  </button>
                </div>
                {problem && <p className="library-error" role="alert">{problem}</p>}
                <div className="takes" role="group" aria-label="Takes">
                  {takesOf(shot).map((take, i) => {
                    const on = take.url === shot.render?.url && take.at === shot.render?.at;
                    return (
                      <figure key={take.id} className={`take${on ? " on" : ""}`}>
                        <button className="take-pick" onClick={() => onShot(shot.id, (s) => chooseTake(s, take.id))} aria-pressed={on} title={on ? "On the shot" : "Put this take on the shot"}>
                          {take.kind === "video" ? <video src={`${take.url}#t=0.3`} muted preload="metadata" /> : <img src={take.url} alt="" />}
                        </button>
                        <figcaption>
                          <span>Take {i + 1}{take.origin ? ` · ${take.origin}` : ""}{take.usd !== null ? ` · $${take.usd.toFixed(2)}` : ""}</span>
                          <button className={`take-star${take.favorite ? " on" : ""}`} aria-label={take.favorite ? "Unstar" : "Star"} onClick={() => onShot(shot.id, (s) => toggleFavorite(s, take.id))}>★</button>
                          {!on && <button className="take-x" aria-label="Remove take" onClick={() => onShot(shot.id, (s) => removeTake(s, take.id))}>×</button>}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
                <p className="takes-note">↑ ↓ on the timeline flip between takes. Rolling again adds a take and never replaces one.</p>
                <VoiceLines shot={shot} project={project} onChange={(voices) => onShot(shot.id, (s) => ({ ...s, voices }))} />
                <EditTools
                  project={project}
                  shot={shot}
                  stage={video}
                  playhead={here && here.clip.shotId === shot.id ? (here.clip.from ?? 0) + here.offset : 0}
                  onTake={(shotId, render, origin) => onShot(shotId, (s) => addTake(s, render, origin))}
                />
              </div>
            )}

            <Soundtrack
              music={project.music}
              onChange={(music) =>
                apply((current) => {
                  const { music: _old, ...rest } = current;
                  return music ? { ...rest, music } : rest;
                })
              }
            />

            <div className="exports">
              {process.env.NODE_ENV !== "production" && (
                <button
                  className="pill on"
                  disabled={rendering}
                  onClick={async () => {
                    setRendering(true);
                    setRendered(null);
                    const res = await fetch("/api/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: project.name, cut }) }).catch(() => null);
                    const body = (await res?.json().catch(() => null)) as { ok?: boolean; url?: string; reason?: string } | null;
                    setRendered(body?.ok && body.url ? { url: body.url } : { reason: body?.reason ?? "The render didn't finish." });
                    setRendering(false);
                  }}
                >
                  {rendering ? "Rendering…" : "Render MP4"}
                </button>
              )}
              <button
                className="pill"
                onClick={() => download(`${project.name}.cut.json`, cutList(cut, project.name), "application/json")}
              >
                Cut list (.json)
              </button>
              <button
                className="pill"
                onClick={() => download(`${project.name}.sh`, ffmpegScript(cut, project.name, window.location.origin), "text/x-shellscript")}
              >
                Export as MP4 (ffmpeg script)
              </button>
              {rendered && ("url" in rendered ? (
                <span className="exports-done" role="status">
                  Rendered. <a href={rendered.url} target="_blank" rel="noreferrer">Watch it</a> · <a href={rendered.url} download>Download</a>
                </span>
              ) : (
                <span className="library-error" role="alert">{rendered.reason}</span>
              ))}
              <span className="exports-note">
                Render MP4 makes the film on this machine, voices and soundtrack mixed in, and keeps it
                next to your media. The script does the same anywhere ffmpeg is installed: run it with{" "}
                <code>bash</code> while haggs is open.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
