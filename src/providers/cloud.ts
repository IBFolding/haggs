import { ProviderError, type GenerationRequest, type GenerationResult, type Provider, type Quote } from "./types";

/**
 * Comfy Cloud: runs a small ComfyUI workflow made of Comfy's API nodes
 * (MiniMax, Runway, FLUX, ElevenLabs…) on cloud.comfy.org.
 *
 * This is the route Open Haggsfield v1 used to make the Waylight takes, and
 * it works on accounts where Comfy Router is not yet switched on. The Comfy
 * key travels two ways: as the transport header, and — for the API nodes —
 * out of band in `extra_data`, never inside the workflow graph. The finished
 * video is downloaded once and kept, because Comfy's output links expire.
 */

const ORIGIN = "https://cloud.comfy.org";

type Node = { class_type: string; inputs: Record<string, unknown> };
export type Workflow = Record<string, Node>;

export type MinimaxOptions = {
  prompt: string;
  seconds: number;
  resolution?: "768P" | "2K";
  ratio?: string;
  seed: number;
  /** An uploaded Comfy image name; the video starts from it. */
  firstFrame?: string;
  /** Uploaded Comfy image names: cast and place references, up to nine. */
  references?: string[];
};

const IMAGE_NAME = /^[-\w.]{1,180}\.(png|jpe?g|webp)$/i;

/** MiniMax H3 as a Comfy workflow: text, first frame, or references. Verified against Cloud's node catalog. */
export function minimaxWorkflow({ prompt, seconds, resolution = "768P", ratio = "16:9", seed, firstFrame, references = [] }: MinimaxOptions): Workflow {
  if (prompt.trim().length < 4 || prompt.length > 4000) throw new Error("Describe the take in 4–4000 characters.");
  if (!Number.isInteger(seconds) || seconds < 4 || seconds > 15) throw new Error("MiniMax H3 takes 4–15 whole seconds.");
  if (references.length > 9) throw new Error("MiniMax H3 takes up to nine reference pictures.");
  if (firstFrame && references.length) throw new Error("Use a first frame or reference pictures, not both.");
  for (const name of [firstFrame, ...references].filter(Boolean)) if (!IMAGE_NAME.test(name!)) throw new Error("A picture didn't upload properly.");

  const model: Record<string, unknown> = { model: "MiniMax H3", "model.prompt": prompt.trim(), "model.resolution": resolution, "model.ratio": ratio, "model.duration": seconds, seed, watermark: false };
  const workflow: Workflow = {
    "1": { class_type: "MinimaxHailuo03TextToVideoNode", inputs: model },
    "20": { class_type: "SaveVideo", inputs: { video: ["1", 0], filename_prefix: "haggs/minimax", format: "mp4", "format.codec": "h264" } },
  };
  if (firstFrame) {
    workflow["1"] = { class_type: "MinimaxHailuo03FirstLastFrameNode", inputs: { ...model, first_frame: ["2", 0] } };
    delete workflow["1"].inputs["model.ratio"];
    workflow["2"] = { class_type: "LoadImage", inputs: { image: firstFrame } };
  } else if (references.length) {
    workflow["1"] = { class_type: "MinimaxHailuo03ReferenceNode", inputs: { ...model, "model.ratio": "adaptive" } };
    if (ratio !== "adaptive") workflow["1"].inputs["model.ratio"] = ratio;
    references.forEach((image, i) => {
      const id = String(i + 2);
      workflow[id] = { class_type: "LoadImage", inputs: { image } };
      workflow["1"]!.inputs[`model.reference_images.image_${i + 1}`] = [id, 0];
    });
  }
  return workflow;
}

export { cloudEstimate } from "./cloud-price";
import { cloudEstimate } from "./cloud-price";

export type Kept = "mp4" | "webm" | "png" | "jpg" | "webp";

export type CloudOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  pollMs?: number;
  timeoutMs?: number;
  /** Keeps the finished file and returns the URL the app will play it from. */
  keep: (bytes: Uint8Array, extension: Kept) => Promise<string>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeDataUri(uri: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:((?:image\/(?:png|jpeg|webp))|(?:video\/(?:mp4|webm|quicktime)));base64,(.+)$/.exec(uri);
  if (!match) throw new Error("A picture or video isn't in a format Comfy can take.");
  return { bytes: Uint8Array.from(Buffer.from(match[2]!, "base64")), mime: match[1]! };
}

const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const UPLOADED = /^[-\w.]{1,180}\.(png|jpe?g|webp|mp4|webm|mov)$/i;

/** The Comfy Cloud transport: upload inputs, run a workflow, keep what it saves. Every edit tool uses this. */
export function createCloudRunner({ apiKey, fetch: fetchImpl = fetch, pollMs = 5000, timeoutMs = 15 * 60_000, keep }: CloudOptions) {
  const fail = (message: string, status?: number) => new ProviderError("comfy-cloud", message, status);

  async function call(path: string, body?: unknown) {
    let response: Response;
    try {
      response = await fetchImpl(`${ORIGIN}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "X-API-Key": apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw fail(body ? "Comfy Cloud didn't confirm the job. Check your Comfy jobs before trying again." : "Comfy Cloud couldn't be reached.");
    }
    if (response.status === 401 || response.status === 403) throw fail("Comfy Cloud refused the key.", response.status);
    if (!response.ok) throw fail(`Comfy Cloud answered ${response.status}.`, response.status);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /** Uploads bytes and returns the name a LoadImage or LoadVideo node uses. */
  async function uploadBytes(bytes: Uint8Array, mime: string): Promise<string> {
    const ext = EXTENSION[mime];
    if (!ext) throw fail("That file type can't go to Comfy.");
    const limit = mime.startsWith("video/") ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (bytes.length > limit) throw fail(mime.startsWith("video/") ? "That take is over 100 MB." : "Each picture must be under 10 MB.");
    const form = new FormData();
    form.append("image", new Blob([Buffer.from(bytes)], { type: mime }), `haggs.${ext}`);
    form.append("type", "input");
    const response = await fetchImpl(`${ORIGIN}/api/upload/image`, { method: "POST", headers: { "X-API-Key": apiKey }, body: form, redirect: "error", signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw fail("Comfy Cloud didn't accept a file. Nothing was submitted.");
    const name = ((await response.json()) as { name?: unknown }).name;
    if (typeof name !== "string" || !UPLOADED.test(name)) throw fail("Comfy Cloud returned an unexpected file name.");
    return name;
  }

  /** Uploads a data URI or an https file. */
  async function upload(source: string): Promise<string> {
    if (source.startsWith("data:")) {
      const { bytes, mime } = decodeDataUri(source);
      return uploadBytes(bytes, mime);
    }
    if (!source.startsWith("https://")) throw fail("A file must be a data URI or an https link.");
    const got = await fetchImpl(source, { redirect: "error", signal: AbortSignal.timeout(60_000) });
    const mime = (got.headers.get("content-type") ?? "").split(";")[0]!;
    if (!got.ok || !EXTENSION[mime]) throw fail("A file couldn't be fetched.");
    return uploadBytes(new Uint8Array(await got.arrayBuffer()), mime);
  }

  async function download(file: { filename: string; subfolder?: string }): Promise<Uint8Array> {
    const query = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? "", type: "output" });
    let response = await fetchImpl(`${ORIGIN}/api/view?${query}`, { headers: { "X-API-Key": apiKey }, redirect: "manual", signal: AbortSignal.timeout(60_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = new URL(response.headers.get("location") ?? "about:blank");
      // The signed storage link already authorises the file; the key never follows it.
      if (target.protocol !== "https:" || target.hostname !== "storage.googleapis.com" || target.username || target.password) throw fail("Comfy Cloud sent an untrusted redirect for the result.");
      await response.body?.cancel();
      response = await fetchImpl(target.href, { redirect: "error", signal: AbortSignal.timeout(120_000) });
    }
    if (!response.ok) throw fail("The result couldn't be downloaded. Download again; don't generate again.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 100 * 1024 * 1024) throw fail("The result is over 100 MB.");
    return bytes;
  }

  /** Submits a workflow, waits, and keeps the file the output node saved. */
  async function run(workflow: Workflow, outputNode = "20"): Promise<{ url: string; kind: "image" | "video"; jobId: string }> {
    const submitted = await call("/api/prompt", { prompt: workflow, extra_data: { api_key_comfy_org: apiKey } });
    const id = submitted.prompt_id;
    if (typeof id !== "string" || !id || Object.keys((submitted.node_errors as object) ?? {}).length) throw fail("Comfy Cloud didn't accept the workflow. Nothing was generated.");
    const started = Date.now();
    for (;;) {
      const job = await call(`/api/jobs/${encodeURIComponent(id)}`);
      if (job.status === "completed") {
        const output = ((job.outputs as Record<string, Record<string, unknown>>) ?? {})[outputNode] ?? {};
        // Cloud files a finished video under "images" (with animated: true); older outputs used "video"/"videos".
        const files = [...((output.video as unknown[]) ?? []), ...((output.videos as unknown[]) ?? []), ...((output.gifs as unknown[]) ?? []), ...((output.images as unknown[]) ?? [])] as { filename?: string; subfolder?: string; type?: string }[];
        const file = files.find((f) => typeof f.filename === "string" && /\.(mp4|webm|png|jpe?g|webp)$/i.test(f.filename) && f.type === "output");
        if (!file) throw fail("The job finished without a result.");
        const bytes = await download({ filename: file.filename!, ...(file.subfolder ? { subfolder: file.subfolder } : {}) });
        const ext = file.filename!.split(".").pop()!.toLowerCase().replace("jpeg", "jpg") as Kept;
        const url = await keep(bytes, ext);
        return { url, kind: ext === "mp4" || ext === "webm" ? "video" : "image", jobId: id };
      }
      if (job.status === "failed" || job.status === "cancelled") {
        const reason = (job.execution_error as { exception_message?: string } | undefined)?.exception_message ?? "";
        throw fail(/unauthori|login/i.test(reason) ? "The job failed: Comfy's API nodes didn't accept the key." : `The job failed and nothing was made${reason ? ` (${reason.slice(0, 160)})` : ""}. Check your Comfy usage before trying again.`);
      }
      if (Date.now() - started > timeoutMs) throw fail(`Still running after ${Math.round(timeoutMs / 60000)} minutes. It may still finish; check your Comfy jobs (${id}).`);
      await sleep(pollMs);
    }
  }

  return { upload, uploadBytes, run };
}

export function createCloudProvider(options: CloudOptions): Provider {
  const cloud = createCloudRunner(options);

  async function quote(request: GenerationRequest): Promise<Quote> {
    const seconds = Number(request.passthrough?.duration ?? 5);
    const resolution = String(request.passthrough?.resolution ?? "768P");
    const references = request.firstFrame === false ? (request.images?.length ?? 0) : 0;
    return { provider: "comfy-cloud", endpoint: "MiniMax H3", usd: cloudEstimate({ seconds, resolution, references }), basis: "Comfy's published MiniMax H3 rate per second; an estimate, billed to your Comfy credits." };
  }

  return {
    name: "comfy-cloud",
    supports: (capability) => capability === "text-to-video" || capability === "image-to-video",
    quote,
    async run(request) {
      const seconds = Math.round(Number(request.passthrough?.duration ?? 5));
      const resolution = request.passthrough?.resolution === "2K" ? "2K" : "768P";
      const ratio = String(request.passthrough?.aspect_ratio ?? request.passthrough?.ratio ?? "16:9");
      // A first frame uses only the first picture; references can use nine.
      const asFirst = Boolean(request.images?.length) && request.firstFrame !== false;
      const uploaded = [];
      for (const image of (request.images ?? []).slice(0, asFirst ? 1 : 9)) uploaded.push(await cloud.upload(image));
      const workflow = minimaxWorkflow({
        prompt: request.prompt,
        seconds: Math.min(15, Math.max(4, seconds)),
        resolution,
        ratio,
        seed: Math.floor(Math.random() * 2_000_000_000),
        ...(asFirst ? { firstFrame: uploaded[0]! } : uploaded.length ? { references: uploaded.slice(0, 9) } : {}),
      });
      const result = await cloud.run(workflow);
      const estimate = await quote(request);
      return { provider: "comfy-cloud", endpoint: "MiniMax H3", assets: [{ url: result.url, kind: result.kind }], usd: estimate.usd, raw: { jobId: result.jobId } } satisfies GenerationResult;
    },
  };
}
