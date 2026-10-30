import { randomUUID } from "node:crypto";
import type { Kept, Workflow } from "./cloud";

/** A v2 asset, resolved by Comfy before the workflow is executed. */
export type ComfyAsset = { __type: "core/ASSET"; info: { id: string } };
type Output = { node_id?: string; name?: string; content_type?: string; url?: string };
export type ManagedJob = { id?: string; status?: string; urls?: { self?: string }; outputs?: Output[]; metadata?: Record<string, string> };
type Settings = {
  base: string;
  apiKey?: string;
  /** Only for an isolated proxy on this machine; managed submissions are disabled. */
  localTest?: boolean;
  fetch?: typeof fetch;
  keep: (bytes: Uint8Array, extension: Kept) => Promise<string>;
  pollMs?: number;
  timeoutMs?: number;
  /** Server-configured exact HTTPS storage hosts; no wildcard or client input. */
  outputHosts?: readonly string[];
  maxOutputBytes?: number;
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
  const local = process.env.NODE_ENV !== "production" && settings.localTest === true && base.protocol === "http:" && (base.hostname === "127.0.0.1" || base.hostname === "localhost" || base.hostname === "[::1]");
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
  async function outputBytes(path: string, expectedType: string): Promise<Uint8Array> {
    let response = await fetcher(sameOrigin(path), { headers: headers(), redirect: "manual", signal: AbortSignal.timeout(120_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Comfy output redirect is missing its destination.");
      let signed: URL;
      try { signed = new URL(location); } catch { throw new Error("Comfy output redirect is invalid."); }
      if (signed.protocol !== "https:" || signed.username || signed.password || signed.port || !settings.outputHosts?.includes(signed.hostname)) throw new Error("Comfy output redirect is not trusted.");
      // Signed URLs carry their own authorization. Never forward the API key.
      response = await fetcher(signed.href, { redirect: "error", signal: AbortSignal.timeout(120_000) });
    }
    if (!response.ok || !response.body) throw new Error("Comfy output could not be downloaded.");
    // Object storage commonly uses octet-stream, but an explicit conflicting
    // type (for example an HTML error page) must not be saved as media.
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (contentType && contentType !== "application/octet-stream" && contentType !== expectedType) throw new Error("Comfy output has an unexpected content type.");
    const max = settings.maxOutputBytes ?? 200_000_000;
    if (!Number.isSafeInteger(max) || max <= 0 || Number(response.headers.get("content-length") ?? 0) > max) throw new Error("Comfy output exceeds the size limit.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) { await reader.cancel(); throw new Error("Comfy output exceeds the size limit."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (!size) throw new Error("Comfy output is empty.");
    return new Uint8Array(Buffer.concat(chunks, size));
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
  async function submit(workflow: Workflow, submissionId: string = randomUUID()): Promise<ManagedJob> {
    assertFreeTest();
    if (!ID.test(submissionId)) throw new Error("Invalid submission ID.");
    let response: Response;
    try {
      response = await request("/api/v2/jobs", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": submissionId }, body: JSON.stringify(local ? { workflow } : { workflow, metadata: { haggs_ref: submissionId } }) });
    } catch {
      throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`);
    }
    if (response.status >= 500 || response.status === 422) throw new Error(`Submission may need investigation (reference ${submissionId}, status ${response.status}). Check the job list before retrying.`);
    if (!response.ok) throw new Error(`Comfy rejected the submission (${response.status}); no automatic retry was made.`);
    let job: ManagedJob;
    try { job = await response.json() as ManagedJob; }
    catch { throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`); }
    if (!job.id || !ID.test(job.id) || !job.urls?.self) throw new Error(`Submission outcome unknown (reference ${submissionId}). Check the job list before retrying.`);
    sameOrigin(job.urls.self);
    return job;
  }
  async function result(job: ManagedJob, outputNode: string) {
    if (!job.id || !job.urls?.self) throw new Error("Missing job reference.");
    const started = Date.now();
    while (Date.now() - started < (settings.timeoutMs ?? 60 * 60_000)) {
      const response = await request(job.urls.self);
      if (!response.ok) throw new Error(`Could not check Comfy job ${job.id} (${response.status}); do not resubmit.`);
      const current = await response.json() as ManagedJob;
      if (current.id !== job.id) throw new Error("Comfy returned the wrong job.");
      if (current.status === "succeeded") {
        const out = current.outputs?.find(x => x.node_id === outputNode && x.url && x.content_type && Object.hasOwn(EXT, x.content_type));
        if (!out?.url || !out.content_type) throw new Error(`Comfy job ${job.id} finished without a supported output.`);
        const extension = EXT[out.content_type]!;
        let url: string;
        try { url = await settings.keep(await outputBytes(out.url, out.content_type), extension); }
        catch { throw new Error(`Comfy job ${job.id} succeeded, but its output could not be saved. Recover it from the job before retrying.`); }
        return { url, kind: out.content_type.startsWith("video/") ? "video" as const : out.content_type.startsWith("audio/") ? "audio" as const : "image" as const, jobId: job.id };
      }
      if (current.status === "failed" || current.status === "canceled" || current.status === "expired") throw new Error(`Comfy job ${job.id} ${current.status}.`);
      if (!["queued", "running", "canceling"].includes(current.status ?? "")) throw new Error(`Comfy job ${job.id} returned an unknown status.`);
      await new Promise(r => setTimeout(r, settings.pollMs ?? 1500));
    }
    throw new Error(`Comfy job ${job.id} is still running or queued; check it before retrying.`);
  }
  /** Inspect names and types only; never expose provider or signed URLs to clients. */
  async function artifactIndex(job:ManagedJob) {
    if(!job.id||!ID.test(job.id)||!job.urls?.self)throw new Error('Invalid managed job reference.');
    const url=new URL(sameOrigin(job.urls.self));if(url.pathname!==`/api/v2/jobs/${job.id}`||url.search||url.hash)throw new Error('Invalid managed job reference.');
    const response=await request(url.href);if(!response.ok)throw new Error('Could not inspect managed outputs.');
    const current=await response.json() as ManagedJob;if(current.id!==job.id||current.status!=='succeeded'||!Array.isArray(current.outputs)||current.outputs.length>32)throw new Error('Managed outputs are unavailable.');
    return current.outputs.filter(o=>o.node_id&&ID.test(o.node_id)&&o.name&&/^[-a-zA-Z0-9_.]{1,128}$/.test(o.name)&&o.content_type&&['video/mp4','image/png','application/json'].includes(o.content_type)&&o.url).map(o=>({node:o.node_id!,name:o.name!,mime:o.content_type!}));
  }
  /** Retrieve an exact server-defined artifact set; callers must persist it safely. */
  async function artifacts(job:ManagedJob, expected:readonly {node:string;name:string;mime:string}[]) {
    if (!job.id || !ID.test(job.id) || !job.urls?.self || expected.length<1 || expected.length>5) throw new Error('Invalid artifact request.');
    const url=new URL(sameOrigin(job.urls.self));
    if(url.pathname!==`/api/v2/jobs/${job.id}` || url.search || url.hash) throw new Error('Invalid managed job reference.');
    if(expected.some(e=>!ID.test(e.node)||!/^[-a-zA-Z0-9_.]{1,128}$/.test(e.name)||!['video/mp4','image/png','application/json'].includes(e.mime)) || new Set(expected.map(e=>`${e.node}/${e.name}`)).size!==expected.length)throw new Error('Invalid artifact request.');
    const response=await request(url.href);if(!response.ok)throw new Error('Could not inspect managed outputs.');
    const current=await response.json() as ManagedJob;if(current.id!==job.id || current.status!=='succeeded' || !Array.isArray(current.outputs))throw new Error('Managed output is not ready.');
    const saved:{node:string;name:string;mime:string;bytes:Uint8Array}[]=[];let total=0;
    for(const want of expected){const matches=current.outputs.filter(o=>o.node_id===want.node&&o.name===want.name&&o.content_type===want.mime&&o.url);
      if(matches.length!==1 || !matches[0]?.url)throw new Error('Managed output set is incomplete or ambiguous.');
      const bytes=await outputBytes(matches[0].url,want.mime);total+=bytes.byteLength;if(total>200_000_000)throw new Error('Managed output set exceeds the size limit.');
      saved.push({...want,bytes});
    }
    return saved;
  }
  /** Read status only. Never expose provider links, metadata or signed asset URLs. */
  async function status(job: ManagedJob, outputNode: string) {
    if (!job.id || !ID.test(job.id) || !job.urls?.self) throw new Error('Invalid managed job reference.');
    const url = new URL(sameOrigin(job.urls.self));
    if (url.pathname !== `/api/v2/jobs/${job.id}` || url.search || url.hash) throw new Error('Invalid managed job reference.');
    const response = await request(url.href);
    if (!response.ok) throw new Error('Managed job status is unavailable.');
    const current = await response.json() as ManagedJob;
    if (current.id !== job.id || !['queued','running','canceling','succeeded','failed','canceled','expired'].includes(current.status ?? '')) throw new Error('Invalid managed job status.');
    return {status:current.status!,providerOutputAvailable:current.status === 'succeeded' && Boolean(current.outputs?.some(o => o.node_id === outputNode && o.url && o.content_type && Object.hasOwn(EXT,o.content_type)))};
  }
  /** On a managed deployment, locate an uncertain submission by its durable label. */
  async function findByReference(reference: string): Promise<ManagedJob | null> {
    if (!managed || !ID.test(reference)) throw new Error("Managed job lookup is unavailable.");
    const found: ManagedJob[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ "metadata[haggs_ref]": reference, limit: "100" });
      if (cursor) query.set("cursor", cursor);
      const response = await request(`/api/v2/jobs?${query}`);
      if (!response.ok) throw new Error("Could not inspect managed jobs. Do not resubmit.");
      const body = await response.json() as { jobs?: ManagedJob[]; next_cursor?: string | null };
      if (!Array.isArray(body.jobs)) throw new Error("Invalid managed job listing. Do not resubmit.");
      found.push(...body.jobs.filter(job => job.metadata?.haggs_ref === reference));
      if (found.length > 1) throw new Error("Multiple jobs match this reference. Manual reconciliation is required.");
      if (!body.next_cursor) {
        const match = found[0];
        if (!match) return null;
        if (!match.id || !ID.test(match.id)) throw new Error("Invalid managed job ID. Do not resubmit.");
        // List items do not contain follow-up links; the documented job endpoint does.
        const detailResponse = await request(`/api/v2/jobs/${encodeURIComponent(match.id)}`);
        if (!detailResponse.ok) throw new Error("Could not inspect the recovered job. Do not resubmit.");
        const detail = await detailResponse.json() as ManagedJob;
        if (detail.id !== match.id || detail.metadata?.haggs_ref !== reference || !detail.urls?.self) throw new Error("Recovered job identity is invalid. Do not resubmit.");
        sameOrigin(detail.urls.self);
        return detail;
      }
      if (typeof body.next_cursor !== "string" || body.next_cursor.length > 4096 || body.next_cursor === cursor) throw new Error("Invalid job listing cursor. Do not resubmit.");
      cursor = body.next_cursor;
    }
    throw new Error("Job listing is incomplete. Do not resubmit.");
  }
  return { upload, submit, result, artifactIndex, artifacts, status, findByReference };
}
