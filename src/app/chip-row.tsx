"use client";

import { useState } from "react";

import { isCustom, visibleOptions } from "../story/chip-row";

/**
 * One trait: the usual choices as chips, long lists folded, and a box to write
 * your own. Typing replaces the choice; picking a chip clears what you wrote.
 */
export function ChipRow({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { shown, hidden } = visibleOptions(options, value, expanded);
  const custom = isCustom(options, value);
  return (
    <div className="chars-row">
      <span>{label}</span>
      <div role="radiogroup" aria-label={label}>
        {shown.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>)}
        {hidden > 0 && <button className="chip-more" onClick={() => setExpanded(true)}>+{hidden} more</button>}
        {expanded && options.length > 9 && <button className="chip-more" onClick={() => setExpanded(false)}>fewer</button>}
        <input
          className={`chip-own${custom ? " on" : ""}`}
          aria-label={`${label}, in your own words`}
          placeholder="your own"
          maxLength={60}
          value={custom ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
