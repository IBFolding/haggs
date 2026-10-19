/**
 * fal publishes every model's live schema and price at
 * `https://fal.ai/models/<endpoint>/llms.txt`, generated from the same
 * metadata the platform serves — so it cannot drift from the real endpoint.
 *
 * That is a structural advantage worth building on. open-higgsfield
 * hand-maintains 38 model files and they rot the moment a provider changes a
 * default. We fetch instead, and a model we have never heard of still prices.
 *
 * The prices are written in prose, and the prose is not uniform. Three shapes
 * appear across the catalog, verified against live pages:
 *
 *   images   "Your request will cost $0.08 per image."
 *   training "Your request will cost $2 per training run (scales with steps)."
 *   tiered   "Your request will cost $0.03 for the first megapixel ... plus"
 *   video    "For every second of video you generate you will be charged
 *             $0.20 without audio or $0.40 with audio for 720p or 1080p."
 *
 * Most carry conditions — audio on/off, 2K/4K multipliers, per-second tiers.
 * We surface the lowest stated rate and flag it as a floor rather than quote
 * one resolution's number as if it were the price. A visible "from $X" beats
 * a confident wrong total, because the comparison is the entire product and a
 * comparison built on invented numbers is worth less than no comparison.
 */

export type ModelPricing = {
  endpoint: string;
  /** Lowest stated rate in USD. Null when nothing parses. */
  usdPerUnit: number | null;
  /** What the rate is per: "image", "second", "training run", "megapixel". */
  unit: string | null;
  /** True when other, higher rates apply under stated conditions. */
  conditional: boolean;
  /** The pricing prose verbatim. Always displayable, always the source of truth. */
  text: string;
};

const CACHE = new Map<string, ModelPricing>();

const unknown = (endpoint: string, text: string): ModelPricing => ({
  endpoint,
  usdPerUnit: null,
  unit: null,
  conditional: false,
  text,
});

/** Strips markdown bold so `**$0.08**` parses like `$0.08`. */
const deemphasize = (text: string): string => text.replace(/\*\*/g, "");

/** The `## Pricing` section, flattened to one line, bold and links removed. */
export function pricingSection(body: string): string {
  const match = body.match(/^##\s*Pricing\s*$([\s\S]*?)^##\s/m);
  const section = match?.[1] ?? "";
  return deemphasize(section)
    .replace(/\[.*?\]\(.*?\)/g, "")
    // Every page ends its pricing block with this boilerplate. Cutting it here
    // keeps it out of unit captures, which otherwise swallow "For more details".
    .split(/For more details/i)[0]!
    .replace(/\s+/g, " ")
    .trim();
}

/** Every dollar figure in the sentence, in order of appearance. */
function rates(text: string): number[] {
  return [...text.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
}

export function parsePricing(endpoint: string, body: string): ModelPricing {
  const text = pricingSection(body);
  if (!text) return unknown(endpoint, "");

  // Video, per-second: "For every second of video ... charged $X ... or $Y"
  if (/for every second of video/i.test(text)) {
    const found = rates(text);
    const low = found.length ? Math.min(...found) : null;
    return {
      endpoint,
      usdPerUnit: low,
      unit: low === null ? null : "second",
      conditional: new Set(found).size > 1,
      text,
    };
  }

  // Video, per-clip: "Each 1080p 5 second video costs roughly $0.62."
  const perClip = text.match(/\bcosts?\s+(?:roughly|about|approximately)?\s*\$\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (perClip?.[1] && /\bvideo\b/i.test(text)) {
    return {
      endpoint,
      usdPerUnit: Number(perClip[1]),
      unit: "video",
      conditional: /other resolution|other duration|roughly|about|approximately/i.test(text),
      text,
    };
  }

  // Tiered, checked before the flat rate: the flat pattern would otherwise
  // match the cheaper "plus $0.015 per extra megapixel" add-on and report it
  // as the headline price.
  const tiered = text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*for the first\s+([a-z]+)/i);
  if (tiered?.[1] && tiered[2]) {
    return { endpoint, usdPerUnit: Number(tiered[1]), unit: tiered[2], conditional: true, text };
  }

  // Flat per-unit: "cost $0.08 per image" / "$2 per training run"
  const perUnit = text.match(
    /\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:per|for each)\s+([a-z]+(?:\s+[a-z]+)?)/i,
  );
  if (perUnit?.[1] && perUnit[2]) {
    return {
      endpoint,
      usdPerUnit: Number(perUnit[1]),
      unit: normalizeUnit(perUnit[2]),
      conditional: /2K|4K|0\.5K|if .* is used|extra|additional|scales/i.test(text),
      text,
    };
  }

  return unknown(endpoint, text);
}

/** "megapixels" and "training run" both arrive; singularize only the former. */
function normalizeUnit(raw: string): string {
  const unit = raw.trim().replace(/^(a|an|one)\s+/i, "").toLowerCase();
  return unit.endsWith("s") && !unit.endsWith("ss") ? unit.slice(0, -1) : unit;
}

export async function fetchPricing(
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelPricing> {
  const cached = CACHE.get(endpoint);
  if (cached) return cached;

  let parsed: ModelPricing;
  try {
    const response = await fetchImpl(`https://fal.ai/models/${endpoint}/llms.txt`);
    parsed = response.ok
      ? parsePricing(endpoint, await response.text())
      : unknown(endpoint, `No published price (HTTP ${response.status})`);
  } catch (caught) {
    parsed = unknown(endpoint, `Price lookup failed: ${String(caught)}`);
  }

  CACHE.set(endpoint, parsed);
  return parsed;
}

/** Human-readable rate for the comparison table. */
export function formatRate(pricing: ModelPricing): string {
  if (pricing.usdPerUnit === null) return "unknown";
  const rate = `$${pricing.usdPerUnit.toFixed(pricing.usdPerUnit < 0.01 ? 4 : 3)}/${pricing.unit}`;
  return pricing.conditional ? `from ${rate}` : rate;
}

/** Test seam — the cache is process-wide and would otherwise leak between runs. */
export function clearPricingCache(): void {
  CACHE.clear();
}
