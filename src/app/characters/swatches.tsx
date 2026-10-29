"use client";

import { HEIGHT_SCALE, TRAIT_PICTURES_BY, traitPicture } from "../../characters/trait-pictures";
import { isCustom } from "../../story/chip-row";

/** What each colour choice looks like, so skin, hair and eyes are picked by sight, not by name. */
export const SWATCHES: Record<string, Record<string, string>> = {
  skin: { "very fair": "#f6dcc8", fair: "#eecbb0", "light olive": "#d9b38c", "medium olive": "#c29466", tan: "#b57e52", brown: "#8d5a3b", "dark brown": "#6b3f26", deep: "#44261a" },
  hairColor: { black: "#141414", "dark brown": "#3b2618", brown: "#6a4528", auburn: "#8a3a1e", red: "#a8331d", ginger: "#c8642b", blonde: "#e0c07a", platinum: "#ece3c8", grey: "#9a9a9a", silver: "#c9ccd1", white: "#f2f2f0", blue: "#3c6ed6", pink: "#e58cb5" },
  eyes: { "dark brown": "#3a2414", brown: "#6b4425", hazel: "#8d7341", green: "#4f8a4f", blue: "#4f7fbf", grey: "#8b9399", amber: "#c08a2a" },
  timeOfDay: {
    dawn: "linear-gradient(180deg, #4b5a8a, #e9a07a)", morning: "linear-gradient(180deg, #8fc3ec, #f4e3b5)", midday: "linear-gradient(180deg, #3d8be0, #bfe1ff)",
    afternoon: "linear-gradient(180deg, #5aa0e0, #f2d59a)", "golden hour": "linear-gradient(180deg, #f2a64a, #f7d77a)", dusk: "linear-gradient(180deg, #3b2d5e, #e2735a)",
    "blue hour": "linear-gradient(180deg, #13214a, #3d6db0)", night: "linear-gradient(180deg, #05070f, #1b2a4a)", "late night": "linear-gradient(180deg, #020205, #0c1020)",
  },
};

/** One colour trait: a swatch per choice, named on hover and for screen readers, with a box for your own words. */
export function SwatchRow({ id, label, options, value, onChange }: { id: string; label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const colours = SWATCHES[id] ?? {};
  const custom = isCustom(options, value);
  return (
    <div className="cx-swatches" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} aria-label={o} title={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          <i style={{ background: colours[o] ?? "var(--surface-3)" }} />
          <small>{o}</small>
        </button>
      ))}
      <input className={`chip-own${custom ? " on" : ""}`} aria-label={`${label}, in your own words`} placeholder="your own" maxLength={60} value={custom ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** One trait picked by picture: the same person shown each way, with a box for your own words. */
export function PictureRow({ id, label, options, value, onChange }: { id: string; label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const custom = isCustom(options, value);
  return (
    <div className="cx-pics" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} role="radio" aria-checked={value === o} aria-label={o} title={`${o} · ${TRAIT_PICTURES_BY}`} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={traitPicture(id, o)} alt="" loading="lazy" />
          <small>{o}</small>
        </button>
      ))}
      <input className={`chip-own${custom ? " on" : ""}`} aria-label={`${label}, in your own words`} placeholder="your own" maxLength={60} value={custom ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Height, drawn: a figure beside the same doorway, so the choices read against each other. */
export function HeightRow({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const custom = isCustom(options, value);
  return (
    <div className="cx-pics cx-heights" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const k = HEIGHT_SCALE[o] ?? 0.82;
        const top = 92 - 80 * k;
        return (
          <button key={o} role="radio" aria-checked={value === o} aria-label={o} title={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>
            <svg viewBox="0 0 64 96" aria-hidden>
              <path className="cx-door" d="M38 92 V12 H58 V92" />
              <circle className="cx-fig" cx="20" cy={top + 6 * k} r={6 * k} />
              <path className="cx-fig" d={`M20 ${top + 12 * k} V${top + 52 * k} M20 ${top + 52 * k} L${20 - 7 * k} 92 M20 ${top + 52 * k} L${20 + 7 * k} 92 M${20 - 11 * k} ${top + 24 * k} L${20 + 11 * k} ${top + 24 * k}`} />
              <path className="cx-floor" d="M2 92 H62" />
            </svg>
            <small>{o}</small>
          </button>
        );
      })}
      <input className={`chip-own${custom ? " on" : ""}`} aria-label={`${label}, in your own words`} placeholder="your own" maxLength={60} value={custom ? value : ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
