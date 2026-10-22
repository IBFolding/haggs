/**
 * A provider is any backend that can run a generation. The product's whole
 * premise is that this is a variable, not a constant: Higgsfield cannot ship
 * an abstraction that lets you route away from Higgsfield, because the routing
 * is the margin. We can, so the seam belongs here, at the bottom.
 */

/** What a caller asks for, before any provider has seen it. */
export type GenerationRequest = {
  /** Provider-neutral capability, not an endpoint. Resolved per provider. */
  capability: Capability;
  prompt: string;
  /** Public URLs. Providers that need their own CDN upload these first. */
  images?: string[];
  /** Whether the first image is the opening frame (default) or just another reference. */
  firstFrame?: boolean;
  /** A picture the video should end on. Only models with a last-frame input use it. */
  lastFrame?: string;
  count?: number;
  aspectRatio?: AspectRatio;
  /** Provider-specific escape hatch, merged last, never inspected by us. */
  passthrough?: Record<string, unknown>;
};

export type Capability =
  | "text-to-image"
  | "image-edit"
  | "image-to-video"
  | "text-to-video"
  | "identity-training";

export type AspectRatio =
  | "1:1" | "4:5" | "2:3" | "3:2" | "16:9" | "9:16" | "3:4" | "4:3" | "21:9";

/** A price quote, in USD, obtained before anything is charged. */
export type Quote = {
  provider: string;
  endpoint: string;
  /** Null when the provider will not quote ahead of submission. */
  usd: number | null;
  /** Free-text basis, shown to the user so a null or a surprise is legible. */
  basis: string;
};

export type GenerationResult = {
  provider: string;
  endpoint: string;
  assets: Array<{ url: string; kind: "image" | "video" }>;
  /** Actual charge when the provider reports one, else the quote we accepted. */
  usd: number | null;
  raw: unknown;
};

export interface Provider {
  readonly name: string;

  /** Whether this provider can serve the capability at all. */
  supports(capability: Capability): boolean;

  /**
   * Price the request without running it. Every provider that can quote must,
   * because the comparison is the product. Returning null is allowed but it
   * shows up in the UI as an unknown, which is the honest thing to display.
   */
  quote(request: GenerationRequest): Promise<Quote>;

  run(request: GenerationRequest): Promise<GenerationResult>;
}

export class ProviderError extends Error {
  readonly provider: string;
  readonly status: number | undefined;

  constructor(provider: string, message: string, status?: number) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
  }
}
