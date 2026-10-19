import {
  ProviderError,
  type Capability,
  type GenerationRequest,
  type GenerationResult,
  type Provider,
  type Quote,
} from "./types";

/**
 * Comfy Router: one API for hosted image and video models.
 *
 * It fits this app's seam better than anything else available, for one reason
 * that is not obvious until you read the reference: Router has a pre-flight
 * estimate route. Everywhere else, "the price on the button before you press
 * it" is something we assemble by scraping a published price page and hoping
 * it still parses. Here the platform answers the question directly, and the
 * finished response reports what was actually charged.
 *
 * Billing is pay per use against your own workspace credits — no subscription,
 * which is the same bargain this app already makes with its users.
 */

const BASE = "https://api.comfy.org/v2/models";

/**
 * Default model per capability. Starting points, not a catalog: Router carries
 * 200+ models and any of them can be named per request.
 */
const DEFAULTS: Record<Capability, string | null> = {
  "text-to-image": "bfl/flux-3-image",
  "image-edit": "bfl/flux-kontext-pro",
  "text-to-video": "minimax/minimax-h3",
  "image-to-video": "minimax/minimax-h3",
  "identity-training": null,
};

export type ComfyOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  endpoints?: Partial<Record<Capability, string>>;
  pollMs?: number;
  timeoutMs?: number;
  /**
   * Router models do not share a request shape, and the difference is not
   * cosmetic: MiniMax H3 requires a `content` array, while FLUX 3 and LTX take
   * a plain `prompt` string and refuse the other. The catalog knows which, so
   * it says so here rather than this file guessing from the model id.
   */
  bodyStyle?: BodyStyle;
};

export type BodyStyle = "content" | "prompt";

export function createComfyProvider(options: ComfyOptions): Provider {
  const doFetch = options.fetch ?? fetch;
  const pollMs = options.pollMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000;

  const modelFor = (capability: Capability): string => {
    const chosen = options.endpoints?.[capability] ?? DEFAULTS[capability];
    if (!chosen) throw new ProviderError("comfy", `No Router model for ${capability}`);
    return chosen;
  };

  const headers = (extra?: Record<string, string>): HeadersInit => ({
    "X-API-Key": options.apiKey,
    "Content-Type": "application/json",
    ...extra,
  });

  async function readOrThrow(response: Response, context: string): Promise<unknown> {
    const text = await response.text();
    const body: unknown = text ? safeJson(text) : null;
    if (!response.ok) {
      throw new ProviderError(
        "comfy",
        `${context}: ${detail(body) ?? response.statusText}`,
        response.status,
      );
    }
    return body;
  }

  return {
    name: "comfy",

    supports(capability) {
      return (options.endpoints?.[capability] ?? DEFAULTS[capability]) !== null;
    },

    async quote(request): Promise<Quote> {
      const model = modelFor(request.capability);
      const response = await doFetch(`${BASE}/${model}/estimate`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(toRouterBody(request, options.bodyStyle)),
      });

      // Not every model estimates. Saying so is the honest thing to show; a
      // guessed number on the button would be worse than an admitted unknown.
      if (!response.ok) {
        return {
          provider: "comfy",
          endpoint: model,
          usd: null,
          basis: "Router does not quote this model ahead of the run",
        };
      }

      const body = asRecord(await response.json());
      const usd = numberAt(body, "estimated_cost_usd") ?? numberAt(body, "cost_usd");
      return {
        provider: "comfy",
        endpoint: model,
        usd: usd ?? null,
        basis: usd === null ? "Router returned no estimate" : "Router pre-flight estimate",
      };
    },

    async run(request): Promise<GenerationResult> {
      const model = modelFor(request.capability);

      // Queued rather than synchronous: a video model can run for minutes, and
      // a held-open connection is the thing that breaks first.
      const queued = asRecord(
        await readOrThrow(
          await doFetch(`${BASE}/${model}/requests`, {
            method: "POST",
            headers: headers({ "Idempotency-Key": crypto.randomUUID() }),
            body: JSON.stringify(toRouterBody(request, options.bodyStyle)),
          }),
          "submit",
        ),
      );

      const statusUrl = stringAt(queued, "status_url");
      const responseUrl = stringAt(queued, "response_url");
      if (!statusUrl || !responseUrl) {
        throw new ProviderError("comfy", "Queue response missing status_url/response_url");
      }

      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const status = asRecord(
          await readOrThrow(await doFetch(statusUrl, { headers: headers() }), "status"),
        );
        const state = (stringAt(status, "status") ?? "").toLowerCase();

        if (state === "completed" || state === "succeeded" || state === "success") break;
        if (state && !["queued", "running", "in_progress", "pending", "processing"].includes(state)) {
          throw new ProviderError("comfy", `Run ended as ${state}`);
        }
        if (Date.now() > deadline) throw new ProviderError("comfy", "Timed out waiting for result");
        if (pollMs > 0) await new Promise((resolve) => setTimeout(resolve, pollMs));
      }

      const final = await doFetch(responseUrl, { headers: headers() });
      const charged = chargedUsd(final.headers);
      const result = await readOrThrow(final, "result");

      return {
        provider: "comfy",
        endpoint: model,
        assets: collectAssets(result),
        usd: charged,
        raw: result,
      };
    },
  };
}

/**
 * Router takes each model's own native body. The shared part is `content`: a
 * text item, then any media items with the role that decides the operation —
 * a first frame animates, a reference image styles.
 */
function toRouterBody(
  request: GenerationRequest,
  style: BodyStyle = "content",
): Record<string, unknown> {
  if (style === "prompt") {
    return {
      prompt: request.prompt,
      ...(request.images?.length ? { images: request.images } : {}),
      ...(request.passthrough ?? {}),
    };
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: request.prompt }];

  for (const [index, url] of (request.images ?? []).entries()) {
    content.push({
      type: "image_url",
      image_url: { url },
      role: index === 0 ? "first_frame" : "reference_image",
    });
  }

  return { content, ...(request.passthrough ?? {}) };
}

/** Router reports the real charge on the finished response. */
function chargedUsd(headers: Headers): number | null {
  for (const name of ["x-litellm-response-cost", "x-comfy-cost-usd", "x-comfy-credits-used"]) {
    const raw = headers.get(name);
    if (raw === null) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

/** Router returns each model's native result, so several shapes are in play. */
function collectAssets(result: unknown): GenerationResult["assets"] {
  const assets: GenerationResult["assets"] = [];
  const record = asRecord(result);

  for (const item of asArray(record.images)) {
    const url = stringAt(item, "url");
    if (url) assets.push({ url, kind: "image" });
  }
  const image = stringAt(record.image, "url");
  if (image) assets.push({ url: image, kind: "image" });

  for (const item of asArray(record.videos)) {
    const url = stringAt(item, "url");
    if (url) assets.push({ url, kind: "video" });
  }
  const video = stringAt(record.video, "url");
  if (video) assets.push({ url: video, kind: "video" });

  for (const item of asArray(record.data)) {
    const url = stringAt(item, "url");
    if (url) assets.push({ url, kind: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image" });
  }

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

function numberAt(value: unknown, key: string): number | undefined {
  const field = asRecord(value)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function detail(body: unknown): string | undefined {
  const record = asRecord(body);
  return (
    stringAt(record, "detail") ??
    stringAt(record, "error_type") ??
    stringAt(record, "message") ??
    undefined
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
