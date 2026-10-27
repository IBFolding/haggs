import { portal, customerMessage } from "../../../../server/billing";
import { verifyUser } from "../../../../server/auth";
import { origin, stripeFromEnv } from "../../../../server/stripe";

export async function POST(request: Request) {
  const user = await verifyUser(request);
  if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });
  const stripe = stripeFromEnv();
  if (!stripe) return Response.json({ ok: false, reason: "Billing isn't switched on yet." }, { status: 503 });
  try {
    return Response.json({ ok: true, url: await portal(stripe, process.env, user, origin(request)) });
  } catch (caught) {
    return Response.json({ ok: false, reason: customerMessage(caught, "The billing portal couldn't open. Please try again in a moment.") }, { status: 400 });
  }
}
