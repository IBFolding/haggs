import { topupCheckout } from "../../../../server/billing";
import { verifyUser } from "../../../../server/auth";
import { origin, stripeFromEnv } from "../../../../server/stripe";

export async function POST(request: Request) {
  const user = await verifyUser(request);
  if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });
  const stripe = stripeFromEnv();
  if (!stripe) return Response.json({ ok: false, reason: "Checkout isn't switched on yet." }, { status: 503 });
  const { pack } = (await request.json().catch(() => ({}))) as { pack?: string };
  try {
    return Response.json({ ok: true, url: await topupCheckout(stripe, process.env, pack ?? "", user, origin(request)) });
  } catch (caught) {
    return Response.json({ ok: false, reason: caught instanceof Error ? caught.message : "Checkout couldn't start." }, { status: 400 });
  }
}
