"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "../nav";
import { authed, supabase, useSession } from "../session";

/** Your account: who you're signed in as, your plan, and the way to change it. */
export default function Account() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [plan, setPlan] = useState<{ plan: string | null; status: string; renews: number | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !session) router.replace("/signin?next=/account");
    if (session) void authed("/api/billing/status").then(async (r) => setPlan(((await r.json()) as { status?: typeof plan }).status ?? null));
  }, [ready, session, router]);

  async function manage() {
    const r = await authed("/api/billing/portal", { method: "POST" });
    const body = (await r.json()) as { ok: boolean; url?: string; reason?: string };
    if (body.ok && body.url) window.location.href = body.url;
    else setProblem(body.reason ?? "The billing portal couldn't open.");
  }

  if (!session) return <div className="app"><Nav current="Account" /></div>;
  const names: Record<string, string> = { byok: "Bring your own key", starter: "Starter", mid: "Mid", pro: "Pro" };
  return (
    <div className="app">
      <Nav current="Account" />
      <div className="canvas">
        <div className="au">
          <h1>Account</h1>
          <p>Signed in as {session.user.email}.</p>
          <section className="au-plan">
            <span>Plan</span>
            <b>{plan?.plan ? names[plan.plan] : "No plan yet"}</b>
            {plan?.renews && <i>Renews {new Date(plan.renews).toLocaleDateString()}</i>}
          </section>
          <div className="au-row">
            {plan?.plan ? <button className="fire" onClick={() => void manage()}>Manage subscription</button> : <Link className="fire" href="/pricing">See plans</Link>}
            <button className="plain" onClick={() => void supabase()?.auth.signOut().then(() => router.push("/"))}>Sign out</button>
          </div>
          {problem && <p className="library-error" role="alert">{problem}</p>}
          <p className="sh-note">Your projects live on this device, not in your account. Export a project from Projects to move it.</p>
        </div>
      </div>
    </div>
  );
}
