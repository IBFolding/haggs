import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The StoryPop partner link. StoryPop is another product of ours; people connect their StoryPop account to their
 * haggs account so credits are shared and StoryPop can hand haggs a job to make.
 *
 *   StoryPop -> haggs: a bearer key (STORYPOP_PARTNER_KEY) on /api/storypop/{balance,credits,jobs}.
 *   haggs -> StoryPop: events signed with HMAC-SHA256 (STORYPOP_WEBHOOK_SECRET) to STORYPOP_WEBHOOK_URL.
 *
 * Neither side trusts an id the other claims on its own: the person proves who they are on the haggs side with
 * their own sign-in, and the shared key only unlocks the few server routes above.
 */

export type StoryPopEvent = {
  type: "account.linked" | "credits.updated" | "credits.low" | "job.completed" | "job.failed";
  haggsUserId?: string;
  linkToken?: string;
  creditsBalance?: number;
  monthlyCredits?: number;
  haggsJobId?: string;
  resultUrl?: string;
  reason?: string;
  title?: string;
};

export const JOB_KINDS = ["remix", "template", "project"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const cleanReference = (v: unknown): string | null => (typeof v === "string" && /^[A-Za-z0-9_:.-]{1,100}$/.test(v) ? v : null);
export const isJobKind = (v: unknown): v is JobKind => (JOB_KINDS as readonly unknown[]).includes(v);
/** A grant is a whole number of credits within a sane range. */
export const cleanCredits = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 100_000 ? v : null);

/** Whether a request carries the partner key. Constant-time, and refuses a missing or short key. */
export function partnerKeyOk(authorization: string | null, key: string | undefined): boolean {
  const given = /^Bearer (.+)$/.exec(authorization ?? "")?.[1];
  if (!given || !key || key.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const signBody = (raw: string, secret: string) => createHmac("sha256", secret).update(raw).digest("hex");

/** Tells StoryPop something happened. Resolves false (never throws) when StoryPop isn't configured or can't be reached. */
export async function sendToStoryPop(event: StoryPopEvent, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<boolean> {
  const url = env.STORYPOP_WEBHOOK_URL?.trim();
  const secret = env.STORYPOP_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return false;
  const raw = JSON.stringify(event);
  try {
    const res = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json", "x-haggs-signature": signBody(raw, secret) }, body: raw });
    return res.ok;
  } catch {
    return false;
  }
}
