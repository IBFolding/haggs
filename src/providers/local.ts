import { ProviderError } from "./types";
import type { Kept, Workflow } from "./cloud";

/**
 * Your own ComfyUI: the same transport as Comfy Cloud, pointed at a machine
 * you control (an RTX 5090 on 127.0.0.1:8188, or one on your network).
 * Open-weights workflows run there for free. No key is ever sent; only
 * loopback and private-network addresses are accepted, so a typo can't
 * point haggs at the open internet.
 */

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./];

/** The origin of a ComfyUI on this machine or your network, or an error saying what isn't one. */
export function localBase(input: string): string {
  const text = input.trim();
  if (!text) throw new Error("Enter the address of your ComfyUI, like 127.0.0.1:8188.");
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `http://${text}`);
  } catch {
    throw new Error("That isn't an address. Use something like 127.0.0.1:8188.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("The ComfyUI address must start with http:// or https://.");
  if (url.username || url.password) throw new Error("Leave the username and password out of the ComfyUI address.");
  if (!(host === "localhost" || host === "::1" || host.endsWith(".local") || PRIVATE.some((p) => p.test(host)))) throw new Error("Only ComfyUI on this computer or your own network can be used here. Comfy Cloud has its own key.");
  return `${url.protocol}//${url.host}`;
}

export type LocalOptions = { base: string; fetch?: typeof fetch; pollMs?: number; timeoutMs?: number; keep: (bytes: Uint8Array, extension: Kept) => Promise<string> };

const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The same three calls as the Cloud runner, so every tool in the app can use either. */
export function createLocalRunner({ base, fetch: fetchImpl = fetch, pollMs = 1500, timeoutMs = 60 * 60_000, keep }: LocalOptions) {
  const fail = (message: string, status?: number) => new ProviderError("comfy-local", message, status);
  const get = async (path: string, init?: RequestInit) => {
    try {
      return await fetchImpl(`${base}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(120_000) });
    } catch {
      throw fail(`Your ComfyUI at ${base} couldn't be reached. Is it running?`);
    }
  };

  async function uploadBytes(bytes: Uint8Array, mime: string): Promise<string> {
    const ext = EXTENSION[mime];
    if (!ext) throw fail("That file type can't go to ComfyUI.");
    const form = new FormData();
    form.append("image", new Blob([Buffer.from(bytes)], { type: mime }), `haggs_${Date.now()}.${ext}`);
    form.append("type", "input");
    form.append("overwrite", "true");
    const response = await get("/upload/image", { method: "POST", body: form });
    if (!response.ok) throw fail("Your ComfyUI didn't accept a file.");
    const name = ((await response.json()) as { name?: unknown }).name;
    if (typeof name !== "string" || !/^[-\w. ]{1,200}$/.test(name)) throw fail("Your ComfyUI returned an unexpected file name.");
    return name;
  }

  async function run(workflow: Workflow, outputNode = "20"): Promise<{ url: string; kind: "image" | "video" | "audio"; jobId: string }> {
    const queued = await get("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow }) });
    const body = (await queued.json().catch(() => ({}))) as { prompt_id?: string; error?: { message?: string }; node_errors?: Record<string, { errors?: { message?: string }[] }> };
    if (!queued.ok || !body.prompt_id) {
      const first = Object.values(body.node_errors ?? {}).flatMap((n) => n.errors ?? []).find((e) => e.message)?.message;
      throw fail(`Your ComfyUI rejected the workflow: ${first ?? body.error?.message ?? `it answered ${queued.status}`}.`, queued.status);
    }
    const id = body.prompt_id;
    const started = Date.now();
    for (;;) {
      const history = (await (await get(`/history/${encodeURIComponent(id)}`)).json().catch(() => ({}))) as Record<string, { status?: { completed?: boolean; status_str?: string; messages?: unknown[][] }; outputs?: Record<string, Record<string, unknown[]>> }>;
      const job = history[id];
      if (job?.status?.status_str === "error") {
        const message = (job.status.messages ?? []).find((m) => m[0] === "execution_error")?.[1] as { exception_message?: string } | undefined;
        throw fail(`The run failed on your ComfyUI${message?.exception_message ? ` (${message.exception_message.slice(0, 160)})` : ""}.`);
      }
      if (job?.status?.completed) {
        const out = job.outputs?.[outputNode] ?? {};
        const files = [...(out.video ?? []), ...(out.videos ?? []), ...(out.gifs ?? []), ...(out.images ?? []), ...(out.audio ?? [])] as { filename?: string; subfolder?: string; type?: string }[];
        const file = files.find((f) => typeof f.filename === "string" && /\.(mp4|webm|png|jpe?g|webp|mp3|flac|wav)$/i.test(f.filename) && f.type === "output");
        if (!file) throw fail("The run finished without a result.");
        const query = new URLSearchParams({ filename: file.filename!, subfolder: file.subfolder ?? "", type: "output" });
        const got = await get(`/view?${query}`);
        if (!got.ok) throw fail("The result couldn't be read from your ComfyUI.");
        const ext = file.filename!.split(".").pop()!.toLowerCase().replace("jpeg", "jpg") as Kept;
        const url = await keep(new Uint8Array(await got.arrayBuffer()), ext);
        return { url, kind: ext === "mp4" || ext === "webm" ? "video" : ext === "mp3" || ext === "flac" || ext === "wav" ? "audio" : "image", jobId: id };
      }
      if (Date.now() - started > timeoutMs) throw fail(`Still running after ${Math.round(timeoutMs / 60000)} minutes. It may finish on your ComfyUI (${id}).`);
      await sleep(pollMs);
    }
  }

  async function upload(source: string): Promise<string> {
    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(source);
    if (!match) throw fail("A file must be a data URI.");
    return uploadBytes(Uint8Array.from(Buffer.from(match[2]!, "base64")), match[1]!);
  }

  return { upload, uploadBytes, run };
}
