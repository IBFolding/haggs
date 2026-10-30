import { randomUUID } from "node:crypto";
import type { Kept, Workflow } from "./cloud";

/** A v2 asset, resolved by Comfy before the workflow is executed. */
export type ComfyAsset = { __type: "core/ASSET"; info: { id: string } };
type Output = { node_id?: string; name?: string; content_type?: string; url?: string };
type Job = { id?: string; status?: string; urls?: { self?: string }; outputs?: Output[] };
type Settings = {
  base: string;
  apiKey?: string;
  /** Only for an isolated proxy on this machine; managed submissions are disabled. */
  localTest?: boolean;
  fetch?: typeof fetch;
  keep: (bytes: Uint8Array, extension: Kept) => Promise<string>;
  pollMs?: number;
  timeoutMs?: number;
};
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const EXT: Record<string, Kept> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/flac": "flac" };

/**
 * Experimental Comfy API v2 transport. It is deliberately not wired into the
 * product: managed workers have no per-job hard spend cap in this integration.
 * Only an explicitly selected loopback test proxy may submit a job.
 */
export function createComfyManaged(settings: Settings) {
  let base: URL;
  try { base = new URL(settings.base); } catch { throw new Error("Invalid Comfy API address."); }
  const local = settings.localTest === true && base.protocol === "http:" && (base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "[::1]");
  const managed = base.protocol === "https:" && /^[a-z0-9-]+\.run\.comfy\.app$/.test(base.hostname);
  if ((!local && !managed) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("Unsupported Comfy API address.");
  if (managed && !settings.apiKey?.trim()) throw new Error("A Comfy API key is required.");
  const fetcher = settings.fetch ?? fetch;
  const origin = base.origin;
  const headers = () => settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {};
  const sameOrigin = (path: string) => {
    const url = new URL(path, origin);
    if (url.origin !== origin || url.username || url.password) throw new Error("Comfy returned an unsafe URL.");
    return url.href;
  };
  const assertFreeTest = () => { if (!local) throw new Error("Managed runs are disabled until a server-enforced spending limit and recovery are available. No request was sent."); };
  async function request(path: string, init: RequestInit = {}) {
    return fetcher(sameOrigin(path), { ...init, headers: { ...headers(), ...init.headers }, redirect: "error", signal: AbortSignal.timeout(120_000) });
  }
  async function upload(bytes: Uint8Array, mime: string): Promise<ComfyAsset> {
    assertFreeTest();
    const extension = EXT[mime];
    if (!extension || !bytes.byteLength || bytes.byteLength > 100_000_000) throw new Error("Unsupported or oversized input.");
    const form = new FormData();
    const filePath = `haggs-${randomUUID()}.${extension}`;
    form.append("file", new Blob([Buffer.from(bytes)], { type: mime }), filePath);
    form.append("content_type", mime);
    form.append("file_path", filePath);
    const response = await request("/api/v2/assets", { method: "POST", body: form });
    if (!response.ok) throw new Error(`Comfy input upload failed (${response.status}).`);
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== "string" || !ID.test(result.id)) throw new Error("Comfy returned an invalid asset ID.");
    return { __type: "core/ASSET", info: { id: result.id } };
  }
  async function submit(workflow: Workflow, submissionId: string = randomUUID()): Promise<Job> {
    assertFreeTest();
    if (!ID.test(submissionId)) throw new Error("Invalid submission ID.");
    let response: Response;
    try {
      response = await request("/api/v2/jobs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submissionId }, body: JSON.stringify({ workflow }) });
    } catch {
      throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`);
    }
    if (response.status >= 500 || response.status === 422) throw new Error(`Submission may need investigation (reference ${submissionId}, status ${response.status}). Check the job list before retrying.`);
    if (!response.ok) throw new Error(`Comfy rejected the submission (${response.status}); no automatic retry was made.`);
    let job: Job;
    try { job = await response.json() as Job; }
    catch { throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`); }
    if (!job.id || !ID.test(job.id) || !job.urls?.self) throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`);
    sameOrigin(job.urls.self);
    return job;
  }
  async function result(job: Job, outputNode: string) {
    if (!job.id || !job.urls?.self) throw new Error("Missing job reference.");
    const started = Date.now();
    while (Date.now() - started < (settings.timeoutMs ?? 60 * 60_000)) {
      const response = await request(job.urls.self);
      if (!response.ok) throw new Error(`Could not check Comfy job ${job.id} (${response.status}); do not resubmit.`);
      const current = await response.json() as Job;
      if (current.id !== job.id) throw new Error("Comfy returned the wrong job.");
      if (current.status === "succeeded") {
        const out = current.outputs?.find(x => x.node_id === outputNode && x.url && x.content_type && EXT[x.content_type]);
        if (!out?.url || !out.content_type) throw new Error(`Comfy job ${job.id} finished without a supported output.`);
        const extension = EXT[out.content_type]!;
        const file = await request(out.url);
        if (!file.ok) throw new Error(`Could not retrieve output for Comfy job ${job.id}.`);
        let url: string;
        try { url = await settings.keep(new Uint8Array(await file.arrayBuffer()), extension); }
        catch { throw new Error(`Comfy job ${job.id} succeeded, but its output could not be saved. Recover it from the job before retrying.`); }
        return { url, kind: out.content_type.startsWith("video/") ? "video" as const : out.content_type.startsWith("audio/") ? "audio" as const : "image" as const, jobId: job.id };
      }
      if (current.status === "failed" || current.status === "canceled" || current.status === "expired") throw new Error(`Comfy job ${job.id} ${current.status}.`);
      if (!["queued", "running", "canceling"].includes(current.status ?? "")) throw new Error(`Comfy job ${job.id} returned an unknown status.`);
      await new Promise(r => setTimeout(r, settings.pollMs ?? 1500));
    }
    throw new Error(`Comfy job ${job.id} is still running or queued; check it before retrying.`);
  }
  return { upload, submit, result };
}
