import Stripe from "stripe";

import type { StripeLike } from "./billing";

/** Stripe with no automatic retries: a payment call that might have gone through is never silently repeated. */
export function stripeFromEnv(): StripeLike | null {
  const key = process.env.STRIPE_API_KEY?.trim();
  return key ? (new Stripe(key, { maxNetworkRetries: 0 }) as unknown as StripeLike) : null;
}

export const origin = (request: Request) => new URL(request.url).origin;
