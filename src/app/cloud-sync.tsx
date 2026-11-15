"use client";

import { useEffect } from "react";

import { type Portable, type Remote } from "../story/cloud-sync";
import {syncAccount,syncStatusKey,type SyncStatus} from "../story/account-sync";
import { defaultKv } from "../story/kv";
import type { Project } from "../story/model";
import { createProjectStore } from "../story/store";
import { keepInLibrary } from "./library-actions";
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
    let active = true;
    const current = () => active;
    const {data:{subscription:accountGuard}}=sb.auth.onAuthStateChange((_event,next)=>{if(next?.user.id!==userId)active=false;});
    const remote: Remote = {
      async list() {
        const { data, error } = await sb.from("user_projects").select("id, updated_at").eq("user_id", userId).abortSignal(AbortSignal.timeout(20_000));
        if (error) throw error;
        return (data ?? []).map((r) => ({ id: String(r.id), updatedAt: Number(r.updated_at) }));
      },
      async get(id) {
        const { data, error } = await sb.from("user_projects").select("data, sheets").eq("user_id", userId).eq("id", id).abortSignal(AbortSignal.timeout(20_000)).maybeSingle();
        if (error) throw error;
        return data ? { project: data.data as Project, sheets: (data.sheets as string | null) ?? null } : null;
      },
      async put(project, sheets) {
        const { error } = await sb.from("user_projects").upsert({ user_id: userId, id: project.id, name: project.name, data: project, sheets, updated_at: project.updatedAt }).abortSignal(AbortSignal.timeout(20_000));
        if (error) throw error;
      },
      async remove(id) {
        const { error } = await sb.from("user_projects").delete().eq("user_id", userId).eq("id", id).abortSignal(AbortSignal.timeout(20_000));
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
      if (!active || busy || document.visibilityState === "hidden") return;
      busy = true;
      // Missing tables and network failures produce an account-scoped status below.
      problem = null;
      // Only one tab copies at a time, so a second tab never uploads the same files again.
      const locked = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
        if (typeof navigator === "undefined" || !navigator.locks) return work();
        return (await navigator.locks.request("haggs-cloud-sync", { ifAvailable: true }, async (lock) => (lock ? work() : undefined))) as T | undefined;
      };
      const status = async(state:SyncStatus['state'],waiting=0,skipped:string[]=[],issue:string|null=null) => {
        if(!active)return;
        await kv.set(syncStatusKey(userId), {owner:userId,at:Date.now(),state,waiting,skipped,problem:issue} satisfies SyncStatus);
        if(active)window.dispatchEvent(new Event('haggs:sync-status'));
      };
      void locked(async () => {
        await status('syncing');
        const result=await syncAccount(kv, store, remote, userId, portable, current);
        await status('saved',result.waiting,result.skipped,problem);
        if(active&&result.pulled)window.dispatchEvent(new Event('haggs:projects-synced'));
        return result;
      })
        .then(async (r) => {
          if (!r || !active) { busy = false; return; }
          // Files still to copy and nothing in the way: carry straight on instead of waiting for the next round.
          if (portable && r.waiting > 0 && !problem) setTimeout(() => { if(active)run(); }, 2_000);
        })
        .catch(async (error:unknown) => {
          if(!active)return;
          const issue=error instanceof Error&&/conflicts with a device copy|different project/.test(error.message)?error.message:"Account sync failed. Check your connection and sign-in, then retry. Your device projects are still here.";
          await status('error',-1,[],issue);
        })
        .finally(() => { busy = false; });
    };
    run();
    const timer = setInterval(run, 45_000);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("haggs:sync-now",run);
    return () => { active=false;accountGuard.unsubscribe();clearInterval(timer); document.removeEventListener("visibilitychange", run);window.removeEventListener("haggs:sync-now",run); };
  }, [userId]);
  return null;
}
