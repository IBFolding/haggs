"use client";

import { useEffect, useState } from "react";

import { defaultKv } from "../story/kv";

export const FILE_SYNC = "sync/file-state";
type State = { at: number; waiting: number; problem: string | null };

/** On your own computer: how far copying your files to your account has got, and what is in the way. Says nothing when all is well. */
export function FileSyncNote() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_HOSTED) return;
    const load = () => void defaultKv().get<State>(FILE_SYNC).then((s) => setState(s ?? null)).catch(() => undefined);
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, []);
  if (!state || (state.waiting === 0 && !state.problem)) return null;
  return (
    <p className="sh-note" role="status">
      {state.waiting > 0 ? `${state.waiting} ${state.waiting === 1 ? "file is" : "files are"} still being copied to your account, so they won't play on other devices yet. Keep this tab open while they go.` : "Copying your files to your account hit a problem."}
      {state.problem ? ` Last problem: ${state.problem}` : ""}
    </p>
  );
}
