"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { APERTURES, FOCALS, lookPhrase, rowsFor, type LookChoice, type LookOption, type LookRow } from "../catalog/look";

/**
 * The look, picked by sight. A bar of cards (one per choice: camera, framing, move, light, film, era, look, grade)
 * sits over the prompt; each opens a picker of visual samples. The samples are our own three sample photos with the
 * treatment drawn on them in the browser, and simple drawings for the camera, so nothing here is generated or costs
 * anything. They show the idea, not the result: the model makes its own picture from the words, which are always shown.
 */

const PORTRAIT = "/samples/portrait.jpg";
const STREET = "/samples/street.jpg";
const LAND = "/samples/landscape.jpg";

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E\")";
const SCANLINES = "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)";
const VIGNETTE = "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.75) 100%)";

type Treat = { src?: string; filter?: string; tint?: string; blend?: CSSProperties["mixBlendMode"]; over?: string; title?: string; font?: string };

const FILM: Record<string, Treat> = {
  "vision3-250d": { filter: "saturate(1.05) contrast(1.05)", over: GRAIN },
  "tungsten-500t": { filter: "brightness(.8) contrast(1.1) saturate(.9)", tint: "linear-gradient(160deg, #1f4e8c, #e0a35a)", blend: "soft-light", over: GRAIN },
  portra: { filter: "saturate(.85) sepia(.12) brightness(1.06)", over: GRAIN },
  ektachrome: { filter: "saturate(1.55) contrast(1.15)" },
  "tri-x": { filter: "grayscale(1) contrast(1.45)", over: GRAIN },
  digital: {},
  vhs: { filter: "saturate(1.35) contrast(.9) blur(.7px)", over: SCANLINES },
};
const LIGHT: Record<string, Treat> = {
  "golden-hour": { filter: "saturate(1.2) brightness(1.05)", tint: "linear-gradient(120deg, #ffb347, #ff6a00)", blend: "soft-light" },
  "blue-hour": { filter: "brightness(.78) saturate(.8)", tint: "linear-gradient(160deg, #3a5fa8, #1a2a55)", blend: "color" },
  overcast: { filter: "saturate(.6) contrast(.85) brightness(1.06)" },
  "hard-sun": { filter: "contrast(1.4) brightness(1.1) saturate(1.1)" },
  "practical-night": { filter: "brightness(.5) saturate(.9)", over: "radial-gradient(circle at 72% 35%, rgba(255,170,80,.55), transparent 45%)" },
  "neon-night": { src: STREET, filter: "brightness(.7) saturate(1.2)", tint: "linear-gradient(90deg, #ff2bd6, #21d4fd)", blend: "color" },
  candle: { filter: "brightness(.5) sepia(.55)", over: "radial-gradient(circle at 60% 60%, rgba(255,150,40,.6), transparent 50%)" },
  studio: { filter: "contrast(1.1) brightness(1.02)", over: "radial-gradient(circle at 60% 30%, rgba(255,255,255,.25), transparent 55%)" },
  silhouette: { filter: "brightness(.2) contrast(1.8)", over: "linear-gradient(180deg, rgba(255,190,120,.55), transparent 55%)" },
};
const ERA: Record<string, Treat> = {
  "1920s": { filter: "grayscale(1) contrast(1.25) brightness(1.05) blur(.4px)", over: `${VIGNETTE}, ${GRAIN}` },
  "1950s": { filter: "saturate(1.8) contrast(1.1)" },
  "1960s": { filter: "saturate(.8) sepia(.18)", over: GRAIN },
  "1970s": { filter: "sepia(.45) saturate(.9) contrast(.9) brightness(1.05)", over: GRAIN },
  "1980s": { filter: "saturate(1.4) contrast(1.1)", tint: "linear-gradient(120deg, #ff3cac, #2b86c5)", blend: "soft-light" },
  "1990s": { filter: "saturate(.8) contrast(1.05)" },
  "2000s": { filter: "hue-rotate(18deg) saturate(.75) contrast(1.12)" },
  today: {},
};
const LOOK: Record<string, Treat> = {
  "neo-noir": { src: STREET, filter: "grayscale(.85) contrast(1.4) brightness(.8)", tint: "linear-gradient(160deg, #0b2a4a, #000)", blend: "soft-light", title: "NEO-NOIR", font: "italic 800 22px Georgia, serif" },
  western: { src: LAND, filter: "sepia(.7) saturate(1.2) contrast(1.1)", title: "WESTERN", font: "900 22px Georgia, serif" },
  "sci-fi": { src: LAND, filter: "hue-rotate(160deg) saturate(1.2) contrast(1.1)", title: "SCI-FI", font: "300 22px var(--mono)" },
  period: { filter: "sepia(.35) saturate(.8) brightness(1.05)", title: "Period", font: "italic 400 24px Georgia, serif" },
  documentary: { src: STREET, filter: "saturate(.6) contrast(1.05)", title: "documentary", font: "600 15px var(--mono)" },
  commercial: { filter: "saturate(1.25) brightness(1.12) contrast(1.05)", title: "Commercial", font: "800 20px var(--ui)" },
  "music-video": { src: STREET, filter: "saturate(1.6) contrast(1.2)", tint: "linear-gradient(90deg, #ff0080, #7928ca)", blend: "color", title: "MUSIC VIDEO", font: "900 18px var(--ui)" },
  fantasy: { src: LAND, filter: "saturate(1.5) brightness(1.05)", tint: "linear-gradient(160deg, #9d4edd, #ffd166)", blend: "soft-light", title: "Fantasy", font: "italic 700 24px Georgia, serif" },
  anime: { filter: "saturate(1.9) contrast(1.35) brightness(1.08)", title: "ANIME", font: "900 22px var(--ui)" },
};
/** Framing as crops of the portrait: where to look and how far in. */
const CROP: Record<string, { at: string; zoom: number }> = {
  wide: { at: "50% 50%", zoom: 1 },
  full: { at: "66% 58%", zoom: 1.35 },
  medium: { at: "64% 42%", zoom: 2.1 },
  "close-up": { at: "61% 25%", zoom: 3.6 },
  "extreme-close-up": { at: "59% 23%", zoom: 8 },
};

function treatOf(row: LookRow["id"], option: LookOption): Treat {
  if (row === "grade") {
    if (option.id === "monochrome") return { src: STREET, filter: "grayscale(1) contrast(1.15)" };
    if (option.id === "natural") return { src: STREET };
    const s = option.swatch ?? [];
    return { src: STREET, filter: "saturate(.9)", tint: `linear-gradient(160deg, ${s[0]}, ${s[s.length - 1]})`, blend: "color" };
  }
  return (row === "film" ? FILM : row === "light" ? LIGHT : row === "era" ? ERA : row === "look" ? LOOK : {})[option.id] ?? {};
}

/** A sample photo with the option's treatment drawn on it. */
function Photo({ treat, className = "", style }: { treat: Treat; className?: string; style?: CSSProperties }) {
  return (
    <span className={`vk-photo ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={treat.src ?? PORTRAIT} alt="" loading="lazy" style={{ filter: treat.filter }} />
      {treat.tint && <i className="vk-tint" style={{ background: treat.tint, mixBlendMode: treat.blend ?? "soft-light" }} />}
      {treat.over && <i className="vk-over" style={{ background: treat.over }} />}
      {treat.title && <b className="vk-title" style={{ font: treat.font }}>{treat.title}</b>}
    </span>
  );
}

const CAMERAS: Record<string, ReactNode> = {
  "large-format": <><rect x="14" y="18" width="20" height="28" rx="2" /><path d="M34 22 L52 16 V48 L34 42 Z" /><circle cx="56" cy="32" r="6" /></>,
  "super-35": <><rect x="10" y="20" width="34" height="24" rx="3" /><rect x="44" y="25" width="10" height="14" /><path d="M54 22 L64 18 V46 L54 42 Z" /><rect x="16" y="14" width="16" height="6" rx="1" /></>,
  "16mm": <><circle cx="22" cy="16" r="9" /><circle cx="42" cy="16" r="9" /><rect x="12" y="26" width="36" height="22" rx="3" /><rect x="48" y="31" width="12" height="12" /></>,
  handheld: <><rect x="12" y="22" width="34" height="20" rx="5" /><circle cx="52" cy="32" r="8" /><path d="M20 42 V52 H34" /></>,
  phone: <><rect x="22" y="8" width="22" height="48" rx="5" /><circle cx="29" cy="16" r="2.5" /><circle cx="29" cy="23" r="2.5" /></>,
  drone: <><path d="M20 20 L44 44 M44 20 L20 44" /><circle cx="18" cy="18" r="7" /><circle cx="46" cy="18" r="7" /><circle cx="18" cy="46" r="7" /><circle cx="46" cy="46" r="7" /><rect x="26" y="26" width="12" height="12" rx="3" /></>,
};
const FRAMES: Record<string, ReactNode> = {
  "extreme-wide": <><path d="M0 44 H96" /><path d="M0 44 L20 30 L34 38 L52 24 L70 36 L96 28" /><path d="M60 44 v-6 m0 -2 a1.5 1.5 0 1 0 0.1 0" /></>,
  "over-shoulder": <><path d="M-4 64 C4 30 26 26 36 40 L40 64 Z" /><circle cx="64" cy="26" r="8" /><path d="M50 64 C52 44 76 44 78 64" /></>,
  "low-angle": <><path d="M30 64 L40 18 H56 L66 64" /><circle cx="48" cy="12" r="6" /><path d="M8 64 L40 4 M88 64 L56 4" /></>,
  "top-down": <><circle cx="48" cy="32" r="9" /><ellipse cx="48" cy="34" rx="20" ry="9" /><path d="M28 34 L14 26 M68 34 L82 26" /></>,
};

/** A mark on each move's tile, so the moves tell apart before they play. */
const MOVE_MARK: Record<string, string> = { static: "■", "push-in": "⤢ in", "pull-out": "⤡ out", "pan-left": "←", "pan-right": "→", "tilt-up": "↑", "tilt-down": "↓", "crane-up": "⤴", orbit: "⟲", "handheld-follow": "〰", "dolly-zoom": "⇔" };

/** The picture for one option of one row. */
function Visual({ row, option }: { row: LookRow["id"]; option: LookOption }) {
  if (row === "camera") return <span className="vk-draw"><svg viewBox="0 0 64 64" aria-hidden>{CAMERAS[option.id]}</svg></span>;
  if (row === "framing") {
    const crop = CROP[option.id];
    if (crop) return <Photo treat={{}} className="vk-crop" style={{ "--at": crop.at, "--zoom": crop.zoom } as CSSProperties} />;
    return <span className="vk-draw wide"><svg viewBox="0 0 96 64" aria-hidden>{FRAMES[option.id]}</svg></span>;
  }
  if (row === "move") return <><Photo treat={{}} className={`vk-move m-${option.id}`} /><i className="vk-mark" aria-hidden>{MOVE_MARK[option.id]}</i></>;
  const t = treatOf(row, option);
  return (
    <>
      <Photo treat={t} />
      {row === "grade" && option.swatch && <span className="vk-strip">{option.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>}
    </>
  );
}

function Tile({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button className={`vk-tile${on ? " on" : ""}`} aria-pressed={on} onClick={onClick}>
      <span className="vk-frame">{children}</span>
      <b>{label}</b>
    </button>
  );
}

const Any = () => <span className="vk-any" aria-hidden>Any</span>;

/** The field of view a focal length gives on a full-frame camera, as a wedge. */
function Wedge({ focal }: { focal: number }) {
  const half = Math.atan(18 / focal);
  const x = Math.sin(half) * 52, y = Math.cos(half) * 52;
  return <svg viewBox="0 0 120 64" aria-hidden><path d={`M60 60 L${60 - x} ${60 - y} A52 52 0 0 1 ${60 + x} ${60 - y} Z`} /></svg>;
}

/** An iris whose opening shrinks as the f-number grows. */
function Iris({ f }: { f: number }) {
  const r = 26 / Math.sqrt(f) + 1;
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + 0.3; return `${32 + r * Math.cos(a)},${32 + r * Math.sin(a)}`; }).join(" ");
  return <svg viewBox="0 0 64 64" aria-hidden><circle cx="32" cy="32" r="28" className="vk-iris-body" /><polygon points={pts} className="vk-iris-open" /></svg>;
}

type Patch = { [K in keyof LookChoice]?: LookChoice[K] | undefined };

function CameraPane({ value, set }: { value: LookChoice; set: (p: Patch) => void }) {
  const row = rowsFor(true).find((r) => r.id === "camera")!;
  return (
    <div className="vk-cols">
      <section><h4>Camera</h4><div className="vk-col">
        <Tile on={!value.camera} onClick={() => set({ camera: undefined })} label="Any"><Any /></Tile>
        {row.options.map((o) => <Tile key={o.id} on={value.camera === o.id} onClick={() => set({ camera: o.id })} label={o.label}><Visual row="camera" option={o} /></Tile>)}
      </div></section>
      <section><h4>Lens</h4><div className="vk-col">
        <Tile on={!value.lens} onClick={() => set({ lens: undefined })} label="Any"><Any /></Tile>
        <Tile on={value.lens === "spherical"} onClick={() => set({ lens: "spherical" })} label="Spherical"><span className="vk-draw"><svg viewBox="0 0 64 64" aria-hidden><circle cx="32" cy="32" r="18" /><circle cx="32" cy="32" r="9" /></svg></span></Tile>
        <Tile on={value.lens === "anamorphic"} onClick={() => set({ lens: "anamorphic" })} label="Anamorphic"><span className="vk-draw"><svg viewBox="0 0 64 64" aria-hidden><ellipse cx="32" cy="32" rx="24" ry="13" /><ellipse cx="32" cy="32" rx="11" ry="6" /><path d="M2 32 H62" className="vk-flare" /></svg></span></Tile>
        {FOCALS.map((f) => <Tile key={f} on={value.focal === f} onClick={() => set({ focal: value.focal === f ? undefined : f })} label={`${f}mm`}><span className="vk-draw wide"><Wedge focal={f} /></span></Tile>)}
      </div></section>
      <section><h4>Aperture</h4><div className="vk-col">
        <Tile on={!value.aperture} onClick={() => set({ aperture: undefined })} label="Any"><Any /></Tile>
        {APERTURES.map((a) => <Tile key={a} on={value.aperture === a} onClick={() => set({ aperture: a })} label={`f/${a}${a <= 2 ? " · soft background" : a >= 11 ? " · all sharp" : ""}`}><span className="vk-draw"><Iris f={a} /></span></Tile>)}
      </div></section>
    </div>
  );
}

function EraPane({ row, value, set }: { row: LookRow; value: LookChoice; set: (p: Patch) => void }) {
  const i = row.options.findIndex((o) => o.id === value.era);
  const at = i < 0 ? row.options.length - 1 : i;
  const o = row.options[at]!;
  const go = (n: number) => set({ era: row.options[Math.max(0, Math.min(row.options.length - 1, n))]!.id });
  return (
    <div className="vk-era">
      <Photo treat={treatOf("era", o)} className="vk-era-big" />
      <div className="vk-ticks" aria-hidden>{row.options.map((x, k) => <button key={x.id} tabIndex={-1} className={k === at ? "on" : ""} onClick={() => go(k)} />)}</div>
      <div className="vk-era-nav">
        <span>{row.options[at - 1]?.label ?? ""}</span>
        <button className="vk-arrow" aria-label="Earlier" disabled={at === 0} onClick={() => go(at - 1)}>‹</button>
        <b>{i < 0 ? "Any" : o.label}</b>
        <button className="vk-arrow" aria-label="Later" disabled={at === row.options.length - 1 && i >= 0} onClick={() => go(i < 0 ? at : at + 1)}>›</button>
        <span>{row.options[at + 1]?.label ?? ""}</span>
      </div>
      {i >= 0 && <button className="plain" onClick={() => set({ era: undefined })}>No particular era</button>}
    </div>
  );
}

export function LookPicker({ value, onChange, video, start, onClose }: { value: LookChoice; onChange: (next: LookChoice) => void; video: boolean; start: LookRow["id"]; onClose: () => void }) {
  const rows = rowsFor(video);
  const [tab, setTab] = useState<LookRow["id"]>(start);
  const row = rows.find((r) => r.id === tab) ?? rows[0]!;
  const set = (patch: Patch) => {
    const next: Record<string, unknown> = { ...value, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
    onChange(next as LookChoice);
  };
  const isSet = (id: LookRow["id"]) => Boolean(value[id]) || (id === "camera" && Boolean(value.lens || value.focal || value.aperture));
  const words = lookPhrase(value, video);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className="vk-scrim" onClick={onClose}>
      <div className="vk-modal" role="dialog" aria-modal="true" aria-label={row.label} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{row.label}</h2>
          <button className="vk-reset" disabled={!isSet(row.id)} onClick={() => set(row.id === "camera" ? { camera: undefined, lens: undefined, focal: undefined, aperture: undefined } : { [row.id]: undefined })}>Reset</button>
          <button className="vk-reset" disabled={!words} onClick={() => onChange({})}>Reset all</button>
          <button className="vk-x" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="vk-body">
          <nav aria-label="Look">
            {rows.map((r) => <button key={r.id} className={r.id === row.id ? "on" : ""} onClick={() => setTab(r.id)}>{r.label}{isSet(r.id) && <i aria-label="set" />}</button>)}
          </nav>
          <div className="vk-pane">
            <p className="vk-says"><b>{row.label}</b>{row.says}</p>
            {row.id === "camera" ? <CameraPane value={value} set={set} />
              : row.id === "era" ? <EraPane row={row} value={value} set={set} />
              : (
                <div className={`vk-grid${row.id === "move" ? " moves" : ""}`}>
                  <Tile on={!value[row.id]} onClick={() => set({ [row.id]: undefined })} label="Any"><Any /></Tile>
                  {row.options.map((o) => <Tile key={o.id} on={value[row.id] === o.id} onClick={() => set({ [row.id]: o.id })} label={o.label}><Visual row={row.id} option={o} /></Tile>)}
                </div>
              )}
          </div>
        </div>
        <footer>
          <p>{words ? <>Adds to your prompt: <span>{words}</span></> : "Pick anything and its words go after your prompt. Samples show the idea; the model makes its own picture."}</p>
          <button className="fire" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

/** The cards over the prompt. Each shows what is chosen and opens the picker on its own row. */
export function LookBar({ value, onChange, video }: { value: LookChoice; onChange: (next: LookChoice) => void; video: boolean }) {
  const [open, setOpen] = useState<LookRow["id"] | null>(null);
  return (
    <>
      <div className="vk-bar" onClick={(e) => e.stopPropagation()}>
        {rowsFor(video).map((r) => {
          const chosen = r.options.find((o) => o.id === value[r.id]);
          const extras = r.id === "camera" ? [value.lens === "anamorphic" ? "Anamorphic" : value.lens === "spherical" ? "Spherical" : "", value.focal ? `${value.focal}mm` : "", value.aperture ? `f/${value.aperture}` : ""].filter(Boolean) : [];
          const shown = [chosen?.label, ...extras].filter(Boolean).join(", ");
          return (
            <button key={r.id} className={`vk-card${shown ? " set" : ""}`} onClick={() => setOpen(r.id)}>
              <span className="vk-thumb">{chosen ? <Visual row={r.id} option={chosen} /> : <Visual row={r.id} option={r.options[0]!} />}</span>
              <span><small>{r.label}</small><b>{shown || "Any"}</b></span>
            </button>
          );
        })}
      </div>
      {open && <LookPicker value={value} onChange={onChange} video={video} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The animation a named move plays on a still, read from its name: in, out, left, right, up, down, around, shake. */
export function moveClass(id: string): string {
  if (/dolly-zoom|yoyo/.test(id)) return "m-dolly-zoom";
  if (/handheld|wiggle|bts|head-tracking|snorricam|shake|glam/.test(id)) return "m-handheld-follow";
  if (/orbit|arc-|lazy|rotation|bullet/.test(id)) return "m-orbit";
  if (/whip/.test(id)) return "m-pan-right";
  if (/hyperlapse|double-dolly|through/.test(id)) return "m-push-in";
  if (/left/.test(id)) return "m-pan-left";
  if (/right/.test(id)) return "m-pan-right";
  if (/crane-up|jib-up|incline|aerial|hero|crane-over/.test(id)) return "m-crane-up";
  if (/tilt-up/.test(id)) return "m-tilt-up";
  if (/tilt-down|crane-down|jib-down/.test(id)) return "m-tilt-down";
  if (/-out\b|-out-|out$/.test(id)) return "m-pull-out";
  if (/-in\b|-in-|in$|push|whip/.test(id)) return "m-push-in";
  return "m-static";
}

/** A named move shown on the sample still. */
export function MovePreview({ id }: { id: string }) {
  const kind = moveClass(id);
  return <><Photo treat={{}} className={`vk-move ${kind}`} /><i className="vk-mark" aria-hidden>{MOVE_MARK[kind.slice(2)]}</i></>;
}

/** A crop of the sample portrait, for shot sizes. */
export function CropPreview({ at, zoom }: { at: string; zoom: number }) {
  return <Photo treat={{}} className="vk-crop" style={{ "--at": at, "--zoom": zoom } as CSSProperties} />;
}

/** A line drawing on the dark tile. */
export function Drawing({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return <span className={`vk-draw${wide ? " wide" : ""}`}><svg viewBox={wide ? "0 0 96 64" : "0 0 64 64"} aria-hidden>{children}</svg></span>;
}

export { Wedge, FRAMES };

export type PickerTab = { id: string; label: string; says: string; value: string; onPick: (id: string) => void; groups: { name?: string; options: { id: string; label: string; visual: ReactNode }[] }[] };

/** The same picker, for any set of tabs: a side menu, tiles by group, Reset, and a note in the footer. */
export function PickerShell({ title, tabs, start, note, onClose }: { title: string; tabs: PickerTab[]; start: string; note: ReactNode; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const tab = tabs.find((t) => t.id === at) ?? tabs[0]!;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="vk-scrim" onClick={onClose}>
      <div className="vk-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="vk-reset" disabled={!tab.value} onClick={() => tab.onPick("")}>Reset</button>
          <button className="vk-x" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="vk-body">
          <nav aria-label={title}>
            {tabs.map((t) => <button key={t.id} className={t.id === tab.id ? "on" : ""} onClick={() => setAt(t.id)}>{t.label}{t.value && <i aria-label="set" />}</button>)}
          </nav>
          <div className="vk-pane">
            <p className="vk-says"><b>{tab.label}</b>{tab.says}</p>
            {tab.groups.map((g, gi) => (
              <section key={g.name ?? gi} className="vk-group">
                {g.name && <h4>{g.name}</h4>}
                <div className="vk-grid">
                  {gi === 0 && <Tile on={!tab.value} onClick={() => tab.onPick("")} label="Any"><Any /></Tile>}
                  {g.options.map((o) => <Tile key={o.id} on={tab.value === o.id} onClick={() => tab.onPick(o.id)} label={o.label}>{o.visual}</Tile>)}
                </div>
              </section>
            ))}
          </div>
        </div>
        <footer>
          <p>{note}</p>
          <button className="fire" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}
