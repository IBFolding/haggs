"use client";

import type { Quality } from "../../playable/code";

/** Opus writes better games; Sonnet writes them faster and for less. Both run on your Claude key. */
export function QualitySwitch({ value, onChange }: { value: Quality; onChange: (q: Quality) => void }) {
  return (
    <span className="pl-seg" role="group" aria-label="Claude model">
      <button aria-pressed={value === "quality"} onClick={() => onChange("quality")} title="Opus 5.5: better games, slower">Quality</button>
      <button aria-pressed={value === "fast"} onClick={() => onChange("fast")} title="Sonnet 5.5: faster and cheaper">Fast</button>
    </span>
  );
}
