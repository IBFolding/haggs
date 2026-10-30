import { createClient } from "@supabase/supabase-js";

/** Server-created journal records are owner-scoped and contain no credentials or media. */
export type JournalEntry = { submissionId: string; userId: string; deployment: string; outputNode: string; state: "dispatching" | "accepted"; jobId?: string; jobUrl?: string };
export type Journal = {
  begin(entry: JournalEntry): Promise<boolean>;
  accept(userId: string, submissionId: string, jobId: string, jobUrl: string): Promise<boolean>;
  read(userId: string, submissionId: string): Promise<JournalEntry | null>;
};

/** Server calls are authenticated by the existing database secret; reads use the user's token and RLS. */
export function createManagedJobJournal(env: NodeJS.ProcessEnv, userToken: string): Journal {
  const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret = env.HAGGS_WEBHOOK_SECRET;
  if (!url || !key || !secret || !userToken) throw new Error("Managed job recovery is unavailable; no job was started.");
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, key, opts);
  const mine = createClient(url, key, { ...opts, global: { headers: { Authorization: `Bearer ${userToken}` } } });
  return {
    async begin(entry) {
      const { data, error } = await admin.rpc("managed_job_begin", { target: entry.userId, submission: entry.submissionId, p_deployment: entry.deployment, p_output_node: entry.outputNode, secret });
      if (error) throw new Error("Could not reserve the job journal; no job was started.");
      return data === true;
    },
    async accept(userId, submissionId, jobId, jobUrl) {
      const { data, error } = await admin.rpc("managed_job_accept", { target: userId, submission: submissionId, provider_id: jobId, provider_url: jobUrl, secret });
      if (error) throw new Error("Job was submitted but recovery details could not be recorded. Do not resubmit.");
      return data === true;
    },
    async read(userId, submissionId) {
      const { data, error } = await mine.from("managed_job_journal").select("submission_id,user_id,deployment,output_node,state,provider_job_id,provider_job_url").eq("user_id", userId).eq("submission_id", submissionId).maybeSingle();
      if (error) throw new Error("Could not read the job journal. Do not resubmit.");
      if (!data) return null;
      return { submissionId: data.submission_id, userId: data.user_id, deployment: data.deployment, outputNode: data.output_node, state: data.state, ...(data.provider_job_id ? { jobId: data.provider_job_id, jobUrl: data.provider_job_url } : {}) } as JournalEntry;
    },
  };
}

/** Canonicalize a provider-supplied job URL without accepting a different origin or job. */
function jobPath(entry: JournalEntry, job: { id?: string; urls?: { self?: string } }): { id: string; path: string } {
  if (!job.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(job.id) || !job.urls?.self) throw new Error("Provider job identity is missing. Do not resubmit.");
  const base = new URL(entry.deployment);
  const url = new URL(job.urls.self, base.origin);
  if (url.origin !== base.origin || url.username || url.password || url.search || url.hash || !url.pathname.endsWith(`/api/v2/jobs/${job.id}`) || !/^([/][a-zA-Z0-9_-]+)+$/.test(url.pathname)) throw new Error("Provider job URL is invalid. Do not resubmit.");
  return { id: job.id, path: url.pathname };
}

/** Persist intent before the only submission. A retry can inspect but never dispatch again. */
export async function submitJournaled(entry: JournalEntry, journal: Journal, submit: (reference: string) => Promise<{ id?: string; urls?: { self?: string } }>) {
  if (entry.state !== "dispatching" || !await journal.begin(entry)) throw new Error("This submission already exists; recover it instead of resubmitting.");
  const job = await submit(entry.submissionId); // On any uncertainty the dispatching record remains.
  const safe = jobPath(entry, job);
  if (!await journal.accept(entry.userId, entry.submissionId, safe.id, safe.path)) throw new Error("Job was submitted but its journal could not be updated. Do not resubmit.");
  return { id: safe.id, urls: { self: safe.path } };
}

/** A missing listing is never treated as proof that it is safe to resubmit. */
export async function recoverJournaled(userId: string, submissionId: string, journal: Journal, find: (reference: string) => Promise<{ id?: string; urls?: { self?: string } } | null>) {
  const entry = await journal.read(userId, submissionId);
  if (!entry || entry.userId !== userId || entry.submissionId !== submissionId) throw new Error("Job not found for this account.");
  if (entry.state === "accepted" && entry.jobId && entry.jobUrl) return { id: entry.jobId, urls: { self: entry.jobUrl }, outputNode: entry.outputNode };
  const found = await find(submissionId);
  if (!found) throw new Error("Submission outcome is still unknown. Check again later; do not resubmit.");
  const safe = jobPath(entry, found);
  if (!await journal.accept(userId, submissionId, safe.id, safe.path)) throw new Error("Could not record the recovered job. Check the journal before retrying.");
  return { id: safe.id, urls: { self: safe.path }, outputNode: entry.outputNode };
}
