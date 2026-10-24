"use client";

import { useEffect } from "react";

import { defaultKv } from "../story/kv";
import { planRuns } from "../story/run-sync";
import { createRunStore, type Run } from "../story/runs";
import { keepInLibrary } from "./library-actions";
import { supabase, useSession } from "./session";

export const RUNS_SYNCED = "haggs:runs-synced";

/**
 * Keeps this browser's Gallery and the account's in step while someone is
 * signed in, files included: a result made on your own machine is copied to
 * your account's file store so the live site and your phone can play it.
 * Renders nothing.
 */
export function RunSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  useEffect(() => {
    const sb = supabase();
    if (!sb || !userId) return;
    const runs = createRunStore(defaultKv());
    let busy = false;
    const cycle = async () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const local = await runs.list();
        const { data: rows, error } = await sb.from("user_runs").select("id, rev, deleted");
        if (error) throw error;
        const remote = (rows ?? []).map((r) => ({ id: String(r.id), rev: Number(r.rev), ...(r.deleted ? { deleted: true } : {}) }));
        const deletedHere = await runs.deleted();
        const plan = planRuns(local.map((r) => ({ id: r.id, rev: r.rev ?? r.at })), remote, deletedHere);
        let changed = false;

        if (plan.markDeleted.length) {
          const { error: e } = await sb.from("user_runs").upsert(plan.markDeleted.map((id) => ({ user_id: userId, id, data: {}, rev: Date.now(), deleted: true })));
          if (e) throw e;
        }
        // Whether the account now knows or already knew, there is nothing left to tell it.
        await runs.settled(deletedHere);
        if (plan.removeLocal.length) { await runs.drop(plan.removeLocal); changed = true; }

        if (plan.pull.length) {
          const { data, error: e } = await sb.from("user_runs").select("data").in("id", plan.pull).eq("deleted", false);
          if (e) throw e;
          await runs.adopt((data ?? []).map((r) => r.data as Run));
          changed = true;
        }

        const send = async (run: Run, url: string) => {
          const { remote: _drop, ...rest } = run;
          const { error: e } = await sb.from("user_runs").upsert({ user_id: userId, id: run.id, data: { ...rest, url } satisfies Run, rev: run.rev ?? run.at, deleted: false });
          if (e) throw e;
        };
        // A few files a round, so a big backlog never freezes the page. A run whose file can't be copied yet
        // is still sent, so it shows up everywhere; the file follows on a later round.
        const sent = new Set<string>();
        for (const run of local.filter((r) => !r.remote && r.url.startsWith("/api/local/")).slice(0, 3)) {
          const kept = await keepInLibrary(run.url);
          if (!kept.ok) continue;
          await runs.patch(run.id, { remote: kept.url });
          await send(run, kept.url);
          sent.add(run.id);
        }
        for (const id of plan.push) {
          const run = local.find((r) => r.id === id);
          if (run && !sent.has(id)) await send(run, run.remote ?? run.url);
        }
        if (changed) window.dispatchEvent(new Event(RUNS_SYNCED));
      } catch {
        // No table, no network, or signed out mid-way: try again next round.
      } finally {
        busy = false;
      }
    };
    void cycle();
    const timer = setInterval(() => void cycle(), 30_000);
    document.addEventListener("visibilitychange", cycle);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", cycle); };
  }, [userId]);
  return null;
}
