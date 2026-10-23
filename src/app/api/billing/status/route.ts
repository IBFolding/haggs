import { configured, status, topupsConfigured } from "../../../../server/billing";
import { verifyUser } from "../../../../server/auth";
import { stripeFromEnv } from "../../../../server/stripe";

/** What can be bought, and — for a signed-in person — what they have. */
export async function GET(request: Request) {
  const plans = configured(process.env).map((p) => p.id);
  const topups = topupsConfigured(process.env).map((t) => ({ id: t.id, usd: t.usd, credits: t.credits }));
  const user = await verifyUser(request);
  const stripe = stripeFromEnv();
  if (!user || !stripe) return Response.json({ ok: true, checkout: Boolean(stripe), plans, topups, signedIn: Boolean(user), status: null });
  try {
    return Response.json({ ok: true, checkout: true, plans, topups, signedIn: true, status: await status(stripe, process.env, user) });
  } catch {
    return Response.json({ ok: false, checkout: true, plans, signedIn: true, status: null, reason: "Stripe couldn't be reached." });
  }
}
