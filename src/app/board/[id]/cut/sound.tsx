"use client";

import { useEffect, useRef, useState } from "react";

import { editEstimate, VOICES } from "../../../../providers/cloud-edits";
import type { Cut } from "../../../../story/cut";
import type { Music, Project, Shot, VoiceLine } from "../../../../story/model";
import { openKeys } from "../../../nav";
import { speakLine } from "../../../actions";

/**
 * The cut's sound: a soundtrack under the whole board, voice-over lines on
 * shots, and both played in the preview in time with the playhead.
 */

/** Plays the soundtrack and the voice lines in step with the cut's clock. */
export function usePreviewSound(cut: Cut | null, t: number, playing: boolean) {
  const music = useRef<HTMLAudioElement | null>(null);
  const voices = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    if (!cut) return;
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
    if (music.current && cut.music) follow(music.current, t, cut.music.gain - (cut.voices.some((v) => t >= v.start && t < v.start + 3) ? 8 : 0));
    for (const v of cut.voices) {
      const el = voices.current.get(v.id + v.url);
      if (el) follow(el, t - v.start, v.gain);
    }
  }, [cut, t, playing]);

  useEffect(
    () => () => {
      music.current?.pause();
      for (const el of voices.current.values()) el.pause();
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
