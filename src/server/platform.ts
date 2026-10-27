import {reserveStorage,finishStorage,reconcileStorage} from "./storage-quota";
import {jobOutcome,type JobOutcome} from "../providers/job-outcome";
import { createClient } from "@supabase/supabase-js";

import { PLANS, creditsFor, status as planStatus, type User } from "./billing";
import { COMFY_COOKIE, keyIn } from "./keys";
import { TOKEN_COOKIE, userNow } from "./auth";
import { stripeFromEnv } from "./stripe";

/**
 * Running on the platform's own Comfy key. A person with their own key always
 * uses it, and pays Comfy directly. Otherwise, when the platform key is
 * switched on, a signed-in person with credits runs on ours, whether the
 * credits came with a plan or were bought on their own. The run is paid for in
 * credits: spent before it starts, given back if it fails.
 */

export const platformOn = () => process.env.HAGGS_PLATFORM_KEYS === "1" && Boolean(process.env.COMFY_PLATFORM_KEY?.trim());

export type Access = { ok: true; key: string; platform: boolean; storage?:NonNullable<JobOutcome["storage"]>; settle: (completed: boolean) => Promise<void> } | { ok: false; reason: string; needsKey?: boolean };

export type Deps = {
  own: string | undefined;
  user: User | null;
  platformKey: string | undefined;
  /** Whether the person has an active paid plan. */
  subscribed: (user: User) => Promise<boolean>;
  spend: (cents: number, memo: string, ref: string) => Promise<boolean>;
  refund: (ref: string) => Promise<void>;
  /** When the studio is gated: the reason a person may not run on their own key, or null when they may. */
  gate?: (user: User | null) => Promise<string | null>;
  /** Whether the person holds any credits at all, bought alone or with a plan. */
  hasCredits?: () => Promise<boolean>;
  ref: () => string;
  prepareStorage?: (user:User) => Promise<NonNullable<JobOutcome["storage"]>|undefined>;
  releaseStorage?: (hold:NonNullable<JobOutcome["storage"]>)=>Promise<void>;
};

/** The decision, with everything it needs handed in so it can be tested without Stripe or Supabase. */
export async function decide(deps: Deps, usd: number, memo: string, needKeyMessage: string): Promise<Access> {
  if (deps.own) {
    const refused = await deps.gate?.(deps.user);
    if (refused) return { ok: false, reason: refused, needsKey: true };
    return { ok: true, key: deps.own, platform: false, settle: async () => undefined };
  }
  if (!deps.platformKey) return { ok: false, reason: needKeyMessage, needsKey: true };
  if (!deps.user) return { ok: false, reason: "Sign in to run on credits, or add your own Comfy key.", needsKey: true };
  const storage=await deps.prepareStorage?.(deps.user);
  const ref = deps.ref();
  const cents = creditsFor(usd);
  let funded:boolean;
  try {funded=await deps.spend(cents,memo,ref);}catch(error){if(storage)await deps.releaseStorage?.(storage);throw error;}
  if (!funded) { if(storage)await deps.releaseStorage?.(storage); return { ok: false, reason: `Not enough credits for this run (it costs about ${cents}). Buy credits from your account, or add your own Comfy key.`, needsKey: true }; }
  let settled = false;
  return {
    ok: true,
    key: deps.platformKey,
    platform: true,
    ...(storage?{storage}:{}),
    // A run that didn't complete gets its credits back, once. A storage hold no output used is released either way.
    settle: async (completed) => {
      if (settled) return;
      if (!completed) await deps.refund(ref);
      if(storage&&!storage.saved)await deps.releaseStorage?.(storage);
      settled = true;
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
  const subscribedTo = async (user: User) => {
    const hit = active.get(user.id);
    if (hit && hit.until > Date.now()) return hit.ok;
    const stripe = stripeFromEnv();
    const s = stripe ? await planStatus(stripe, process.env, user).catch(() => null) : null;
    const ok = Boolean(s?.plan && (s.status === "active" || s.status === "trialing") && PLANS.some((p) => p.id === s.plan));
    active.set(user.id, { ok, until: Date.now() + 60_000 });
    return ok;
  };
  return {
    prepareStorage: async user => {
      if(!process.env.BLOB_READ_WRITE_TOKEN)return undefined;
      const maxBytes=100*1024*1024; // Cloud runner rejects larger output before saving.
      await reconcileStorage(user,token);
      return {id:await reserveStorage(user,maxBytes),userId:user.id,maxBytes,saved:false};
    },
    releaseStorage: hold=>finishStorage(hold.userId,hold.id,null),
    own: keyIn(jar, COMFY_COOKIE),
    user: await userNow(),
    platformKey: platformOn() ? process.env.COMFY_PLATFORM_KEY!.trim() : undefined,
    subscribed: subscribedTo,
    spend: async (cents, memo, ref) => {
      const { data, error } = await db.rpc("credits_spend", { cents, memo, ref });
      if (error) throw new Error("Credits couldn't be checked. Try again in a moment.");
      return data === true;
    },
    refund: async (ref) => { const {error}=await db.rpc("credits_refund",{ref});if(error)throw new Error("Credit refund is pending. Check your account before retrying."); },
    // HAGGS_GATE=1 turns the studio into a paid seat: your own key or GPU needs the Platform plan. Emails in HAGGS_FREE_EMAILS skip it.
    gate: async (user) => {
      if (process.env.HAGGS_GATE !== "1") return null;
      if (!user) return "Sign in to run on your own key. The studio is the Platform plan, $15 a month, or buy credits to run on haggs.";
      const free = (process.env.HAGGS_FREE_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      if (free.includes(user.email.toLowerCase())) return null;
      if (await subscribedTo(user)) return null;
      return "Your own key runs on the Platform plan ($15 a month). Pick it, or buy credits to run on haggs.";
    },
    hasCredits: async () => {
      const { data } = await db.rpc("credits_balance");
      const row = Array.isArray(data) ? data[0] : data;
      return Number(row?.plan ?? 0) + Number(row?.topup ?? 0) > 0;
    },
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
  const outcome:JobOutcome={state:"not-submitted",...(access.storage?{storage:access.storage}:{})};
  return jobOutcome.run(outcome,async()=>{
    const keepReservation=()=>outcome.state==="uncertain"||outcome.state==="completed";
    try {
      const result=await run(access.key);
      await access.settle(result.ok||keepReservation());
      if(!result.ok&&access.platform&&keepReservation()&&"reason" in result && typeof result.reason==="string")result.reason+=` Credits remain reserved while the provider charge is checked.${outcome.jobId?` Comfy job: ${outcome.jobId}.`:""} Check Activity before running again.`;
      return result;
    }catch(error){await access.settle(keepReservation());throw error;}
  });
}

/** A key for reading Comfy's catalog (listing and opening workflows): free to the platform, so any signed-in person on a plan may use it. */
export async function readKey(): Promise<string | undefined> {
  try {
    const deps = await liveDeps();
    if (deps.own) return deps.own;
    if (deps.platformKey && deps.user && ((await deps.subscribed(deps.user)) || (await deps.hasCredits?.()))) return deps.platformKey;
  } catch {
    /* no key */
  }
  return undefined;
}
