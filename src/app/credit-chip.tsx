"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authed, supabase, useSession } from "./session";

/** Credits are kept in cents. */
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * How much generation you have left, in the header. Credits are read as the signed-in person themselves;
 * the database only ever shows their own. With none left it offers to add some, unless you run on your own key.
 */
export function CreditChip({ ownKey }: { ownKey: boolean }) {
  const { session } = useSession();
  const [left, setLeft] = useState<number | null>(null);
  const [canBuy, setCanBuy] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const read = () => {
      void supabase()?.rpc("credits_balance").then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (alive && row) setLeft((Number(row.plan) || 0) + (Number(row.topup) || 0));
      });
    };
    read();
    void authed("/api/billing/status").then(async (r) => {
      const body = (await r.json()) as { topups?: unknown[] };
      if (alive) setCanBuy((body.topups?.length ?? 0) > 0);
    }).catch(() => undefined);
    const timer = setInterval(read, 20_000);
    window.addEventListener("focus", read);
    window.addEventListener("haggs:credits", read);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", read); window.removeEventListener("haggs:credits", read); };
  }, [userId]);

  if (!userId || left === null) return null;
  if (left <= 0 && (!canBuy || ownKey)) return null;
  return (
    <Link className={`credit-chip${left <= 0 ? " empty" : ""}`} href="/account#credits" title={left > 0 ? "Generation you have left. Open your account to add more." : "Add credits to run on haggs"}>
      {left > 0 ? <><b>{dollars(left)}</b> left</> : "Add credits"}
    </Link>
  );
}
