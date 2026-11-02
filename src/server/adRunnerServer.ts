import { createClient } from "@supabase/supabase-js";
import { put } from "@vercel/blob";

import { createCloudRunner, type Kept } from "../providers/cloud";
import { cloudPrice, cloudWorkflow } from "../providers/cloud-models";
import { creditsFor } from "./billing";
import { platformOn } from "./platform";
import { runAdJobs, type AdJob } from "./adRunner";
import { sendToStoryPop } from "./storypop";

/**
 * The real wiring for the ad runner: Supabase for the job list and the ad account's credits, Comfy Cloud (haggs's own
 * platform key, the same one hosted runs use) for the picture, Vercel Blob to keep it, and StoryPop for the news.
 */
export const AD_MODEL = "google/nano-banana-2-lite";
const SETTINGS = { aspect_ratio: "9:16", resolution: "1K" } as const;

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

async function keepAd(bytes: Uint8Array, ext: Kept): Promise<string> {
  const type = TYPES[ext];
  if (!type) throw new Error("Ads are kept as pictures.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("No file store is connected.");
  const blob = await put(`storypop-ads/${crypto.randomUUID()}.${ext}`, Buffer.from(bytes), { access: "public", contentType: type });
  return blob.url;
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.HAGGS_WEBHOOK_SECRET?.trim();
  if (!url || !anon || !secret) return null;
  return { db: createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }), secret };
}

export async function runAdJobsNow(max = 3): Promise<{ done: number; failed: number; skipped?: string }> {
  const c = client();
  if (!c) return { done: 0, failed: 0, skipped: "not switched on" };
  if (!platformOn()) return { done: 0, failed: 0, skipped: "haggs platform keys are not on" };
  const usd = cloudPrice(AD_MODEL, SETTINGS);
  if (usd === null) return { done: 0, failed: 0, skipped: "ad model unavailable" };
  const cloud = createCloudRunner({ apiKey: process.env.COMFY_PLATFORM_KEY!.trim(), keep: keepAd });
  const owners = new Map<string, string>();

  return runAdJobs(
    {
      priceCents: creditsFor(usd),
      claim: async (n) => {
        const { data, error } = await c.db.rpc("storypop_ad_claim", { max_jobs: n, secret: c.secret });
        if (error || !Array.isArray(data)) return [];
        const jobs = data.map((r: { job_id: string; owner_id: string; job_reference: string; job_input: AdJob["input"] }) => ({ id: r.job_id, ownerId: r.owner_id, reference: r.job_reference, input: r.job_input ?? {} }));
        for (const j of jobs) owners.set(j.id, j.ownerId);
        return jobs;
      },
      spend: async (jobId, cents) => {
        const { data, error } = await c.db.rpc("storypop_credits_spend", { target: owners.get(jobId), cents, memo: "StoryPop ad build", ref: `ad:${jobId}`, secret: c.secret });
        if (error) throw new Error("Credits couldn't be checked.");
        return data === true;
      },
      refund: async (jobId) => {
        await c.db.rpc("storypop_credits_refund", { target: owners.get(jobId), ref: `ad:${jobId}`, secret: c.secret });
      },
      generate: async (prompt) => (await cloud.run(cloudWorkflow(AD_MODEL, { prompt, settings: { ...SETTINGS }, images: [] }), "20")).url,
      settle: async (id, status, url) => {
        const { data, error } = await c.db.rpc("storypop_job_settle", { job: id, new_status: status, url: url ?? null, secret: c.secret });
        return !error && data === true;
      },
      notify: (event) => sendToStoryPop(event)
    },
    max
  );
}
