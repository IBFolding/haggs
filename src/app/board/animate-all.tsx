"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { AnimatePlan } from "../../story/animate-all";
import { creditsText } from "../../story/price-text";

/**
 * Animate stills: pick which of the board's stills become video, see the
 * whole price before pressing, then they run one at a time. The first
 * failure stops the run, so a bad key or a refusal never burns the rest.
 */
export function AnimateAll({
  plan,
  onRun,
  onClose,
  words = { title: "Animate stills", intro: "Each still becomes the first frame of a MiniMax H3 clip at the shot\u2019s own length (4s at least). The still stays as a take to flip back to. Untick title cards and anything that should stay still.", verb: "Animate", done: "animated", doing: "Animating", note: "Prices are Comfy\u2019s published MiniMax H3 rate, billed to your Comfy credits. An estimate, not an invoice.", meta: (s: AnimatePlan["shots"][number]) => `${s.seconds}s \u00b7 ${creditsText(s.usd)}` },
}: {
  plan: AnimatePlan;
  words?: { title: string; intro: string; verb: string; done: string; doing: string; note: string; meta: (s: AnimatePlan["shots"][number]) => string };
  /** Runs one shot; resolves to an error message, or null when it worked. */
  onRun: (shotId: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(plan.shots.map((s) => s.id)));
  const [running, setRunning] = useState<number | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  // The live plan loses stills as they become videos. Keep the submitted batch
  // for progress and row identity instead of counting the shrinking live plan.
  const [batch, setBatch] = useState<AnimatePlan["shots"] | null>(null);
  const stop = useRef(false);
  const pending = useRef(false);

  const listed = batch ?? plan.shots;
  const chosen = listed.filter((s) => picked.has(s.id));
  const total = useMemo(() => Math.round(chosen.reduce((n, s) => n + s.usd, 0) * 100) / 100, [chosen]);
  const busy = running !== null;
  const finished = !busy && (done.length > 0 || failure !== null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function start() {
    if (pending.current) return;
    pending.current = true;
    const submitted = [...chosen];
    setBatch(submitted);
    stop.current = false;
    setFailure(null);
    try {
    for (let i = 0; i < submitted.length; i++) {
      if (stop.current) break;
      const shot = submitted[i]!;
      if (done.includes(shot.id)) continue;
      setRunning(i);
      const problem = await onRun(shot.id);
      if (problem) {
        setFailure(`Shot ${shot.index + 1} failed, so the run stopped: ${problem}`);
        break;
      }
      setDone((d) => [...d, shot.id]);
    }
    } catch {
      setFailure("The request did not finish. Check provider activity before retrying; no automatic retry was sent.");
    } finally {
      pending.current = false;
      setRunning(null);
    }
  }

  const toggle = (id: string) =>
    setPicked((prior) => {
      const next = new Set(prior);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return createPortal(
    <div className="veil" onClick={busy ? undefined : onClose}>
      <div className="sheet wide animate-all" role="dialog" aria-modal="true" aria-labelledby="animate-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="animate-title">{words.title}</h3>
        <p>{words.intro}</p>

        <ul className="animate-list">
          {listed.map((s) => {
            const state = done.includes(s.id) ? "done" : busy && chosen[running!]?.id === s.id ? "running" : "";
            return (
              <li key={s.id} className={state}>
                <label>
                  <input type="checkbox" checked={picked.has(s.id)} disabled={busy || done.includes(s.id)} onChange={() => toggle(s.id)} />
                  <span className="animate-n">{s.index + 1}</span>
                  <span className="animate-beat">{s.beat || "Untitled shot"}</span>
                  <span className="animate-meta">{state === "done" ? "done" : state === "running" ? "working…" : words.meta(s)}</span>
                </label>
              </li>
            );
          })}
        </ul>

        {failure && <p className="library-error" role="alert">{failure}</p>}
        {busy && <p role="status">{words.doing} {running! + 1} of {chosen.length}. You can keep working; takes land on the board as they finish.</p>}
        {finished && !failure && <p role="status">{done.length} shot{done.length === 1 ? "" : "s"} {words.done}.</p>}

        <div className="sheet-row">
          {busy ? (
            <button className="plain" onClick={() => (stop.current = true)}>Stop after this one</button>
          ) : finished ? (
            <button className="fire" onClick={onClose}>Done</button>
          ) : (
            <>
              <button className="fire" disabled={!chosen.length} onClick={() => void start()}>
                {words.verb} {chosen.length} shot{chosen.length === 1 ? "" : "s"} <span className="cost">about {creditsText(total)}</span>
              </button>
              <button className="plain" onClick={onClose}>Cancel</button>
            </>
          )}
        </div>
        <div className="sheet-note">{words.note}</div>
      </div>
    </div>,
    document.body,
  );
}
