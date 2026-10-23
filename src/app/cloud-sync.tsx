"use client";

import { useEffect } from "react";

import { syncProjects, type Remote } from "../story/cloud-sync";
import { defaultKv } from "../story/kv";
import type { Project } from "../story/model";
import { createProjectStore } from "../story/store";
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
    let busy = false;
    const run = () => {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      // A table that isn't there yet, or no network, just means no sync this time.
      void syncProjects(kv, store, remote).catch(() => undefined).finally(() => { busy = false; });
    };
    run();
    const timer = setInterval(run, 45_000);
    document.addEventListener("visibilitychange", run);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", run); };
  }, [userId]);
  return null;
}
