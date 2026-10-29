"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { proposalFromRow } from "../agent/proposal";
import type { Proposal } from "../server/bridge";
import { supabase, useSession } from "./session";

/** Account inbox in production; the filesystem bridge during development. */
export function useAgentInbox(project: string) {
  const { session } = useSession();
  const user = session?.user.id;
  const liveMode = process.env.NODE_ENV === "production";
  const identity = `${project}:${liveMode ? user ?? "" : "local"}`;
  const current = useRef(identity); current.current = identity;
  const [state, setState] = useState<{ identity: string; items: Proposal[] }>({ identity, items: [] });
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  useEffect(() => {
    let active = true;
    let busy = false;
    setState({ identity, items: [] }); setError(null);
    async function check() {
      if (busy || document.visibilityState === "hidden" || (liveMode && !user)) return;
      busy = true;
      const started = version.current;
      try {
        let items: Proposal[];
        if (liveMode) {
          const db = supabase(); if (!db) return;
          const result = await db.from("agent_inbox").select("id,kind,summary,payload,board,format_id,created_at").eq("user_id", user!).eq("project", project).order("created_at");
          if (result.error) throw new Error(result.error.message);
          items = (result.data ?? []).map(proposalFromRow);
        } else {
          const r = await fetch(`/api/bridge/inbox?project=${encodeURIComponent(project)}`);
          if (!r.ok) throw new Error("The local inbox couldn't be read.");
          items = ((await r.json()) as { items?: Proposal[] }).items ?? [];
        }
        if (active && started === version.current) { setState({ identity, items }); setError(null); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "The inbox couldn't be read."); }
      finally { busy = false; }
    }
    void check();
    const timer = setInterval(check, 5000);
    document.addEventListener("visibilitychange", check);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [identity, project, user, liveMode]);
  const drop = useCallback(async (id: string) => {
    try {
      if (liveMode) {
        const db = supabase(); if (!db || !user) throw new Error("Sign in to clear your inbox.");
        const r = await db.from("agent_inbox").delete().eq("user_id", user).eq("project", project).eq("id", id);
        if (r.error) throw new Error(r.error.message);
      } else {
        const r = await fetch(`/api/bridge/inbox?project=${encodeURIComponent(project)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!r.ok) throw new Error("The proposal couldn't be cleared.");
      }
      if (current.current === identity) { version.current++; setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })); setError(null); }
      return true;
    } catch (e) { if (current.current === identity) setError(e instanceof Error ? e.message : "The proposal couldn't be cleared."); return false; }
  }, [identity, project, user, liveMode]);
  return { items: state.identity === identity ? state.items : [], drop, error };
}
