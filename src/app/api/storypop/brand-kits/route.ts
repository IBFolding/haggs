import { fetchBrandKit } from "../../../../server/brandKit";
import { partnerKeyOk } from "../../../../server/storypop";

/** StoryPop asks for a brand kit from an advertiser's website. */
export async function POST(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const kit = await fetchBrandKit(body.url);
  if (!kit) return Response.json({ ok: false, error: "We couldn't read that website. Check the address." }, { status: 422 });
  return Response.json({ ok: true, brandKit: kit });
}
