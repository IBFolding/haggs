"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Accounts run on Supabase Auth (Google or email). Projects stay on this
 * device either way; an account is for your subscription.
 */

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true, storageKey: "haggs-auth" } }) : null;
  return client;
}

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sb = supabase();
    if (!sb) {
      setReady(true);
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

/** Calls one of haggs's own API routes as the signed-in person. */
export async function authed(path: string, init: RequestInit = {}) {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  return fetch(path, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" } });
}
