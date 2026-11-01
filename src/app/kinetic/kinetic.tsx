"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_SHEET, layout, parseSheet, type Timeline } from "../../kinetic/beats";
import { setTempo } from "../../kinetic/controls";
import { DEFAULT_MOTION, DEFAULT_THEME, FONTS, drawFrame, type Look, type Media, type Motion, type Transition } from "../../kinetic/draw";
import { encodeWav, joinSamples, musicParts } from "../../kinetic/audio";
import { FILM_TEMPLATES, buildFilm, filmDefaults } from "../../kinetic/film-templates";
import { detectTempo } from "../../kinetic/tempo";
import { insertLine, kindOf, scopeClipOccurrences, slugName, uniqueName } from "../../kinetic/media";
import { seekSeconds, syncClips, syncFilmClips } from "../../kinetic/playback";
import { referenceStates, TEMPLATES } from "../../kinetic/templates";
import { defaultKv } from "../../story/kv";
import { createRunStore, type Run } from "../../story/runs";
import { makeMusic, quoteMusic } from "../actions";
import { ModeTabs } from "../mode-tabs";
import { Nav, openKeys } from "../nav";
import { SiteFooter } from "../site-footer";

const W0 = 1280, H0 = 720, FPS = 30;
const FORMATS = { wide: { label: "Wide 16:9", w: 1280, h: 720 }, vertical: { label: "Vertical 9:16", w: 720, h: 1280 }, square: { label: "Square 1:1", w: 1000, h: 1000 } } as const;
type Format = keyof typeof FORMATS;

type Entry = { name: string; kind: "image" | "clip"; url: string; el: HTMLImageElement | HTMLVideoElement; width: number; height: number };

function loadEntry(name: string, kind: "image" | "clip", url: string): Promise<Entry> {
  return new Promise((resolve, reject) => {
    const cross = /^https?:/.test(url) ? "anonymous" : null;
    if (kind === "image") {
      const el = new Image();
      if (cross) el.crossOrigin = cross;
      el.onload = () => resolve({ name, kind, url, el, width: el.naturalWidth, height: el.naturalHeight });
      el.onerror = () => reject(new Error("That picture couldn't be opened."));
      el.src = url;
    } else {
      const el = document.createElement("video");
      if (cross) el.crossOrigin = cross;
      el.muted = true; el.playsInline = true; el.preload = "auto";
      el.onloadeddata = () => resolve({ name, kind, url, el, width: el.videoWidth, height: el.videoHeight });
      el.onerror = () => reject(new Error("That clip couldn't be opened."));
      el.src = url;
    }
  });
}

/** Draws one frame with motion blur: a few moments across the shutter, averaged. */
export function frame(main: HTMLCanvasElement, tmp: HTMLCanvasElement, timeline: Timeline, seconds: number, media: Media, motion: Motion, onSample?: (seconds: number) => void, look: Look = {}, blur = true) {
  const mc = main.getContext("2d")!, tc = tmp.getContext("2d")!, W = main.width || W0, H = main.height || H0;
  const N = blur ? 4 : 1, shutter = (1 / FPS) * 0.9;
  for (let k = 0; k < N; k++) {
    const sample = seconds + (N > 1 ? (k / (N - 1) - 0.5) * shutter : 0);
    tc.clearRect(0, 0, W, H);
    onSample?.(sample);
    if (!drawFrame(tc, W, H, timeline, sample, media, motion, look)) { mc.fillStyle = look.theme?.ink ?? "#0a0b0c"; mc.fillRect(0, 0, W, H); return; }
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
 * Kinetic film: type the words, set the tempo, drop in a track. Big words slam in on the beat with whip-pan cuts and a
 * hit on every cut, with pictures and clips (yours, your Gallery's, or a recording of this app) punching in between
 * them, and counters that count up. Export records the preview to a video file. It all runs in your browser.
 */
export function Kinetic() {
  const [sheet, setSheet] = useState(DEFAULT_SHEET);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [music, setMusic] = useState<{ url: string; name: string } | null>(null);
  const [nudge, setNudge] = useState(0);
  const [hits, setHits] = useState(true);
  const [motion, setMotion] = useState<Motion>(DEFAULT_MOTION);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<{ url: string; name: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Run[]>([]);
  const [musicWords, setMusicWords] = useState("driving electronic, punchy drums, big drop");
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [format, setFormat] = useState<Format>("wide");
  const [ink, setInk] = useState(DEFAULT_THEME.ink);
  const [accent, setAccent] = useState(DEFAULT_THEME.accent);
  const [font, setFont] = useState(FONTS[0]!.id);
  const [transition, setTransition] = useState<Transition>("whip");
  const [blur, setBlur] = useState(true);
  const [templateId, setTemplateId] = useState(FILM_TEMPLATES[0]!.id);
  const [values, setValues] = useState<Record<string, string>>(() => filmDefaults(FILM_TEMPLATES[0]!));
  const [note, setNote] = useState<string | null>(null);
  const { w: W, h: H } = FORMATS[format];
  const look = useMemo<Look>(() => ({ theme: { ink, accent, font: FONTS.find((f) => f.id === font)!.css }, transition }), [ink, accent, font, transition]);
  const parsed = useMemo(() => parseSheet(sheet), [sheet]);
  const timeline = useMemo(() => layout(parsed), [parsed]);
  const scoped = useMemo(() => {
    const baseMedia = Object.fromEntries(entries.map((e) => [e.name, { el: e.el, width: e.width, height: e.height }]));
    const baseClips = Object.fromEntries(entries.filter((e) => e.kind === "clip").map((e) => [e.name, e.el as HTMLVideoElement]));
    return scopeClipOccurrences(timeline, baseMedia, baseClips, (source) => {
      const clone = source.cloneNode() as HTMLVideoElement;
      clone.muted = true; clone.playsInline = true; clone.preload = "auto";
      return clone;
    });
  }, [entries, timeline]);
  const media: Media = scoped.media;
  const clipEls = scoped.clips;
  const parts = useMemo(() => musicParts(timeline.totalSeconds + 2), [timeline.totalSeconds]);
  const previewSeconds = seekSeconds(timeline, playhead ?? Math.min(timeline.secondsPerBeat * 0.6, Math.max(0, timeline.totalSeconds - 0.01)));
  const canvas = useRef<HTMLCanvasElement>(null);
  const tmp = useRef<HTMLCanvasElement | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const run = useRef<{ stop: () => void } | null>(null);
  const grab = useRef<{ stop: () => void } | null>(null);

  useEffect(() => { tmp.current = document.createElement("canvas"); tmp.current.width = W; tmp.current.height = H; }, [W, H]);
  useEffect(() => { void createRunStore(defaultKv()).list().then((all) => setGallery(all.filter((r) => r.kind !== "audio").slice(0, 24))).catch(() => undefined); }, []);
  useEffect(() => { void Promise.all(parts.map((p) => quoteMusic(p))).then((all) => setPrice(all.reduce((a, b) => a + b, 0))).catch(() => setPrice(null)); }, [parts]);
  useEffect(() => {
    if (!canvas.current || !tmp.current || playing) return;
    const draw = () => frame(canvas.current!, tmp.current!, timeline, previewSeconds, media, motion, (sample) => syncClips(clipEls, timeline, sample, false, motion.whipBeats, 0, true), look, blur);
    draw();
    // A video paints its new frame asynchronously after currentTime changes.
    const clips = Object.values(clipEls);
    clips.forEach((clip) => clip.addEventListener("seeked", draw));
    return () => clips.forEach((clip) => clip.removeEventListener("seeked", draw));
  }, [timeline, media, clipEls, playing, previewSeconds, motion, look, blur, W, H]);
  useEffect(() => () => { run.current?.stop(); grab.current?.stop(); }, []);

  const names = entries.map((e) => e.name);
  const add = useCallback(async (url: string, kind: "image" | "clip", wanted: string) => {
    try {
      const entry = await loadEntry(uniqueName(wanted, names), kind, url);
      setEntries((all) => [...all, entry]);
      setSheet((s) => insertLine(s, `@${kind} ${entry.name} | ${kind === "clip" ? 3 : 2} | `));
      setProblem(null);
    } catch (e) { setProblem(e instanceof Error ? e.message : "That couldn't be added."); }
  }, [names]);

  async function addFiles(files: FileList) {
    for (const f of Array.from(files)) {
      const kind = kindOf(f.type);
      if (!kind) { setProblem(`${f.name} isn't a picture or a clip.`); continue; }
      await add(URL.createObjectURL(f), kind, slugName(f.name));
    }
  }

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
      el = audio.current; el.currentTime = nudge < 0 ? -nudge : 0;
      const src = ac.createMediaElementSource(el); const g = ac.createGain(); g.gain.value = 0.9; src.connect(g).connect(master);
    }
    await ac.resume();
    const t0 = ac.currentTime + 0.15;
    if (hits) for (const it of timeline.items) thud(ac, t0 + it.startSeconds, master);
    let delay = 0;
    if (el) { el.muted = false; if (nudge > 0) delay = window.setTimeout(() => void el!.play().catch(() => undefined), nudge * 1000); else await el.play().catch(() => undefined); }
    let recorder: MediaRecorder | null = null; const chunks: Blob[] = [];
    if (record) {
      if (typeof MediaRecorder === "undefined") { setProblem("This browser can't record video. Try Chrome."); await ac.close(); return; }
      const stream = canvas.current.captureStream(FPS);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const type = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: timeline.totalSeconds > 120 ? 6_000_000 : 12_000_000 });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.start(250); setExporting(true);
    }
    setPlaying(true);
    let raf = 0, stopped = false;
    const clips = () => Object.values(clipEls);
    const finish = async () => {
      if (stopped) return; stopped = true; cancelAnimationFrame(raf); window.clearTimeout(delay); el?.pause(); clips().forEach((v) => v.pause());
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
      frame(canvas.current!, tmp.current!, timeline, Math.max(0, t), media, motion, (sample) => syncFilmClips(clipEls, timeline, sample, motion.whipBeats, 0, true), look, blur);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  async function addTrack(url: string, name: string) {
    setMusic((old) => { if (old) URL.revokeObjectURL(old.url); return { url, name }; });
  }

  function addMusicFile(file: File) {
    if (!file.type.startsWith("audio/")) return setProblem("Add an audio file (mp3, wav, m4a).");
    setProblem(null);
    void addTrack(URL.createObjectURL(file), file.name);
  }

  async function makeTrack() {
    setProblem(null);
    const words = `${musicWords.trim()}. ${parsed.bpm} BPM, steady beat, no vocals`;
    const made: ArrayBuffer[] = [];
    for (let i = 0; i < parts.length; i++) {
      setBusy(parts.length > 1 ? `Making music, part ${i + 1} of ${parts.length}…` : "Making the music…");
      const r = await makeMusic(words, parts[i]!);
      if (!r.ok) { setBusy(null); if (r.needsKey) openKeys(); return setProblem(r.reason); }
      try { made.push(await (await fetch(r.url)).arrayBuffer()); } catch { setBusy(null); return setProblem("The music was made but couldn't be loaded here. Open it from your Gallery and add it as a track."); }
    }
    try {
      if (made.length === 1) await addTrack(URL.createObjectURL(new Blob([made[0]!], { type: "audio/mpeg" })), `Made for ${parsed.bpm} bpm`);
      else {
        // Longer than the model allows in one go: decode the parts, join them with a crossfade, and keep one wav.
        const ac = new AudioContext();
        const bufs = await Promise.all(made.map((m) => ac.decodeAudioData(m.slice(0))));
        const rate = bufs[0]!.sampleRate;
        const joined = joinSamples(bufs.map((b) => b.getChannelData(0)), rate, 2);
        void ac.close();
        await addTrack(URL.createObjectURL(new Blob([encodeWav(joined, rate).buffer as ArrayBuffer], { type: "audio/wav" })), `Made for ${parsed.bpm} bpm, ${Math.round(joined.length / rate)} s`);
      }
    } catch { setProblem("The music was made but couldn't be put together here."); }
    setBusy(null);
  }

  const filmTemplate = FILM_TEMPLATES.find((t) => t.id === templateId)!;
  function pickFilmTemplate(id: string) { const t = FILM_TEMPLATES.find((x) => x.id === id)!; setTemplateId(id); setValues(filmDefaults(t)); }
  function useFilmTemplate() { setSheet(buildFilm(filmTemplate, values)); setPlayhead(null); setDone(null); setNote(`Loaded “${filmTemplate.name}”. Change any line, add pictures and clips between the words.`); }

  /** Listens to the track, finds its tempo and first beat, and sets the film's tempo and the nudge to match. */
  async function findTempo() {
    if (!music) return;
    setBusy("Listening…"); setProblem(null); setNote(null);
    try {
      const bytes = await (await fetch(music.url)).arrayBuffer();
      const ac = new AudioContext();
      const buf = await ac.decodeAudioData(bytes);
      void ac.close();
      const r = detectTempo(buf.getChannelData(0), buf.sampleRate);
      if (!r) setProblem("I couldn't find a steady beat in that track. Set the tempo by hand.");
      else { setSheet((cur) => setTempo(cur, r.bpm)); setNudge(-Math.round(r.firstBeat * 100) / 100); setNote(`Found ${r.bpm} bpm, with the first beat at ${r.firstBeat.toFixed(2)} s. The film's tempo is set and the track skips in to line the beat up.`); }
    } catch { setProblem("That track couldn't be read here."); }
    setBusy(null);
  }

  /** One still per block (plus the very first frame), on a sheet, to check the film without watching it. */
  function contactSheet() {
    if (!tmp.current || timeline.items.length === 0) return;
    const cols = format === "vertical" ? 6 : 4, tw = format === "vertical" ? 180 : 320, th = Math.round((tw * H) / W), pad = 8, label = 18;
    const every = Math.max(1, Math.ceil(timeline.items.length / 59));
    const cells = [{ t: 0.01, text: "frame 1" }, ...timeline.items.flatMap((it, i) => (i % every === 0 ? [{ t: it.startSeconds + it.block.beats * timeline.secondsPerBeat * 0.6, text: `${i + 1} · ${it.startSeconds.toFixed(1)}s` }] : []))];
    const rows = Math.ceil(cells.length / cols);
    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = cols * (tw + pad) + pad; sheetCanvas.height = rows * (th + label + pad) + pad;
    const sc = sheetCanvas.getContext("2d")!; sc.fillStyle = "#111"; sc.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    const full = document.createElement("canvas"); full.width = W; full.height = H; const fc = full.getContext("2d")!;
    cells.forEach((c, i) => {
      const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + label + pad);
      fc.clearRect(0, 0, W, H);
      const at = Math.min(c.t, timeline.totalSeconds - 0.01);
      syncClips(clipEls, timeline, at, false, motion.whipBeats, 0, true);
      drawFrame(fc, W, H, timeline, at, media, motion, look);
      sc.drawImage(full, x, y, tw, th); sc.fillStyle = "#bbb"; sc.font = "12px system-ui, sans-serif"; sc.fillText(c.text, x, y + th + 13);
    });
    sheetCanvas.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "kinetic-contact-sheet.png"; a.click(); }, "image/png");
  }

  /** Records this app (or any tab you choose) as a clip, ready to punch into the film. */
  async function startCapture() {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") return setProblem("This browser can't record the screen. Try Chrome on a computer.");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, { videoBitsPerSecond: 10_000_000 });
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stop = () => { if (rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); };
      rec.onstop = () => { setCapturing(false); grab.current = null; if (chunks.length) void add(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "video/webm" })), "clip", "app"); };
      stream.getVideoTracks()[0]?.addEventListener("ended", stop);
      grab.current = { stop }; rec.start(250); setCapturing(true); setProblem(null);
    } catch { setProblem("Screen recording wasn't started. Choose a tab or window when your browser asks."); }
  }

  const references = referenceStates(sheet, names);

  return (
    <div className="app">
      <Nav current="Video" />
      <div className="canvas">
        <div className="swap">
          <ModeTabs group="Video" current="/kinetic" />
          <header className="swap-head">
            <h1>Kinetic film</h1>
            <p>Type the words, set the tempo, drop in a track. Big words slam in on the beat and cut with a whip pan, with your pictures and clips punching in between and counters counting up. Press Play, then export the video. It all runs in your browser.</p>
          </header>

          <div className="kn-grid">
            <div>
              <h2 className="ads-h">Start with a production</h2>
              <div className="kn-templates" role="group" aria-label="Kinetic templates">
                {TEMPLATES.map((template) => (
                  <button key={template.id} className="pill" aria-pressed={sheet === template.sheet} onClick={() => { setSheet(template.sheet); setPlayhead(null); setDone(null); }}>
                    <b>{template.name}</b><small>{template.description}</small>
                  </button>
                ))}
              </div>
              <h2 className="ads-h">Or answer a few questions</h2>
              <div className="cm-cast" aria-label="Fill-in templates">
                {FILM_TEMPLATES.map((t) => <button key={t.id} className={t.id === templateId ? "on" : ""} aria-pressed={t.id === templateId} onClick={() => pickFilmTemplate(t.id)}><span>{t.name}</span></button>)}
              </div>
              <p className="muted">{filmTemplate.blurb}</p>
              <div className="kn-fields">
                {filmTemplate.fields.map((f) => <label key={f.id} className="wf-field"><span>{f.label}{f.hint ? ` (${f.hint})` : ""}</span><input value={values[f.id] ?? ""} maxLength={f.id === "claim" ? 60 : 40} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} /></label>)}
              </div>
              <div className="cm-row"><button className="pill" onClick={useFilmTemplate}>Use this template</button></div>
              {note && <p className="muted" role="status">{note}</p>}
              <h2 className="ads-h">Look</h2>
              <div className="kn-options">
                <label className="wf-field"><span>Shape</span><select value={format} onChange={(e) => setFormat(e.target.value as Format)}>{(Object.keys(FORMATS) as Format[]).map((k) => <option key={k} value={k}>{FORMATS[k].label}</option>)}</select></label>
                <label className="wf-field"><span>Font</span><select value={font} onChange={(e) => setFont(e.target.value)}>{FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
                <label className="wf-field"><span>Cut style</span><select value={transition} onChange={(e) => setTransition(e.target.value as Transition)}><option value="whip">Whip pan</option><option value="zoom">Zoom through</option></select></label>
                <label className="wf-field"><span>Background</span><input type="color" value={ink} onChange={(e) => setInk(e.target.value)} /></label>
                <label className="wf-field"><span>Accent</span><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} /></label>
              </div>
              <label className="cm-row"><input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /> <span>Motion blur</span></label>
              <h2 className="ads-h">Timing and motion</h2>
              <label className="wf-field"><span>Tempo · {parsed.bpm} BPM</span><input key={sheet} aria-label="Tempo BPM" type="number" min={60} max={220} step={1} defaultValue={parsed.bpm} onBlur={(e) => setSheet((current) => setTempo(current, e.target.valueAsNumber))} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
              <label className="wf-field"><span>Landing</span><select aria-label="Landing motion" value={motion.landing} onChange={(e) => setMotion((old) => ({ ...old, landing: e.target.value as Motion["landing"] }))}><option value="smooth">Smooth</option><option value="spring">Spring</option></select></label>
              <label className="wf-field"><span>Word and camera motion · {Math.round(motion.intensity * 100)}%</span><input aria-label="Motion strength" type="range" min={0} max={1.5} step={0.05} value={motion.intensity} onChange={(e) => setMotion((old) => ({ ...old, intensity: e.target.valueAsNumber }))} /></label>
              <label className="wf-field"><span>Whip pan · {motion.whipBeats === 0 ? "hard cut" : `${motion.whipBeats.toFixed(2)} beats`}</span><input aria-label="Whip-pan length" type="range" min={0} max={1} step={0.05} value={motion.whipBeats} onChange={(e) => setMotion((old) => ({ ...old, whipBeats: e.target.valueAsNumber }))} /></label>
              <label className="wf-field"><span>The film. <b>bpm {parsed.bpm}</b> sets the tempo. One block per line: <code>WORDS | beats | style</code> (white, green, flip, invert, red), <code>@image name | beats | label</code>, <code>@clip name | beats | label | zoom 0.7 0.4 2.2</code>, <code>@count $0.07 | beats | label</code>, <code>@stack ONE / TWO / THREE | beats | style</code>, <code>@bar 80 | beats | label</code></span>
                <textarea className="kn-sheet" rows={14} value={sheet} spellCheck={false} onChange={(e) => setSheet(e.target.value)} />
              </label>
              {parsed.problems.map((p) => <p key={p} className="library-error" role="alert">{p}</p>)}
              {references.filter((ref) => !ref.ready).map((ref) => <p key={ref.name} className="library-error" role="alert">The film uses “{ref.name}” but it isn’t added yet.</p>)}

              <h2 className="ads-h">Pictures and clips</h2>
              <div className="cm-row">
                <label className="pill">Add files<input type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files; if (f?.length) void addFiles(f); e.target.value = ""; }} /></label>
                {capturing ? <button className="fire" onClick={() => grab.current?.stop()}>Stop recording</button> : <button className="pill" onClick={() => void startCapture()} title="Record haggs or any tab as a clip. Open the page you want to show in another tab first.">Record the app</button>}
              </div>
              {references.length > 0 && (
                <ul className="kn-refs" aria-label="Media references">
                  {references.map((ref) => <li key={ref.name} className={ref.ready ? "ready" : "missing"}><span aria-hidden>{ref.ready ? "✓" : "○"}</span><b>{ref.name}</b><small>{ref.kind} · {ref.ready ? "ready" : "add below"}</small></li>)}
                </ul>
              )}
              {entries.length > 0 && (
                <ul className="kn-media">
                  {entries.map((e) => (
                    <li key={e.name}>
                      {e.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.url} alt="" /> : <video src={e.url} muted preload="metadata" />}
                      <b>{e.name}</b>
                      <button className="plain" onClick={() => setSheet((s) => insertLine(s, `@${e.kind} ${e.name} | ${e.kind === "clip" ? 3 : 2} | `))}>Insert</button>
                    </li>
                  ))}
                </ul>
              )}
              {gallery.length > 0 && (
                <details className="kn-gallery">
                  <summary>From your Gallery</summary>
                  <ul className="kn-media">
                    {gallery.map((r) => (
                      <li key={r.id}>
                        {r.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.url} alt="" loading="lazy" /> : <video src={r.url} muted preload="metadata" />}
                        <button className="plain" onClick={() => void add(r.url, r.kind === "video" ? "clip" : "image", slugName(r.modelName + "-" + r.id.slice(0, 4)))}>Add</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <h2 className="ads-h">The track</h2>
              <div className="cm-row">
                <label className="pill">{music ? "Change the track" : "Add a track"}<input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addMusicFile(f); }} /></label>
                {music && <span className="muted">{music.name}</span>}
              </div>
              <label className="wf-field"><span>Or make one on Comfy at {parsed.bpm} bpm</span><input value={musicWords} maxLength={300} onChange={(e) => setMusicWords(e.target.value)} /></label>
              <div className="cm-row"><button className="pill" disabled={busy !== null || musicWords.trim().length < 4} onClick={() => void makeTrack()}>{busy ?? (parts.length > 1 ? `Make music (${parts.length} parts)` : "Make music")} {price !== null && <span className="cost">about ${price.toFixed(2)}</span>}</button></div>
              {music && <div className="cm-row"><button className="pill" disabled={busy !== null} onClick={() => void findTempo()}>{busy === "Listening…" ? busy : "Find the tempo of this track"}</button></div>}
              <label className="wf-field"><span>Nudge the track (seconds; plus waits, minus skips in) to line its first beat up</span><input type="number" step={0.05} value={nudge} onChange={(e) => setNudge(Number(e.target.value) || 0)} /></label>
              <label className="cm-row"><input type="checkbox" checked={hits} onChange={(e) => setHits(e.target.checked)} /> <span>A hit on every cut</span></label>
              <p className="muted">{parsed.blocks.length} blocks · {parsed.bpm} bpm · {Math.floor(timeline.totalSeconds / 60)}:{String(Math.floor(timeline.totalSeconds % 60)).padStart(2, "0")}. A film can run up to 5 minutes.</p>
            </div>
            <div>
              <canvas ref={canvas} width={W} height={H} className="kn-canvas" style={{ aspectRatio: `${W} / ${H}`, ...(format === "vertical" ? { height: 680, width: "auto" } : { width: "100%" }), ...(format === "square" ? { maxWidth: 640 } : {}), margin: format === "wide" ? undefined : "0 auto" }} aria-label="Preview" />
              <label className="wf-field"><span>Seek the preview · {previewSeconds.toFixed(2)} / {timeline.totalSeconds.toFixed(2)} seconds</span>
                <input aria-label="Seek preview" type="range" min={0} max={Math.max(0.001, timeline.totalSeconds)} step={0.01} value={previewSeconds} disabled={playing || timeline.totalSeconds === 0} onChange={(e) => setPlayhead(seekSeconds(timeline, e.target.valueAsNumber))} />
              </label>
              <div className="cm-row">
                {playing && !exporting ? <button className="fire" onClick={() => run.current?.stop()}>Stop</button> : <button className="fire" disabled={exporting || parsed.blocks.length === 0} onClick={() => void play(false)}>Play</button>}
                <button className="pill" disabled={playing || parsed.blocks.length === 0} onClick={() => void play(true)}>{exporting ? "Recording…" : "Export video"}</button>
                <button className="pill" disabled={playing || parsed.blocks.length === 0} onClick={contactSheet} title="One still per block on a sheet, to check the film without watching it">Contact sheet</button>
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
