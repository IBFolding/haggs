import { createClient } from "@supabase/supabase-js";

import { generateWithFal, runAdJobs, type AdJob } from "./adRunner";
import { sendToStoryPop } from "./storypop";

/** The real wiring for the ad runner: Supabase for the job list, fal for the picture, StoryPop for the news. */
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
  return runAdJobs(
    {
      claim: async (n) => {
        const { data, error } = await c.db.rpc("storypop_ad_claim", { max_jobs: n, secret: c.secret });
        if (error || !Array.isArray(data)) return [];
        return data.map((r: { job_id: string; owner_id: string; job_reference: string; job_input: AdJob["input"] }) => ({ id: r.job_id, ownerId: r.owner_id, reference: r.job_reference, input: r.job_input ?? {} }));
      },
      generate: (prompt) => generateWithFal(prompt),
      settle: async (id, status, url) => {
        const { data, error } = await c.db.rpc("storypop_job_settle", { job: id, new_status: status, url: url ?? null, secret: c.secret });
        return !error && data === true;
      },
      notify: (event) => sendToStoryPop(event)
    },
    max
  );
}
