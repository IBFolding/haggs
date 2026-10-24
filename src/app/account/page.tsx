"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FilesPanel } from "../files-panel";
import { Nav } from "../nav";
import { authed, supabase, useSession } from "../session";

/** Your account: who you're signed in as, your plan, and the way to change it. */
export default function Account() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [plan, setPlan] = useState<{ plan: string | null; status: string; renews: number | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bal, setBal] = useState<{ plan: number; topup: number } | null>(null);
  const [topups, setTopups] = useState<{ id: string; usd: number; credits: number }[]>([]);

  useEffect(() => {
    if (ready && !session) router.replace("/signin?next=/account");
    if (session) {
      void authed("/api/billing/status").then(async (r) => {
        const body = (await r.json()) as { status?: typeof plan; topups?: typeof topups };
        setPlan(body.status ?? null);
        setTopups(body.topups ?? []);
      });
      // Credits are read as the person themselves; the database only ever shows their own.
      void supabase()?.rpc("credits_balance").then(({ data }) => { const row = Array.isArray(data) ? data[0] : data; if (row) setBal({ plan: Number(row.plan) || 0, topup: Number(row.topup) || 0 }); });
    }
  }, [ready, session, router]);

  async function topUp(pack: string) {
    const r = await authed("/api/billing/topup", { method: "POST", body: JSON.stringify({ pack }) });
    const body = (await r.json()) as { ok: boolean; url?: string; reason?: string };
    if (body.ok && body.url) window.location.href = body.url;
    else setProblem(body.reason ?? "Checkout couldn't open.");
  }

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
          {bal && (
            <section className="au-plan">
              <span>Generation left</span>
              <b>${((bal.plan + bal.topup) / 100).toFixed(2)}</b>
              <i>{bal.plan ? `$${(bal.plan / 100).toFixed(2)} from your plan this month` : ""}{bal.plan && bal.topup ? ", " : ""}{bal.topup ? `$${(bal.topup / 100).toFixed(2)} in top-ups` : ""}</i>
            </section>
          )}
          {topups.length > 0 && plan?.plan && (
            <div className="au-row">{topups.map((t) => <button key={t.id} className="pill" onClick={() => void topUp(t.id)}>Add a ${t.usd} pack</button>)}</div>
          )}
          <div className="au-row">
            {plan?.plan ? <button className="fire" onClick={() => void manage()}>Manage subscription</button> : <Link className="fire" href="/pricing">See plans</Link>}
            <button className="plain" onClick={() => void supabase()?.auth.signOut().then(() => router.push("/"))}>Sign out</button>
          </div>
          {problem && <p className="library-error" role="alert">{problem}</p>}
          <p className="sh-note">Your projects follow you across devices while you are signed in. Deleting one here also removes it from your account.</p>
          <FilesPanel />
        </div>
      </div>
    </div>
  );
}
