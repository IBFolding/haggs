"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SHEET, layout, parseSheet, type Timeline } from "../../kinetic/beats";
import { drawFrame } from "../../kinetic/draw";
import { ModeTabs } from "../mode-tabs";
import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";

const W = 1280, H = 720, FPS = 30;

/** Draws one frame with motion blur: a few moments across the shutter, averaged. */
function frame(main: HTMLCanvasElement, tmp: HTMLCanvasElement, timeline: Timeline, seconds: number) {
  const mc = main.getContext("2d")!, tc = tmp.getContext("2d")!;
  const N = 4, shutter = (1 / FPS) * 0.9;
  for (let k = 0; k < N; k++) {
    tc.clearRect(0, 0, W, H);
    if (!drawFrame(tc, W, H, timeline, seconds + (k / (N - 1) - 0.5) * shutter)) { mc.fillStyle = "#0a0b0c"; mc.fillRect(0, 0, W, H); return; }
    mc.globalAlpha = 1 / (k + 1);
    mc.drawImage(tmp, 0, 0);
  }
  mc.globalAlpha = 1;
}

/** A short low thud, scheduled on the audio clock, so every cut lands with a hit. */
function thud(ac: AudioContext, at: number, out: AudioNode) {
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.frequency.setValueAtTime(130, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.18);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.7, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.25);
}

/**
 * Kinetic film: type the words, set the tempo, drop in a track, press play. Big words slam in on the beat with
 * whip-pan cuts and a hit on every cut. Export records the preview to a video file. Free, and it all runs in your browser.
 */
export function Kinetic() {
  const [sheet, setSheet] = useState(DEFAULT_SHEET);
  const [music, setMusic] = useState<{ url: string; name: string } | null>(null);
  const [hits, setHits] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<{ url: string; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const parsed = useMemo(() => parseSheet(sheet), [sheet]);
  const timeline = useMemo(() => layout(parsed), [parsed]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tmp = useRef<HTMLCanvasElement | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const run = useRef<{ stop: () => void } | null>(null);

  useEffect(() => { tmp.current = document.createElement("canvas"); tmp.current.width = W; tmp.current.height = H; }, []);
  useEffect(() => { if (canvas.current && tmp.current && !playing) frame(canvas.current, tmp.current, timeline, Math.min(0.3 * timeline.secondsPerBeat * 2, Math.max(0, timeline.totalSeconds - 0.01))); }, [timeline, playing]);
  useEffect(() => () => run.current?.stop(), []);
  useEffect(() => () => { if (music) URL.revokeObjectURL(music.url); }, [music]);

  /** Plays the film; with `record`, also captures it to a video blob. */
  async function play(record: boolean) {
    if (!canvas.current || !tmp.current || timeline.totalSeconds <= 0) return;
    run.current?.stop();
    setProblem(null); setDone(null);
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const master = ac.createGain();
    master.connect(dest);
    if (!record) master.connect(ac.destination);
    let el: HTMLAudioElement | null = null;
    if (music && audio.current) {
      el = audio.current; el.currentTime = 0;
      const src = ac.createMediaElementSource(el); const g = ac.createGain(); g.gain.value = 0.9; src.connect(g).connect(master);
    }
    await ac.resume();
    const t0 = ac.currentTime + 0.15;
    if (hits) for (const it of timeline.items) thud(ac, t0 + it.startSeconds, master);
    if (el) { el.muted = false; await el.play().catch(() => undefined); }
    let recorder: MediaRecorder | null = null; const chunks: Blob[] = [];
    if (record) {
      if (typeof MediaRecorder === "undefined") { setProblem("This browser can't record video. Try Chrome."); await ac.close(); return; }
      const stream = canvas.current.captureStream(FPS);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const type = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 12_000_000 });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250); setExporting(true);
    }
    setPlaying(true);
    let raf = 0, stopped = false;
    const finish = async () => {
      if (stopped) return; stopped = true; cancelAnimationFrame(raf); el?.pause();
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((res) => { recorder!.onstop = () => res(); recorder!.stop(); });
        const type = recorder.mimeType || "video/webm";
        setDone({ url: URL.createObjectURL(new Blob(chunks, { type })), name: type.includes("mp4") ? "kinetic-film.mp4" : "kinetic-film.webm" });
      }
      setExporting(false); setPlaying(false); void ac.close(); run.current = null;
    };
    run.current = { stop: () => void finish() };
    const tick = () => {
      const t = ac.currentTime - t0;
      if (t >= timeline.totalSeconds + (record ? 0.4 : 0)) return void finish();
      frame(canvas.current!, tmp.current!, timeline, Math.max(0, t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function addMusic(file: File) {
    if (!file.type.startsWith("audio/")) return setProblem("Add an audio file (mp3, wav, m4a).");
    setProblem(null);
    setMusic({ url: URL.createObjectURL(file), name: file.name });
  }

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/kinetic" />
          <header className="swap-head">
            <h1>Kinetic film</h1>
            <p>Type the words, set the tempo, drop in a track. Big words slam in on the beat, cut with a whip pan, and land with a hit. Press Play, then export the video. Free, and it all runs in your browser.</p>
          </header>

          <div className="kn-grid">
            <div>
              <label className="wf-field"><span>The film: <b>bpm 150</b> sets the tempo, then one line per block: WORDS | beats | style (white, green, flip, invert, red)</span>
                <textarea className="kn-sheet" rows={14} value={sheet} spellCheck={false} onChange={(e) => setSheet(e.target.value)} />
              </label>
              {parsed.problems.map((p) => <p key={p} className="library-error" role="alert">{p}</p>)}
              <div className="cm-row">
                <label className="pill">{music ? "Change the track" : "Add a track"}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addMusic(f); }} /></label>
                {music && <span className="muted">{music.name}</span>}
              </div>
              <label className="cm-row"><input type="checkbox" checked={hits} onChange={(e) => setHits(e.target.checked)} /> <span>A hit on every cut</span></label>
              <p className="muted">{parsed.blocks.length} blocks · {parsed.bpm} bpm · {timeline.totalSeconds.toFixed(1)} seconds. Line your track up by starting it on the first beat.</p>
            </div>
            <div>
              <canvas ref={canvas} width={W} height={H} className="kn-canvas" aria-label="Preview" />
              <div className="cm-row">
                {playing && !exporting ? <button className="fire" onClick={() => run.current?.stop()}>Stop</button> : <button className="fire" disabled={exporting || parsed.blocks.length === 0} onClick={() => void play(false)}>Play</button>}
                <button className="pill" disabled={playing || parsed.blocks.length === 0} onClick={() => void play(true)}>{exporting ? "Recording…" : "Export video"}</button>
                {done && <a className="pill" href={done.url} download={done.name}>Download {done.name}</a>}
              </div>
              {problem && <p className="library-error" role="alert">{problem}</p>}
              <p className="muted">Export records the preview as it plays, so it takes as long as the film. Keep this tab open until it finishes.</p>
            </div>
          </div>
          {/* The track plays through the page's audio context, so the element itself stays hidden. */}
          {music && <audio ref={audio} src={music.url} preload="auto" hidden />}
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
