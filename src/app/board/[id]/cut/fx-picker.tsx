"use client";

import { FX, isFx } from "../../../../story/fx";
import type { Shot } from "../../../../story/model";

/**
 * The look for one shot, with a button to give every shot the same one.
 * The preview approximates it; the render uses the exact ffmpeg filter.
 */
export function LookPicker({ shot, onShot, onAll }: { shot: Shot; onShot: (id: string, change: (s: Shot) => Shot) => void; onAll: (fx: string | null) => void }) {
  const current = isFx(shot.fx) ? shot.fx : "";
  const set = (value: string) =>
    onShot(shot.id, (s) => {
      const { fx: _drop, ...rest } = s;
      return value ? { ...rest, fx: value } : rest;
    });
  const about = FX.find((f) => f.id === current)?.says;
  return (
    <div className="ed-row ed-look">
      <label title="Burns a look into the picture when you export. The preview is an approximation.">
        Look
        <select value={current} onChange={(e) => set(e.target.value)}>
          <option value="">None</option>
          {FX.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>
      {current && <button className="plain" onClick={() => onAll(current)}>Use on every shot</button>}
      {current && <button className="plain" onClick={() => onAll(null)}>Clear all</button>}
      {about && <small className="ed-look-says">{about}</small>}
    </div>
  );
}
