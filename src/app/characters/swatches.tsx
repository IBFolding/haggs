"use client";

import { isCustom } from "../../story/chip-row";

/** What each colour choice looks like, so skin, hair and eyes are picked by sight, not by name. */
export const SWATCHES: Record<string, Record<string, string>> = {
  skin: { "very fair": "#f6dcc8", fair: "#eecbb0", "light olive": "#d9b38c", "medium olive": "#c29466", tan: "#b57e52", brown: "#8d5a3b", "dark brown": "#6b3f26", deep: "#44261a" },
  hairColor: { black: "#141414", "dark brown": "#3b2618", brown: "#6a4528", auburn: "#8a3a1e", red: "#a8331d", ginger: "#c8642b", blonde: "#e0c07a", platinum: "#ece3c8", grey: "#9a9a9a", silver: "#c9ccd1", white: "#f2f2f0", blue: "#3c6ed6", pink: "#e58cb5" },
  eyes: { "dark brown": "#3a2414", brown: "#6b4425", hazel: "#8d7341", green: "#4f8a4f", blue: "#4f7fbf", grey: "#8b9399", amber: "#c08a2a" },
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
