"use client";

import { useState } from "react";

import type { SettingField, SettingFields, Settings } from "../catalog/settings";

/**
 * Renders the controls a model declares, and only those. There is no list of
 * controls anywhere else to keep in step — add a field to a card and it
 * appears here; remove one and it stops being sent.
 */
export function SettingsRail({
  fields,
  settings,
  onChange,
}: {
  fields: SettingFields;
  settings: Settings;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      {Object.entries(fields).map(([key, field]) => {
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
          return (
            <span key={key} className="stepper" title={field.label}>
              <button
                onClick={() => onChange(key, Math.max(field.min, value - step))}
                disabled={value <= field.min}
              >
                −
              </button>
              <span>
                {value}
                {field.unit ?? ""}/{field.max}
              </span>
              <button
                onClick={() => onChange(key, Math.min(field.max, value + step))}
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
