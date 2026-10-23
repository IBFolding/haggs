"use client";

import { useEffect, useRef, useState } from "react";

import { editEstimate, VOICES } from "../../../../providers/cloud-edits";
import type { Cut } from "../../../../story/cut";
import { BLEND } from "../../../../story/cut";
import type { Effect, Music, Project, Shot, Sound, VoiceLine } from "../../../../story/model";
import { openKeys } from "../../../nav";
import { makeEffect, quoteEffect, speakLine } from "../../../actions";

/**
 * The cut's sound: a soundtrack under the whole board, voice-over lines on
 * shots, and both played in the preview in time with the playhead.
 */

/** Plays the soundtrack and the voice lines in step with the cut's clock. */
export function usePreviewSound(cut: Cut | null, t: number, playing: boolean) {
  const music = useRef<HTMLAudioElement | null>(null);
  const voices = useRef(new Map<string, HTMLAudioElement>());
  const effects = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    if (!cut) return;
    const live2 = new Set((cut.effects ?? []).map((e) => e.id + e.url));
    for (const e of cut.effects ?? []) if (!effects.current.has(e.id + e.url)) effects.current.set(e.id + e.url, new Audio(e.url));
    for (const [key, el] of effects.current) if (!live2.has(key)) (el.pause(), effects.current.delete(key));
    const url = cut.music?.url;
    if (url && music.current?.dataset.src !== url) {
      music.current?.pause();
      music.current = new Audio(url);
      music.current.dataset.src = url;
    }
    if (!url && music.current) {
      music.current.pause();
      music.current = null;
    }
    const live = new Set(cut.voices.map((v) => v.id + v.url));
    for (const v of cut.voices) if (!voices.current.has(v.id + v.url)) voices.current.set(v.id + v.url, new Audio(v.url));
    for (const [key, el] of voices.current) if (!live.has(key)) (el.pause(), voices.current.delete(key));
  }, [cut]);

  useEffect(() => {
    if (!cut) return;
    const follow = (el: HTMLAudioElement, at: number, gain: number) => {
      el.volume = Math.min(1, Math.pow(10, gain / 20));
      const inside = at >= 0 && (!Number.isFinite(el.duration) || at < el.duration);
      if (!playing || !inside) {
        if (!el.paused) el.pause();
        return;
      }
      if (Math.abs(el.currentTime - at) > 0.3) el.currentTime = at;
      if (el.paused) void el.play().catch(() => undefined);
    };
    const snd = cut.sound;
    const ducks = snd?.duck !== 0 && !snd?.voiceMute && cut.voices.some((v) => t >= v.start && t < v.start + 3);
    if (music.current && cut.music) follow(music.current, t, snd?.musicMute ? -90 : cut.music.gain - (ducks ? 8 : 0));
    for (const v of cut.voices) {
      const el = voices.current.get(v.id + v.url);
      if (el) follow(el, t - v.start, snd?.voiceMute ? -90 : v.gain + (snd?.voiceGain ?? 0));
    }
    for (const e of cut.effects ?? []) {
      const el = effects.current.get(e.id + e.url);
      if (el) follow(el, t - e.start, snd?.fxMute ? -90 : e.gain + (snd?.fxGain ?? 0));
    }
  }, [cut, t, playing]);

  useEffect(
    () => () => {
      music.current?.pause();
      for (const el of voices.current.values()) el.pause();
      for (const el of effects.current.values()) el.pause();
    },
    [],
  );
}

async function upload(file: File): Promise<{ url: string; name: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; name?: string; reason?: string };
  if (!body.ok || !body.url) throw new Error(body.reason ?? "The file couldn't be added.");
  return { url: body.url, name: body.name ?? file.name };
}

export function Soundtrack({ music, onChange }: { music: Music | undefined; onChange: (music: Music | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(file: File) {
    setBusy(true);
    setError(null);
    try {
      const made = await upload(file);
      onChange({ url: made.url, name: made.name.replace(/\.[^.]+$/, ""), gain: music?.gain ?? -6 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The soundtrack couldn't be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sound-row">
      <b>Soundtrack</b>
      {music ? (
        <>
          <span className="sound-name" title={music.name}>{music.name}</span>
          <label className="sound-level">
            Level
            <input type="range" min={-24} max={6} step={1} value={music.gain} onChange={(e) => onChange({ ...music, gain: Number(e.target.value) })} aria-valuetext={`${music.gain} dB`} />
            <span>{music.gain > 0 ? "+" : ""}{music.gain} dB</span>
          </label>
          <button className="plain" disabled={busy} onClick={() => input.current?.click()}>Replace</button>
          <button className="plain danger" onClick={() => onChange(undefined)}>Remove</button>
        </>
      ) : (
        <>
          <span className="sound-hint">Runs under the whole cut and dips under the voices.</span>
          <button className="pill" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : "Add a soundtrack"}</button>
        </>
      )}
      <input ref={input} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void add(f); }} />
      {error && <p className="library-error" role="alert">{error}</p>}
    </div>
  );
}

/** "Comet Hill — ELLIS: Stop counting." → the line a board proposal put on the beat, if any. */
function lineInBeat(beat: string): { speaker: string; text: string } | null {
  const m = /—\s*([A-Z][A-Z .'()-]{0,40}?)(?:\s*\(V\.O\.\))?:\s*(.+)$/.exec(beat);
  return m ? { speaker: m[1]!.trim(), text: m[2]!.trim() } : null;
}

const DEFAULT_VOICE = "Laura (female, american)";

export function VoiceLines({ shot, project, onChange }: { shot: Shot; project: Project; onChange: (voices: VoiceLine[]) => void }) {
  const lines = shot.voices ?? [];
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A speaker keeps the voice they were given anywhere on the board.
  const voiceOf = (speaker: string) => project.shots.flatMap((s) => s.voices ?? []).find((v) => v.speaker === speaker && v.voice)?.voice ?? DEFAULT_VOICE;
  const suggestion = lineInBeat(shot.beat);
  const price = (line: VoiceLine) => editEstimate({ tool: "speech", seconds: 0, characters: line.text.trim().length });
  // Changing the words or the voice means the recording no longer matches, so it is dropped.
  const set = (id: string, patch: Partial<VoiceLine>) =>
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if ("text" in patch || "voice" in patch) delete next.url;
        return next;
      }),
    );

  async function speak(line: VoiceLine) {
    setError(null);
    setSpeaking(line.id);
    const result = await speakLine(line.text, line.voice);
    setSpeaking(null);
    if (!result.ok) {
      if (result.needsKey) openKeys();
      setError(result.reason);
      return;
    }
    onChange(lines.map((l) => (l.id === line.id ? { ...l, url: result.url } : l)));
  }

  const add = (speaker = "VOICE", text = "") =>
    onChange([...lines, { id: "line-" + crypto.randomUUID().slice(0, 8), speaker, text, voice: voiceOf(speaker), offset: 0 }]);

  return (
    <div className="voices">
      <div className="voices-head">
        <b>Voice-over</b>
        {suggestion && !lines.some((l) => l.text === suggestion.text) && (
          <button className="pill" onClick={() => add(suggestion.speaker, suggestion.text)}>
            Use “{suggestion.text.length > 32 ? suggestion.text.slice(0, 31) + "…" : suggestion.text}”
          </button>
        )}
        <button className="plain" onClick={() => add()}>+ Add a line</button>
      </div>
      {lines.map((line) => (
        <div key={line.id} className="voice-line">
          <input className="voice-speaker" value={line.speaker} aria-label="Who speaks" onChange={(e) => set(line.id, { speaker: e.target.value.toUpperCase() })} />
          <input className="voice-text" value={line.text} placeholder="What they say" aria-label="The line" onChange={(e) => set(line.id, { text: e.target.value })} />
          <select value={line.voice} aria-label="Voice" onChange={(e) => set(line.id, { voice: e.target.value })}>
            {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <label className="voice-at">
            at
            <input type="number" min={0} step={0.25} value={line.offset} onChange={(e) => set(line.id, { offset: Math.max(0, Number(e.target.value) || 0) })} />
            s
          </label>
          {line.url ? (
            <>
              <button className="plain" onClick={() => void new Audio(line.url).play()}>Play</button>
              <button className="plain" disabled={speaking === line.id} onClick={() => void speak(line)}>Speak again · ${price(line).toFixed(3)}</button>
            </>
          ) : (
            <button className="pill on" disabled={!line.text.trim() || speaking === line.id} onClick={() => void speak(line)}>
              {speaking === line.id ? "Speaking…" : `Speak · $${price(line).toFixed(3)}`}
            </button>
          )}
          <button className="take-x" aria-label="Remove line" onClick={() => onChange(lines.filter((l) => l.id !== line.id))}>×</button>
        </div>
      ))}
      {!lines.length && <p className="takes-note">Lines play from this shot&rsquo;s start and move with it if the board is reordered.</p>}
      {error && <p className="library-error" role="alert">{error}</p>}
    </div>
  );
}

const KNOBS: { id: "room" | "warmth" | "clarity" | "squeeze" | "duck"; label: string; min: number; max: number; step: number; unit: string; hint: string }[] = [
  { id: "room", label: "Room", min: 0, max: 1, step: 0.05, unit: "", hint: "Puts the voices in a space instead of a booth." },
  { id: "warmth", label: "Body", min: -6, max: 6, step: 0.5, unit: " dB", hint: "Low warmth. Thin, tinny voices want more." },
  { id: "clarity", label: "Presence", min: -6, max: 6, step: 0.5, unit: " dB", hint: "Edge and intelligibility. Take it down if the voices sound harsh." },
  { id: "squeeze", label: "Level out", min: 0, max: 1, step: 0.05, unit: "", hint: "Evens loud and quiet words so the voice sits." },
  { id: "duck", label: "Music dips", min: 0, max: 1, step: 0.05, unit: "", hint: "How far the soundtrack drops under a voice." },
];

/** How the voices sit in the mix. Heard in the rendered file; the preview plays the raw lines. */
export function VoiceMix({ sound, onChange }: { sound: Sound | undefined; onChange: (sound: Sound | undefined) => void }) {
  const value = sound ?? {};
  const set = (patch: Partial<Sound>) => onChange({ ...value, ...patch });
  return (
    <div className="sound-row voice-mix">
      <b>Blend the voices</b>
      <div className="voice-mix-presets">
        <button className="pill" onClick={() => onChange({ ...BLEND, ...(value.loud ? { loud: true } : {}) })}>Blend into the film</button>
        <button className="plain" onClick={() => onChange(undefined)} disabled={!sound}>Dry</button>
      </div>
      {KNOBS.map((k) => (
        <label key={k.id} className="sound-level" title={k.hint}>
          {k.label}
          <input type="range" min={k.min} max={k.max} step={k.step} value={value[k.id] ?? 0} onChange={(e) => set({ [k.id]: Number(e.target.value) })} aria-valuetext={`${value[k.id] ?? 0}${k.unit}`} />
          <span>{(value[k.id] ?? 0).toFixed(k.step < 1 ? 2 : 0).replace(/\.?0+$/, "") || "0"}{k.unit}</span>
        </label>
      ))}
      <label className="sound-level" title="Brings the finished mix to the level streaming expects, −16 LUFS.">
        <input type="checkbox" checked={Boolean(value.loud)} onChange={(e) => set({ loud: e.target.checked })} /> Master to −16 LUFS
      </label>
    </div>
  );
}

const dB = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)} dB`;

function TrackHead({ name, hint, muted, onMute, level, onLevel, min = -24, max = 12 }: { name: string; hint: string; muted: boolean; onMute: () => void; level: number; onLevel: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className={`trk${muted ? " muted" : ""}`}>
      <header>
        <b>{name}</b>
        <small>{hint}</small>
        <button className={`trk-m${muted ? " on" : ""}`} aria-pressed={muted} onClick={onMute} title={muted ? `Unmute ${name}` : `Mute ${name}`}>M</button>
      </header>
      <label className="sound-level">Level<input type="range" min={min} max={max} step={1} value={level} onChange={(e) => onLevel(Number(e.target.value))} aria-valuetext={dB(level)} /><span>{dB(level)}</span></label>
    </div>
  );
}

/**
 * The cut's sound as separate tracks: Voice (the lines on shots), Effects
 * (placed on the timeline, from a file or made from words) and Music. Each
 * has its own mute and level.
 */
export function Tracks({ sound, onSound, effects, onEffects, music, onMusic, playhead, voices }: { sound: Sound | undefined; onSound: (s: Sound | undefined) => void; effects: Effect[]; onEffects: (e: Effect[]) => void; music: Music | undefined; onMusic: (m: Music | undefined) => void; playhead: number; voices: number }) {
  const snd = sound ?? {};
  const set = (patch: Partial<Sound>) => onSound({ ...snd, ...patch });
  const [text, setText] = useState("");
  const [seconds, setSeconds] = useState(3);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void quoteEffect(seconds).then(setPrice);
  }, [seconds]);

  const add = (e: Omit<Effect, "id" | "start" | "gain">) => onEffects([...effects, { ...e, id: crypto.randomUUID(), start: Math.round(playhead * 10) / 10, gain: 0 }]);
  const patch = (id: string, p: Partial<Effect>) => onEffects(effects.map((e) => (e.id === id ? { ...e, ...p } : e)));

  async function make() {
    setBusy(true);
    setError(null);
    const r = await makeEffect(text, seconds);
    setBusy(false);
    if (!r.ok) {
      if (r.needsKey) openKeys();
      return setError(r.reason);
    }
    add({ name: text.trim().slice(0, 40), url: r.url, seconds });
    setText("");
  }

  async function addFile(f: File) {
    setError(null);
    try {
      const made = await upload(f);
      const len = await new Promise<number>((res) => {
        const a = new Audio(made.url);
        a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration * 10) / 10 : 3);
        a.onerror = () => res(3);
      });
      add({ name: made.name.replace(/\.[^.]+$/, "").slice(0, 40), url: made.url, seconds: len });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file couldn't be added.");
    }
  }

  return (
    <div className="tracks">
      <TrackHead name="Voice" hint={voices ? `${voices} line${voices === 1 ? "" : "s"} on shots` : "none yet"} muted={Boolean(snd.voiceMute)} onMute={() => set({ voiceMute: !snd.voiceMute })} level={snd.voiceGain ?? 0} onLevel={(n) => set({ voiceGain: n })} />

      <TrackHead name="Effects" hint={effects.length ? `${effects.length} on the timeline` : "none yet"} muted={Boolean(snd.fxMute)} onMute={() => set({ fxMute: !snd.fxMute })} level={snd.fxGain ?? 0} onLevel={(n) => set({ fxGain: n })} />
      <div className="trk-body">
        {effects.map((e) => (
          <div key={e.id} className="trk-fx">
            <b title={e.name}>{e.name}</b>
            <label>at <input type="number" min={0} step={0.1} value={e.start} onChange={(ev) => patch(e.id, { start: Math.max(0, Number(ev.target.value) || 0) })} /> s</label>
            <label>level <input type="range" min={-24} max={12} step={1} value={e.gain} onChange={(ev) => patch(e.id, { gain: Number(ev.target.value) })} aria-valuetext={dB(e.gain)} /></label>
            <button className="plain danger" onClick={() => onEffects(effects.filter((x) => x.id !== e.id))}>Remove</button>
          </div>
        ))}
        <div className="trk-add">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="A heavy wooden door slams in an empty hall" aria-label="Describe a sound effect" />
          <label>seconds <input type="number" min={0.5} max={30} step={0.5} value={seconds} onChange={(e) => setSeconds(Math.min(30, Math.max(0.5, Number(e.target.value) || 1)))} /></label>
          <button className="pill" disabled={busy || text.trim().length < 4} onClick={() => void make()}>{busy ? "Making…" : `Make it · $${price.toFixed(3)}`}</button>
          <button className="plain" onClick={() => file.current?.click()}>Add a file</button>
          <input ref={file} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addFile(f); }} />
        </div>
        <small className="wf-small">An effect lands at the playhead ({playhead.toFixed(1)}s). Drag it on the timeline or set its time here.</small>
        {error && <p className="library-error" role="alert">{error}</p>}
      </div>

      <TrackHead name="Music" hint={music ? music.name : "none yet"} muted={Boolean(snd.musicMute)} onMute={() => set({ musicMute: !snd.musicMute })} level={music?.gain ?? 0} onLevel={(n) => music && onMusic({ ...music, gain: n })} min={-24} max={6} />
      <Soundtrack music={music} onChange={onMusic} />
    </div>
  );
}
