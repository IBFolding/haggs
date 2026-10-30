"use client";

/** A labelled slider. */
export function Slide({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="gs-slide">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** A slider with the exact number beside it, so a size or a place can be typed rather than dragged. `scale` shows a 0 to 1 value as a percentage. */
export function NumSlide({ label, min, max, step, value, onChange, scale = 100, unit = "%" }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; scale?: number; unit?: string }) {
  const shown = Math.round(value * scale * 10) / 10;
  return (
    <div className="gs-slide gw-num">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <label className="gw-numbox">
        <input type="number" min={Math.round(min * scale * 10) / 10} max={Math.round(max * scale * 10) / 10} step={Math.max(0.1, step * scale)} value={shown} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n / scale))); }} aria-label={`${label} (${unit})`} />
        <i>{unit}</i>
      </label>
    </div>
  );
}
