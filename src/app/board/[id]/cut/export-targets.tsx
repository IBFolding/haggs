"use client";

import { useState } from "react";

import { findSubjects } from "../../../focus-actions";
import { PRESETS, applyPreset, presetById, withFocus } from "../../../../story/export-presets";
import type { Clip } from "../../../../story/cut";
import { MAX_FRAMES, type Point } from "../../../../story/focus";
import type { Project } from "../../../../story/model";
import { grabFrame } from "./grab-frames";

/**
 * Where the film is going: X, TikTok, Reels and Shorts, or YouTube. Choosing one sets the frame shape, and
 * Render MP4 then levels the sound to what the platforms play at. For the tall ones, "Find the faces"
 * looks at one picture per shot and re-frames each around its subject.
 */
export function ExportTargets({ clips, target, onTarget, apply, onNeedKey }: { clips: Clip[]; target: string | null; onTarget: (id: string | null) => void; apply: (change: (p: Project) => Project) => void; onNeedKey: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const chosen = target ? presetById(target) : undefined;

  const choose = (id: string) => {
    const preset = presetById(id);
    if (!preset) return;
    setNote(null);
    onTarget(id);
    apply((p) => applyPreset(p, preset));
  };

  async function findFaces() {
    setBusy(true);
    setNote(null);
    try {
      const unique = [...new Map(clips.map((c) => [c.shotId, c])).values()];
      const grabbed = (await Promise.all(unique.map((c) => grabFrame(c)))).filter((f): f is NonNullable<typeof f> => f !== null);
      if (!grabbed.length) return setNote("The browser couldn't read these pictures to look at them. Set the crop by hand in each shot's Frame controls.");
      const found: Record<string, Point> = {};
      for (let i = 0; i < grabbed.length; i += MAX_FRAMES) {
        const r = await findSubjects(grabbed.slice(i, i + MAX_FRAMES));
        if (!r.ok) {
          if (r.needsKey) onNeedKey();
          return setNote(r.reason);
        }
        Object.assign(found, r.focus);
      }
      apply((p) => withFocus(p, found));
      setNote(`Looked at ${grabbed.length} shot${grabbed.length === 1 ? "" : "s"} and re-framed ${Object.keys(found).length}. Adjust any shot in its Frame controls.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ed-targets">
      <b>Make it for</b>
      <div className="ed-targets-row">
        {PRESETS.map((p) => (
          <button key={p.id} className="pill" aria-pressed={target === p.id} onClick={() => choose(p.id)} title={p.says}>
            {p.name}
          </button>
        ))}
      </div>
      {chosen && <small>{chosen.says} Render MP4 sets the sound to {chosen.loudness} LUFS.</small>}
      {chosen?.reframe && (
        <>
          <button className="pill" disabled={busy} onClick={() => void findFaces()}>
            {busy ? "Looking at the shots…" : "Find the faces"}
          </button>
          <small>Uses your Claude key: well under a cent for a whole film.</small>
        </>
      )}
      {note && <small role="status">{note}</small>}
    </div>
  );
}
