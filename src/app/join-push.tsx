"use client";

import Link from "next/link";

import { ACCOUNT_BENEFITS } from "../brand/product-copy";
import { useSession } from "./session";

/** The nudge to make an account. Gone once you are signed in; nothing shows while that is still being read. */
export function JoinButton() {
  const { session, ready } = useSession();
  if (!ready || session) return null;
  return <Link className="plain" href="/signup">Join haggs</Link>;
}

export function JoinBand() {
  const { session, ready } = useSession();
  if (!ready || session) return null;
  return (
    <section className="lp-join" aria-label="Join haggs">
      <div>
        <h2>Join haggs</h2>
        <p>{ACCOUNT_BENEFITS}</p>
      </div>
      <div className="lp-join-go">
        <Link className="fire" href="/signup">Join haggs</Link>
        <Link className="plain" href="/signin">Sign in</Link>
      </div>
    </section>
  );
}
