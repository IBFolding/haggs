import { createClient } from "@supabase/supabase-js";

import { PLANS, creditsFor, status as planStatus, type User } from "./billing";
import { COMFY_COOKIE, keyIn } from "./keys";
import { TOKEN_COOKIE, userNow } from "./auth";
import { stripeFromEnv } from "./stripe";

/**
 * Running on the platform's own Comfy key. A person with their own key always
 * uses it, and pays Comfy directly. Otherwise, when the platform key is
 * switched on, a signed-in person with an active plan runs on ours and the run
 * is paid for in credits: spent before it starts, given back if it fails.
 */

export const platformOn = () => process.env.HAGGS_PLATFORM_KEYS === "1" && Boolean(process.env.COMFY_PLATFORM_KEY?.trim());

export type Access = { ok: true; key: string; platform: boolean; settle: (completed: boolean) => Promise<void> } | { ok: false; reason: string; needsKey?: boolean };

export type Deps = {
  own: string | undefined;
  user: User | null;
  platformKey: string | undefined;
  /** Whether the person has an active paid plan. */
  subscribed: (user: User) => Promise<boolean>;
  spend: (cents: number, memo: string, ref: string) => Promise<boolean>;
  refund: (ref: string) => Promise<void>;
  ref: () => string;
};

/** The decision, with everything it needs handed in so it can be tested without Stripe or Supabase. */
export async function decide(deps: Deps, usd: number, memo: string, needKeyMessage: string): Promise<Access> {
  if (deps.own) return { ok: true, key: deps.own, platform: false, settle: async () => undefined };
  if (!deps.platformKey) return { ok: false, reason: needKeyMessage, needsKey: true };
  if (!deps.user) return { ok: false, reason: "Sign in to run on a plan, or add your own Comfy key.", needsKey: true };
  if (!(await deps.subscribed(deps.user))) return { ok: false, reason: "Pick a plan to run on the platform, or add your own Comfy key.", needsKey: true };
  const ref = deps.ref();
  const cents = creditsFor(usd);
  if (!(await deps.spend(cents, memo, ref))) return { ok: false, reason: `Not enough credits for this run (it costs about ${cents}). Top up from your account, or add your own Comfy key.`, needsKey: true };
  let settled = false;
  return {
    ok: true,
    key: deps.platformKey,
    platform: true,
    // A run that didn't complete gets its credits back, once.
    settle: async (completed) => {
      if (settled) return;
      settled = true;
      if (!completed) await deps.refund(ref).catch(() => undefined);
    },
  };
}

const active = new Map<string, { ok: boolean; until: number }>();

async function liveDeps(): Promise<Deps> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } });
  return {
    own: keyIn(jar, COMFY_COOKIE),
    user: await userNow(),
    platformKey: platformOn() ? process.env.COMFY_PLATFORM_KEY!.trim() : undefined,
    subscribed: async (user) => {
      const hit = active.get(user.id);
      if (hit && hit.until > Date.now()) return hit.ok;
      const stripe = stripeFromEnv();
      const s = stripe ? await planStatus(stripe, process.env, user).catch(() => null) : null;
      const ok = Boolean(s?.plan && (s.status === "active" || s.status === "trialing") && PLANS.some((p) => p.id === s.plan));
      active.set(user.id, { ok, until: Date.now() + 60_000 });
      return ok;
    },
    spend: async (cents, memo, ref) => {
      const { data, error } = await db.rpc("credits_spend", { cents, memo, ref });
      if (error) throw new Error("Credits couldn't be checked. Try again in a moment.");
      return data === true;
    },
    refund: async (ref) => void (await db.rpc("credits_refund", { ref })),
    ref: () => crypto.randomUUID(),
  };
}

/** The key for a run that costs about `usd`, and the settling of its credits when it is over. */
export async function comfyAccess(usd: number, memo: string, needKeyMessage = "Add a Comfy key to run this."): Promise<Access> {
  try {
    return await decide(await liveDeps(), usd, memo, needKeyMessage);
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "That couldn't be started." };
  }
}

/** Runs something that costs credits and settles them by whether it completed. */
export async function charged<T extends { ok: boolean }>(access: Extract<Access, { ok: true }>, run: (key: string) => Promise<T>): Promise<T> {
  try {
    const result = await run(access.key);
    await access.settle(result.ok);
    return result;
  } catch (caught) {
    await access.settle(false);
    throw caught;
  }
}

/** A key for reading Comfy's catalog (listing and opening workflows): free to the platform, so any signed-in person on a plan may use it. */
export async function readKey(): Promise<string | undefined> {
  try {
    const deps = await liveDeps();
    if (deps.own) return deps.own;
    if (deps.platformKey && deps.user && (await deps.subscribed(deps.user))) return deps.platformKey;
  } catch {
    /* no key */
  }
  return undefined;
}
