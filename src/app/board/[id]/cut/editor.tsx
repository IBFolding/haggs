"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { atTime, buildCut, cutList, ffmpegScript } from "../../../../story/cut";
import { defaultKv } from "../../../../story/kv";
import type { Project } from "../../../../story/model";
import { createProjectStore } from "../../../../story/store";
import { createSaveQueue } from "../../../../story/use-autosave";
import { Nav } from "../../../nav";

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

export function Editor({ id }: { id: string }) {
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

  useEffect(() => {
    void store.load(id).then((found) => {
      if (found) setProject(found);
      else setMissing(true);
    });
  }, [store, id]);

  const cut = useMemo(() => (project ? buildCut(project) : null), [project]);
  const here = cut ? atTime(cut, t) : null;

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
  const offset = here?.offset ?? 0;

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (Math.abs(el.currentTime - offset) > 0.35) el.currentTime = offset;
    if (playing && el.paused) void el.play().catch(() => undefined);
    if (!playing && !el.paused) el.pause();
  }, [clipId, offset, playing]);

  const setSeconds = useCallback(
    (shotId: string, seconds: number | null) => {
      setProject((current) => {
        if (!current) return current;
        const next = {
          ...current,
          shots: current.shots.map((s) => (s.id === shotId ? { ...s, seconds } : s)),
        };
        saves.queue(next);
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
        <Nav current="Library" />
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

  if (!project || !cut) return <div className="app"><Nav current="Library" /></div>;

  const selected = cut.clips.find((c) => c.shotId === picked) ?? here?.clip ?? null;
  const shot = selected ? project.shots.find((s) => s.id === selected.shotId) : undefined;

  return (
    <div className="app">
      <Nav current="Library" />

      <div className="cut">
        <header className="board-head">
          <h1 className="cut-title">{project.name}</h1>
          <span className="board-count">
            {cut.clips.length} clip{cut.clips.length === 1 ? "" : "s"} · {clock(cut.total)}
          </span>
          <Link className="plain" href={`/board/${id}`}>
            Back to the board
          </Link>
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
                  className={`clip${selected?.shotId === clip.shotId ? " picked" : ""}`}
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
              </div>
            )}

            <div className="exports">
              <button
                className="pill"
                onClick={() => download(`${project.name}.cut.json`, cutList(cut, project.name), "application/json")}
              >
                Cut list (.json)
              </button>
              <button
                className="pill on"
                onClick={() => download(`${project.name}.sh`, ffmpegScript(cut, project.name), "text/x-shellscript")}
              >
                Export as MP4 (ffmpeg script)
              </button>
              <span className="exports-note">
                The script downloads each clip and joins them at 1920×1080 with ffmpeg
                installed. Run it with <code>bash</code>.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
