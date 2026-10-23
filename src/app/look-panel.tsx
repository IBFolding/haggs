"use client";

import { useState } from "react";

import { APERTURES, FOCALS, LOOK_ROWS, lookPhrase, type LookChoice, type LookRow } from "../catalog/look";

/**
 * Camera, framing, light, film, look and grade — chosen like a
 * cinematographer would, sent as plain words after your prompt. The words
 * are shown underneath, so nothing is added that you can't read.
 */
export function LookPanel({ value, onChange }: { value: LookChoice; onChange: (next: LookChoice) => void }) {
  const [open, setOpen] = useState<LookRow["id"] | null>(null);
  // A patch may clear a choice by setting it to undefined.
  const set = (patch: { [K in keyof LookChoice]?: LookChoice[K] | undefined }) => {
    const next: Record<string, unknown> = { ...value, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
    onChange(next as LookChoice);
  };
  const words = lookPhrase(value);

  return (
    <div className="look" onClick={(e) => e.stopPropagation()}>
      <div className="look-rows">
        {LOOK_ROWS.map((row) => {
          const chosen = row.options.find((o) => o.id === value[row.id]);
          return (
            <div key={row.id} className={`look-row${open === row.id ? " open" : ""}`}>
              <button className="look-head" aria-expanded={open === row.id} onClick={() => setOpen(open === row.id ? null : row.id)}>
                <span className="look-chip" aria-hidden="true" style={chosen?.swatch ? { background: `linear-gradient(90deg, ${chosen.swatch.join(", ")})` } : undefined}>
                  {!chosen?.swatch && row.label.slice(0, 1)}
                </span>
                <span className="look-label">{row.label}</span>
                <span className="look-value">{chosen?.label ?? "Any"}</span>
                {row.id === "camera" && (
                  <span className="look-extras">
                    {value.lens && <i>{value.lens === "anamorphic" ? "Anamorphic" : "Spherical"}</i>}
                    {value.focal && <i>{value.focal}mm</i>}
                    {value.aperture && <i>f/{value.aperture}</i>}
                  </span>
                )}
                <span className="look-caret" aria-hidden="true">›</span>
              </button>
              {open === row.id && (
                <div className="look-pick">
                  <div className="look-options" role="listbox" aria-label={row.label}>
                    <button role="option" aria-selected={!chosen} className={!chosen ? "on" : ""} onClick={() => set({ [row.id]: undefined })}>Any</button>
                    {row.options.map((o) => (
                      <button key={o.id} role="option" aria-selected={chosen?.id === o.id} className={chosen?.id === o.id ? "on" : ""} onClick={() => set({ [row.id]: o.id })}>
                        {o.swatch && <span className="look-swatch" style={{ background: `linear-gradient(90deg, ${o.swatch.join(", ")})` }} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {row.id === "camera" && (
                    <div className="look-lens">
                      <label>Lens
                        <select value={value.lens ?? ""} onChange={(e) => set({ lens: (e.target.value || undefined) as LookChoice["lens"] })}>
                          <option value="">Any</option><option value="spherical">Spherical</option><option value="anamorphic">Anamorphic</option>
                        </select>
                      </label>
                      <label>Focal
                        <select value={value.focal ?? ""} onChange={(e) => set({ focal: e.target.value ? Number(e.target.value) : undefined })}>
                          <option value="">Any</option>{FOCALS.map((f) => <option key={f} value={f}>{f}mm</option>)}
                        </select>
                      </label>
                      <label>Aperture
                        <select value={value.aperture ?? ""} onChange={(e) => set({ aperture: e.target.value ? Number(e.target.value) : undefined })}>
                          <option value="">Any</option>{APERTURES.map((a) => <option key={a} value={a}>f/{a}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="look-words">{words ? <>Adds: <span>{words}</span></> : "Pick any of these and their words go after your prompt."}</p>
      {words && <button className="plain" onClick={() => onChange({})}>Clear the look</button>}
    </div>
  );
}
