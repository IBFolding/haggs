"use client";

import { useState } from "react";

import { MAX_SEED, type SettingField, type SettingFields, type Settings } from "../catalog/settings";

/**
 * Renders the controls a model declares, and only those. There is no list of
 * controls anywhere else to keep in step — add a field to a card and it
 * appears here; remove one and it stops being sent.
 */
export function SettingsRail({
  fields,
  settings,
  onChange,
  only = "basic",
}: {
  fields: SettingFields;
  settings: Settings;
  onChange: (key: string, value: string | number | boolean) => void;
  /** The everyday controls, or the Pro ones (seed, negative prompt, CFG) a model declares. */
  only?: "basic" | "advanced";
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      {Object.entries(fields).filter(([, field]) => (only === "advanced") === Boolean(field.advanced)).map(([key, field]) => {
        if (field.type === "text") {
          return (
            <input
              key={key}
              className="pro-text"
              value={String(settings[key] ?? "")}
              maxLength={field.max}
              placeholder={field.label}
              aria-label={field.label}
              onChange={(event) => onChange(key, event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
          );
        }

        if (field.type === "seed") {
          const value = settings[key];
          return (
            <span key={key} className="pro-seed">
              <label>
                {field.label}
                <input
                  inputMode="numeric"
                  value={value === "" || value === undefined ? "" : String(value)}
                  placeholder="new each run"
                  aria-label={field.label}
                  onChange={(event) => onChange(key, event.target.value.replace(/\D+/g, "").slice(0, 10))}
                  onClick={(event) => event.stopPropagation()}
                />
              </label>
              <button className="plain" title="A random seed you can keep" onClick={(event) => { event.stopPropagation(); onChange(key, Math.floor(Math.random() * MAX_SEED)); }}>Roll</button>
              {value !== "" && value !== undefined && <button className="plain" title="A new seed each run" onClick={(event) => { event.stopPropagation(); onChange(key, ""); }}>Clear</button>}
            </span>
          );
        }

        if (field.type === "boolean") {
          const on = settings[key] === true;
          return (
            <button
              key={key}
              className={`pill${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={(event) => {
                event.stopPropagation();
                onChange(key, !on);
              }}
            >
              <span className={`dot${on ? " live" : ""}`} />
              {field.label}
            </button>
          );
        }

        if (field.type === "range") {
          const value = Number(settings[key] ?? field.default);
          const step = field.step ?? 1;
          // Fractional steps (CFG 0.05) round to the step, so repeated presses don't drift.
          const places = step < 1 ? String(step).split(".")[1]?.length ?? 2 : 0;
          const snap = (n: number) => Number(n.toFixed(places));
          return (
            <span key={key} className="stepper" title={field.label}>
              <button
                onClick={() => onChange(key, snap(Math.max(field.min, value - step)))}
                disabled={value <= field.min}
              >
                −
              </button>
              <span>
                {field.advanced ? `${field.label} ` : ""}
                {places ? value.toFixed(places) : value}
                {field.unit ?? ""}/{field.max}
              </span>
              <button
                onClick={() => onChange(key, snap(Math.min(field.max, value + step)))}
                disabled={value >= field.max}
              >
                +
              </button>
            </span>
          );
        }

        return (
          <span key={key} className="pill-wrap">
            {open === key && (
              <div className="picker narrow" onClick={(event) => event.stopPropagation()}>
                <div className="picker-list">
                  <div className="picker-head">{field.label}</div>
                  {field.values.map((option) => (
                    <button
                      key={option}
                      className="opt"
                      aria-selected={option === settings[key]}
                      onClick={() => {
                        onChange(key, option);
                        setOpen(null);
                      }}
                    >
                      <span className="opt-main">
                        <span className="opt-name">{pretty(option)}</span>
                      </span>
                      {option === settings[key] && <span className="tick">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              className="pill"
              onClick={(event) => {
                event.stopPropagation();
                setOpen((current) => (current === key ? null : key));
              }}
            >
              {pretty(String(settings[key] ?? field.default))}
              <span className="caret">▾</span>
            </button>
          </span>
        );
      })}
    </>
  );
}

/** fal's size names are wire values; show them as something readable. */
function pretty(value: string): string {
  const named: Record<string, string> = {
    square_hd: "Square HD",
    square: "Square",
    portrait_4_3: "Portrait 4:3",
    portrait_16_9: "Portrait 16:9",
    landscape_4_3: "Landscape 4:3",
    landscape_16_9: "Landscape 16:9",
  };
  return named[value] ?? value;
}

export type { SettingField };
