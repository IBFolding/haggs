"use client";

import { useEffect } from "react";

import { syncProjects, type Portable, type Remote } from "../story/cloud-sync";
import { defaultKv } from "../story/kv";
import type { Project } from "../story/model";
import { createProjectStore } from "../story/store";
import { keepInLibrary } from "./library-actions";
import { FILE_SYNC } from "./file-sync-note";
import { supabase, useSession } from "./session";

/** Keeps this browser's projects and the account's in step while someone is signed in. Renders nothing. */
export function CloudSync() {
  const { session } = useSession();
  const userId = session?.user.id;
  useEffect(() => {
    const sb = supabase();
    if (!sb || !userId) return;
    const kv = defaultKv();
    const store = createProjectStore(kv);
    const remote: Remote = {
      async list() {
        const { data, error } = await sb.from("user_projects").select("id, updated_at");
        if (error) throw error;
        return (data ?? []).map((r) => ({ id: String(r.id), updatedAt: Number(r.updated_at) }));
      },
      async get(id) {
        const { data, error } = await sb.from("user_projects").select("data, sheets").eq("id", id).maybeSingle();
        if (error) throw error;
        return data ? { project: data.data as Project, sheets: (data.sheets as string | null) ?? null } : null;
      },
      async put(project, sheets) {
        const { error } = await sb.from("user_projects").upsert({ user_id: userId, id: project.id, name: project.name, data: project, sheets, updated_at: project.updatedAt });
        if (error) throw error;
      },
      async remove(id) {
        const { error } = await sb.from("user_projects").delete().eq("id", id);
        if (error) throw error;
      },
    };
    // On your own computer, the files a project points at are copied to your account so the live site can show them. The live site has no such files to copy.
    let problem: string | null = null;
    const portable: Portable | undefined = process.env.NEXT_PUBLIC_HOSTED
      ? undefined
      : { perRound: 40, keep: async (url) => { const r = await keepInLibrary(url); if (!r.ok) problem = r.reason; return r.ok ? r.url : r.final ? "never" : null; } };
    let busy = false;
    const run = () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      // A table that isn't there yet, or no network, just means no sync this time.
      problem = null;
      // Only one tab copies at a time, so a second tab never uploads the same files again.
      const locked = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
        if (typeof navigator === "undefined" || !navigator.locks) return work();
        return (await navigator.locks.request("haggs-cloud-sync", { ifAvailable: true }, async (lock) => (lock ? work() : undefined))) as T | undefined;
      };
      void locked(() => syncProjects(kv, store, remote, portable))
        .then(async (r) => {
          if (!r) { busy = false; return; }
          if (portable) await kv.set(FILE_SYNC, { at: Date.now(), waiting: r.waiting, problem });
          // Files still to copy and nothing in the way: carry straight on instead of waiting for the next round.
          if (portable && r.waiting > 0 && !problem) setTimeout(run, 2_000);
        })
        .catch(() => portable && kv.set(FILE_SYNC, { at: Date.now(), waiting: -1, problem: "The account couldn't be reached." }))
        .finally(() => { busy = false; });
    };
    run();
    const timer = setInterval(run, 45_000);
    document.addEventListener("visibilitychange", run);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", run); };
  }, [userId]);
  return null;
}
