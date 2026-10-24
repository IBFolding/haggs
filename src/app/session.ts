"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Accounts run on Supabase Auth (Google or email). Projects stay on this
 * device either way; an account is for your subscription.
 */

let client: SupabaseClient | null | undefined;

/** Keeps the access token where the server can read it, for as long as it is good. Cleared on sign-out. */
function keepCookie(session: Session | null) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    if (!session) document.cookie = `haggs-at=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    else document.cookie = `haggs-at=${session.access_token}; Path=/; Max-Age=${Math.max(60, (session.expires_at ?? 0) - Math.floor(Date.now() / 1000))}; SameSite=Lax${secure}`;
  } catch {
    /* no cookies here */
  }
}

export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: false, storageKey: "haggs-auth" } }) : null;
  if (client) {
    // The server sees who you are through this cookie (server actions can't read a bearer header).
    void client.auth.getSession().then(({ data }) => keepCookie(data.session));
    client.auth.onAuthStateChange((_event, next) => keepCookie(next));
  }
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
