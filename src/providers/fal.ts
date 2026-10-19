import { fetchPricing, formatRate } from "../catalog/pricing";
import {
  ProviderError,
  type Capability,
  type GenerationRequest,
  type GenerationResult,
  type Provider,
  type Quote,
} from "./types";

const QUEUE = "https://queue.fal.run";

/**
 * Default endpoint per capability. These are starting points, not a catalog:
 * the request can name any of fal's ~1,500 endpoints through `passthrough`,
 * and pricing resolves for whatever it names. That is the difference between
 * this and a hand-maintained model list that rots on every provider change.
 */
const DEFAULTS: Record<Capability, string | null> = {
  "text-to-image": "fal-ai/nano-banana-2",
  "image-edit": "fal-ai/nano-banana-2",
  "image-to-video": "fal-ai/kling-video/v3/pro/image-to-video",
  "text-to-video": "fal-ai/kling-video/v3/pro/text-to-video",
  "identity-training": "fal-ai/flux-lora-fast-training",
};

export type FalOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  /** Override the endpoint chosen for a capability. */
  endpoints?: Partial<Record<Capability, string>>;
  /** Poll cadence and ceiling for queued work. */
  pollMs?: number;
  timeoutMs?: number;
};

export function createFalProvider(options: FalOptions): Provider {
  const doFetch = options.fetch ?? fetch;
  const pollMs = options.pollMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

  const endpointFor = (capability: Capability): string => {
    const chosen = options.endpoints?.[capability] ?? DEFAULTS[capability];
    if (!chosen) throw new ProviderError("fal", `No endpoint for ${capability}`);
    return chosen;
  };

  const headers = (json: boolean): HeadersInit => ({
    Authorization: `Key ${options.apiKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  });

  async function readOrThrow(response: Response, context: string): Promise<unknown> {
    const text = await response.text();
    const body: unknown = text ? safeJson(text) : null;
    if (!response.ok) {
      throw new ProviderError("fal", `${context}: ${detail(body) ?? response.statusText}`, response.status);
    }
    return body;
  }

  return {
    name: "fal",

    supports(capability) {
      return (options.endpoints?.[capability] ?? DEFAULTS[capability]) !== null;
    },

    async quote(request): Promise<Quote> {
      const endpoint = endpointFor(request.capability);
      const pricing = await fetchPricing(endpoint, doFetch);
      const count = request.count ?? 1;
      // Only multiply by count when the rate is genuinely per-output. A
      // per-second or per-megapixel rate cannot be totalled without knowing
      // duration or resolution, so it stays a unit rate and says so.
      const perOutput = pricing.unit === "image" || pricing.unit === "video";
      return {
        provider: "fal",
        endpoint,
        usd: pricing.usdPerUnit === null ? null : pricing.usdPerUnit * (perOutput ? count : 1),
        basis: perOutput
          ? `${formatRate(pricing)} x ${count}`
          : formatRate(pricing),
      };
    },

    async run(request): Promise<GenerationResult> {
      const endpoint = endpointFor(request.capability);
      const body = toFalInput(request);

      const queued = await readOrThrow(
        await doFetch(`${QUEUE}/${endpoint}`, {
          method: "POST",
          headers: headers(true),
          body: JSON.stringify(body),
        }),
        "submit",
      );

      const statusUrl = stringAt(queued, "status_url");
      const responseUrl = stringAt(queued, "response_url");
      if (!statusUrl || !responseUrl) {
        throw new ProviderError("fal", "Queue response missing status_url/response_url");
      }

      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const status = await readOrThrow(
          await doFetch(statusUrl, { headers: headers(false) }),
          "status",
        );
        const state = stringAt(status, "status");
        if (state === "COMPLETED") break;
        if (state && !["IN_QUEUE", "IN_PROGRESS"].includes(state)) {
          throw new ProviderError("fal", `Run ended as ${state}`);
        }
        if (Date.now() > deadline) throw new ProviderError("fal", "Timed out waiting for result");
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }

      const result = await readOrThrow(
        await doFetch(responseUrl, { headers: headers(false) }),
        "result",
      );

      const quoted = await this.quote(request);
      return {
        provider: "fal",
        endpoint,
        assets: collectAssets(result),
        usd: quoted.usd,
        raw: result,
      };
    },
  };
}

function toFalInput(request: GenerationRequest): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt: request.prompt };
  if (request.count && request.count > 1) input.num_images = request.count;
  if (request.aspectRatio) input.aspect_ratio = request.aspectRatio;
  if (request.images?.length) {
    // fal is not uniform here: editors take image_urls, animators take image_url.
    input.image_urls = request.images;
    input.image_url = request.images[0];
  }
  return { ...input, ...(request.passthrough ?? {}) };
}

/** fal returns images/video under several shapes depending on the model. */
function collectAssets(result: unknown): GenerationResult["assets"] {
  const assets: GenerationResult["assets"] = [];
  const record = asRecord(result);

  for (const item of asArray(record.images)) {
    const url = stringAt(item, "url");
    if (url) assets.push({ url, kind: "image" });
  }
  const single = stringAt(record.image, "url");
  if (single) assets.push({ url: single, kind: "image" });

  const video = stringAt(record.video, "url");
  if (video) assets.push({ url: video, kind: "video" });

  return assets;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function stringAt(value: unknown, key: string): string | undefined {
  const field = asRecord(value)[key];
  return typeof field === "string" && field ? field : undefined;
}

function detail(body: unknown): string | undefined {
  const record = asRecord(body);
  return stringAt(record, "detail") ?? stringAt(record, "message") ?? undefined;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
