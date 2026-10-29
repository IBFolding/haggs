"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { MOODS, MOVES, moodPicture, TRAITS, angleName, characterLine, hooks, locked, mixCheck, moodRight, scorePrompt, sideOf, type MoveId } from "../../academy/labs";
import { FORMATS } from "../../sheets/formats";

/**
 * The practice labs. Each is free and instant: you try the idea with your
 * hands, it tells you what it saw, and calls onProgress as the challenge
 * fills in. Nothing here calls a model or spends a cent.
 */

export type Lab = { done: boolean; checks: { label: string; ok: boolean }[] };
type Props = { onLab: (lab: Lab) => void };

/* 1 · Your first video: how a move changes a still */

export function MoveLab({ onLab }: Props) {
  const [move, setMove] = useState<MoveId>("push");
  const [key, setKey] = useState(0);
  const [picks, setPicks] = useState<Record<string, MoveId>>({});
  const correct = MOODS.filter((m) => picks[m.id] && moodRight(m.id, picks[m.id]!)).length;
  useEffect(() => {
    onLab({ done: correct === MOODS.length, checks: MOODS.map((m) => ({ label: m.scene, ok: Boolean(picks[m.id] && moodRight(m.id, picks[m.id]!)) })) });
  }, [correct, picks, onLab]);

  return (
    <div className="lab">
      <div className="lab-col">
        <h3>Try a move on a photo</h3>
        <div className={`lab-view move-${move}`} key={key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/templates/poster-animate-still.webp" alt="A still photo being moved by the camera" />
        </div>
        <div className="lab-chips">
          {MOVES.map((m) => (
            <button key={m.id} className={m.id === move ? "on" : ""} onClick={() => { setMove(m.id); setKey((k) => k + 1); }}>{m.name}</button>
          ))}
        </div>
        <p className="lab-note">{MOVES.find((m) => m.id === move)!.says}</p>
      </div>
      <div className="lab-col">
        <h3>Which move fits?</h3>
        <ul className="lab-moods">
          {MOODS.map((m) => {
            const pick = picks[m.id];
            const ok = pick ? moodRight(m.id, pick) : null;
            return (
              <li key={m.id} className={ok === null ? "" : ok ? "ok" : "no"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lab-mood-pic" src={moodPicture(m.id)} alt="" loading="lazy" />
                <p>{m.scene}</p>
                <div className="lab-chips small">
                  {MOVES.map((mv) => <button key={mv.id} className={pick === mv.id ? "on" : ""} onClick={() => setPicks((p) => ({ ...p, [m.id]: mv.id }))}>{mv.name}</button>)}
                </div>
                {ok !== null && <small>{ok ? `Yes. ${m.why}` : "Not quite. Think about what the camera should make us feel."}</small>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* 2 · Say it like a director */

const EXAMPLE = "A fisherman mends a net on a wooden pier at golden dusk, slow push-in on his hands.";
export function PromptLab({ onLab }: Props) {
  const [text, setText] = useState("");
  const s = useMemo(() => scorePrompt(text), [text]);
  const parts = [["subject", "Who or what, doing what"], ["place", "Where"], ["light", "The light"], ["camera", "The camera"]] as const;
  useEffect(() => {
    onLab({ done: s.score >= 100, checks: parts.map(([k, l]) => ({ label: l, ok: s.has[k] })) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, onLab]);

  return (
    <div className="lab">
      <div className="lab-col">
        <h3>Write the shot</h3>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe a shot you can picture…" aria-label="Your shot description" />
        <button className="plain" onClick={() => setText(EXAMPLE)}>Show me an example</button>
        {s.tips.length > 0 && text.trim() && <ul className="lab-tips">{s.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>
      <div className="lab-col">
        <div className="lab-meter" style={{ "--p": s.score } as React.CSSProperties}><b>{s.score}</b><small>of 100</small></div>
        <ul className="lab-parts">
          {parts.map(([k, l]) => <li key={k} className={s.has[k] ? "ok" : ""}><i>{s.has[k] ? "✓" : ""}</i>{l}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* 3 · Move the camera */

export function DialLab({ onLab }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ deg: 0, d: 0.55 });
  const [seen, setSeen] = useState<string[]>([]);
  const angle = angleName(pos.deg, pos.d);
  const goals = ["Close-up", "Wide shot", "Reverse"];

  useEffect(() => {
    if (!seen.includes(angle.name)) setSeen((s) => [...s, angle.name]);
  }, [angle.name, seen]);
  useEffect(() => {
    onLab({ done: goals.every((g) => seen.includes(g)), checks: goals.map((g) => ({ label: g, ok: seen.includes(g) })) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, onLab]);

  function move(e: { clientX: number; clientY: number }) {
    const r = box.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    const deg = (Math.atan2(x, -y) * 180) / Math.PI;
    setPos({ deg: (deg + 360) % 360, d: Math.min(1, Math.max(0.12, Math.hypot(x, y) / (r.width / 2))) });
  }
  const rad = (pos.deg * Math.PI) / 180;
  return (
    <div className="lab">
      <div className="lab-col">
        <h3>Drag the camera round the subject</h3>
        <div className="lab-dial" ref={box} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => { if (e.buttons) move(e); }} role="slider" aria-label="Camera position" aria-valuetext={angle.name} tabIndex={0}
          onKeyDown={(e) => { const k = e.key; if (k === "ArrowLeft") setPos((p) => ({ ...p, deg: (p.deg + 345) % 360 })); if (k === "ArrowRight") setPos((p) => ({ ...p, deg: (p.deg + 15) % 360 })); if (k === "ArrowUp") setPos((p) => ({ ...p, d: Math.max(0.12, p.d - 0.08) })); if (k === "ArrowDown") setPos((p) => ({ ...p, d: Math.min(1, p.d + 0.08) })); }}>
          <span className="lab-ring r1" /><span className="lab-ring r2" />
          <span className="lab-subject">He faces up</span>
          <span className="lab-cam" style={{ left: `${50 + Math.sin(rad) * pos.d * 50}%`, top: `${50 - Math.cos(rad) * pos.d * 50}%`, transform: `translate(-50%, -50%) rotate(${pos.deg + 180}deg)` }} />
        </div>
      </div>
      <div className="lab-col">
        <h3>What the camera sees</h3>
        <div className="lab-finder">
          <div className="lab-frame" style={{ "--z": 0.7 + (1 - pos.d) * 1.6, "--back": angle.at === "behind" ? 1 : 0, "--side": angle.at === "left" ? -1 : angle.at === "right" ? 1 : 0 } as React.CSSProperties}>
            <span className="lab-man" />
          </div>
          <b>{angle.name}</b>
        </div>
        <ul className="lab-parts">{goals.map((g) => <li key={g} className={seen.includes(g) ? "ok" : ""}><i>{seen.includes(g) ? "✓" : ""}</i>Find the {g.toLowerCase()}</li>)}</ul>
      </div>
    </div>
  );
}

/* 4 · The same person every time */

export function CharacterLab({ onLab }: Props) {
  const [name, setName] = useState("Ellis");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [isLocked, setLocked] = useState(false);
  const count = TRAITS.filter((t) => picks[t.id]).length;
  useEffect(() => {
    onLab({ done: isLocked && locked(picks), checks: [{ label: "Choose at least five traits", ok: locked(picks) }, { label: "Lock the identity", ok: isLocked && locked(picks) }] });
  }, [isLocked, picks, onLab]);
  const line = characterLine(name, picks);
  return (
    <div className="lab">
      <div className="lab-col">
        <h3>Build the person</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Character name" maxLength={30} />
        {TRAITS.map((t) => (
          <div key={t.id} className="lab-trait"><small>{t.label}</small>
            <div className="lab-chips small">{t.options.map((o) => <button key={o} className={picks[t.id] === o ? "on" : ""} onClick={() => { setLocked(false); setPicks((p) => ({ ...p, [t.id]: o })); }}>{o}</button>)}</div>
          </div>
        ))}
      </div>
      <div className="lab-col">
        <h3>What goes into every shot</h3>
        <p className={`lab-line${isLocked ? " locked" : ""}`}>{count ? line : "Pick traits and they appear here, word for word."}</p>
        <button className="pill on" disabled={!locked(picks) || isLocked} onClick={() => setLocked(true)}>{isLocked ? "Locked ✓" : "Lock this identity"}</button>
        {isLocked && (
          <div className="lab-compare">
            <div><small>Without the lock</small><p>“A man walks down a rainy street.”</p><em>Different man each time.</em></div>
            <div><small>With the lock</small><p>“{line} <b>A man walks down a rainy street.</b>”</p><em>Same man every time.</em></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* 5 · A place you can walk around */

export function WalkLab({ onLab }: Props) {
  const [deg, setDeg] = useState(0);
  const [seen, setSeen] = useState<string[]>(["front"]);
  const side = sideOf(deg);
  useEffect(() => { if (!seen.includes(side)) setSeen((s) => [...s, side]); }, [side, seen]);
  useEffect(() => {
    onLab({ done: seen.length >= 4, checks: (["front", "right", "back", "left"] as const).map((s) => ({ label: `See it from the ${s === "front" ? "front" : s}`, ok: seen.includes(s) })) });
  }, [seen, onLab]);
  return (
    <div className="lab">
      <div className="lab-col wide">
        <h3>Walk round the place</h3>
        <div className="lab-place" aria-label={`Looking from the ${side}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/templates/location-plate.webp" alt="A desert town at dusk" style={{ objectPosition: `${((deg % 360) / 360) * 100}% 50%`, transform: `scale(${1.6 + Math.abs(Math.sin((deg * Math.PI) / 180)) * 0.2})` }} />
          <span className="lab-compass" style={{ transform: `rotate(${-deg}deg)` }}>N</span>
          <b>From the {side}</b>
        </div>
        <input type="range" min={0} max={359} value={deg} onChange={(e) => setDeg(Number(e.target.value))} aria-label="Walk round the place" />
        <p className="lab-note">In haggs a place is built once, then you can move the camera to any side of it and every shot still happens in the same town.</p>
      </div>
      <div className="lab-col">
        <h3>Visit every side</h3>
        <ul className="lab-parts">
          {(["front", "right", "back", "left"] as const).map((s) => <li key={s} className={seen.includes(s) ? "ok" : ""}><i>{seen.includes(s) ? "✓" : ""}</i>The {s}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* 6 · A series in an afternoon */

const SERIES_FORMATS = FORMATS.filter((f) => f.group === "Vertical" || f.group === "Short");
export function SeriesLab({ onLab }: Props) {
  const [formatId, setFormatId] = useState(SERIES_FORMATS[0]!.id);
  const [topic, setTopic] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [hook, setHook] = useState<string | null>(null);
  const format = SERIES_FORMATS.find((f) => f.id === formatId)!;
  useEffect(() => {
    onLab({ done: drafted && Boolean(hook), checks: [{ label: "Pick a format and a topic, then draft", ok: drafted }, { label: "Choose a hook", ok: Boolean(hook) }] });
  }, [drafted, hook, onLab]);
  return (
    <div className="lab">
      <div className="lab-col">
        <h3>Pick a format</h3>
        <div className="lab-chips small">{SERIES_FORMATS.map((f) => <button key={f.id} className={f.id === formatId ? "on" : ""} onClick={() => { setFormatId(f.id); setDrafted(false); setHook(null); }}>{f.label}</button>)}</div>
        <p className="lab-note">{format.form}</p>
        <h3>Your topic</h3>
        <input value={topic} onChange={(e) => { setTopic(e.target.value); setDrafted(false); setHook(null); }} placeholder="e.g. morning routines" aria-label="Series topic" maxLength={80} />
        <button className="pill on" disabled={topic.trim().length < 3} onClick={() => setDrafted(true)}>Draft the beats</button>
      </div>
      <div className="lab-col">
        <h3>{drafted ? "Where each beat goes" : "The beats appear here"}</h3>
        {drafted && (
          <>
            <ol className="lab-beats">{format.beats.slice(0, 5).map((b, i) => <li key={b.title} style={{ "--k": i } as React.CSSProperties}><b>{b.title}</b><small>{b.job}</small></li>)}</ol>
            <h3>Pick the hook</h3>
            <ul className="lab-hooks">{hooks(topic).map((h) => <li key={h}><button className={hook === h ? "on" : ""} onClick={() => setHook(h)}>{h}</button></li>)}</ul>
          </>
        )}
      </div>
    </div>
  );
}

/* 7 · Cut it, sound it, render it */

export function MixLab({ onLab }: Props) {
  const [mix, setMix] = useState({ voice: -12, music: -12, fx: -9 });
  const [checked, setChecked] = useState(false);
  const result = mixCheck(mix);
  useEffect(() => {
    onLab({ done: checked && result.ok, checks: [{ label: "Words clearly over the music", ok: mix.voice - mix.music >= 6 }, { label: "Effects under the voice", ok: mix.fx <= mix.voice }, { label: "Check the mix", ok: checked && result.ok }] });
  }, [checked, result.ok, mix, onLab]);
  const rows = [["voice", "Voice", "#7dd3fc"], ["music", "Music", "#35e48a"], ["fx", "Effects", "#f5a524"]] as const;
  return (
    <div className="lab">
      <div className="lab-col wide">
        <h3>Mix the film</h3>
        <div className="lab-mixer">
          {rows.map(([k, label, colour]) => (
            <label key={k}>
              <span>{label}</span>
              <input type="range" min={-40} max={0} step={1} value={mix[k]} onChange={(e) => { setChecked(false); setMix((m) => ({ ...m, [k]: Number(e.target.value) })); }} />
              <i style={{ width: `${((mix[k] + 40) / 40) * 100}%`, background: colour }} />
              <small>{mix[k]} dB</small>
            </label>
          ))}
        </div>
        <button className="pill on" onClick={() => setChecked(true)}>Check my mix</button>
        {checked && (result.ok ? <p className="lab-good">That sits right. The words are clear, the music is felt, the effects stay out of the way.</p> : <ul className="lab-tips">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>)}
      </div>
      <div className="lab-col">
        <h3>The rules of thumb</h3>
        <ul className="lab-parts">
          <li className={mix.voice - mix.music >= 6 ? "ok" : ""}><i>{mix.voice - mix.music >= 6 ? "✓" : ""}</i>Voice 6 dB or more over the music</li>
          <li className={mix.fx <= mix.voice ? "ok" : ""}><i>{mix.fx <= mix.voice ? "✓" : ""}</i>Effects no louder than the voice</li>
          <li className={mix.voice <= -3 ? "ok" : ""}><i>{mix.voice <= -3 ? "✓" : ""}</i>Room left at the top</li>
        </ul>
        <p className="lab-note">In the editor each of these is its own track with its own level, and Master sets the whole film to −16 LUFS.</p>
      </div>
    </div>
  );
}

export const LABS: Record<string, (p: Props) => React.ReactNode> = {
  "first-video": (p) => <MoveLab {...p} />,
  prompting: (p) => <PromptLab {...p} />,
  camera: (p) => <DialLab {...p} />,
  characters: (p) => <CharacterLab {...p} />,
  locations: (p) => <WalkLab {...p} />,
  series: (p) => <SeriesLab {...p} />,
  finish: (p) => <MixLab {...p} />,
};
