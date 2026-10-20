"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Plan } from "../../server/billing";
import { Nav } from "../nav";
import { authed, useSession } from "../session";

type Shown = Omit<Plan, "priceEnv">;

/** v1's plans. Subscribe goes to Stripe Checkout; your plan is read back from Stripe. */
export function Pricing({ plans }: { plans: Shown[] }) {
  const router = useRouter();
  const { session } = useSession();
  const [buyable, setBuyable] = useState<string[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void authed("/api/billing/status").then(async (r) => {
      const body = (await r.json()) as { plans?: string[]; status?: { plan: string | null } | null };
      setBuyable(body.plans ?? []);
      setCurrent(body.status?.plan ?? null);
    });
  }, [session]);

  async function subscribe(id: string) {
    if (!session) {
      router.push(`/signup?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(id);
    setProblem(null);
    const r = await authed("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: id }) });
    const body = (await r.json()) as { ok: boolean; url?: string; reason?: string };
    if (body.ok && body.url) window.location.href = body.url;
    else {
      setBusy(null);
      setProblem(body.reason ?? "Checkout couldn't start.");
    }
  }

  return (
    <div className="app">
      <Nav current="Account" />
      <div className="canvas">
        <div className="pr">
          <h1>Plans</h1>
          <p className="pr-lead">Every plan is the whole studio. The difference is who pays for generation: you on your own Comfy key, or included credits.</p>
          <div className="pr-grid">
            {plans.map((p) => {
              const can = buyable?.includes(p.id);
              return (
                <article key={p.id} className={`pr-plan${current === p.id ? " on" : ""}`}>
                  <h2>{p.name}</h2>
                  <p className="pr-price"><b>${p.monthly}</b> a month</p>
                  <p className="pr-credits">{p.credits ? `${p.credits.toLocaleString()} credits a month` : "Your own key, Comfy's prices"}</p>
                  <p className="pr-blurb">{p.blurb}</p>
                  {current === p.id ? (
                    <span className="pr-current">Your plan</span>
                  ) : (
                    <button className={p.id === "byok" ? "plain" : "fire"} disabled={busy !== null || (buyable !== null && !can)} onClick={() => void subscribe(p.id)}>
                      {busy === p.id ? "Opening checkout…" : session ? "Subscribe" : "Sign up to subscribe"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {buyable !== null && buyable.length === 0 && (
            <p className="sh-note">Checkout isn't switched on in this copy of haggs yet: it needs a Stripe key. You can use everything on your own Comfy key meanwhile.</p>
          )}
          <p className="sh-note">Included credits aren't switched on yet. Until they are, generation on every plan runs on your own Comfy key, at the price shown on each Generate button. Cancel any time from your account.</p>
          {problem && <p className="library-error" role="alert">{problem}</p>}
        </div>
      </div>
    </div>
  );
}
