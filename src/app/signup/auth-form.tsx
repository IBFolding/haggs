"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Nav } from "../nav";
import { supabase, useSession } from "../session";

/**
 * Sign up and sign in, one form. Google is one click; email works with a
 * password or a sign-in link. Projects stay on this device either way —
 * the account is for your plan.
 */
export function AuthForm({ mode }: { mode: "signup" | "signin" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/library";
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const sb = supabase();
  const back = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function oauth(provider: "google" | "github") {
    if (!sb) return;
    setBusy(true);
    setProblem(null);
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back() } });
    if (error) {
      setBusy(false);
      // Supabase says this when the provider isn't switched on for the project.
      setProblem(/not enabled|unsupported provider/i.test(error.message) ? `${provider === "github" ? "GitHub" : "Google"} sign-in isn't switched on for this project yet. Use email for now.` : error.message);
    }
  }

  async function withEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!sb) return;
    setBusy(true);
    setProblem(null);
    const result = !password
      ? await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: mode === "signup" } })
      : mode === "signup"
        ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: back() } })
        : await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setProblem(result.error.message);
      return;
    }
    if ("session" in result.data && result.data.session) router.push(next);
    else setSent(email);
  }

  return (
    <div className="app">
      <Nav current="Account" />
      <div className="canvas">
        <div className="au">
          {session ? (
            <>
              <h1>You're signed in.</h1>
              <p>As {session.user.email}.</p>
              <div className="au-row">
                <Link className="fire" href={next}>Continue</Link>
                <Link className="plain" href="/account">Account</Link>
              </div>
            </>
          ) : sent ? (
            <>
              <h1>Check your email.</h1>
              <p>We sent a link to {sent}. Open it on this device to {mode === "signup" ? "finish signing up" : "sign in"}.</p>
            </>
          ) : (
            <>
              <h1>{mode === "signup" ? "Start making." : "Welcome back."}</h1>
              <p>{mode === "signup" ? "An account holds your plan. Your projects stay on this device." : "Sign in to your haggs account."}</p>
              {!sb ? (
                <p className="library-error">Accounts aren't set up on this copy of haggs. Add the Supabase URL and publishable key to .env.local.</p>
              ) : (
                <>
                  <button className="au-google" disabled={busy} onClick={() => void oauth("google")}>Continue with Google</button>
                  <button className="au-google" disabled={busy} onClick={() => void oauth("github")}>Continue with GitHub</button>
                  <div className="au-or"><span>or with email</span></div>
                  <form onSubmit={(e) => void withEmail(e)}>
                    <label className="sh-field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                    <label className="sh-field">
                      <span>Password — or leave it blank and we'll email you a link</span>
                      <input type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                    </label>
                    <button className="fire" disabled={busy || !email}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}</button>
                  </form>
                  {problem && <p className="library-error" role="alert">{problem}</p>}
                  <p className="au-switch">
                    {mode === "signup" ? <>Have an account? <Link href={`/signin?next=${encodeURIComponent(next)}`}>Sign in</Link></> : <>New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
