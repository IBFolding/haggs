import { createClient } from "@supabase/supabase-js";

import { requestToken, verifyUser } from "../../../../../server/auth";
import { cleanReference, sendToStoryPop } from "../../../../../server/storypop";

/** The person finishes one of their StoryPop jobs: attach the result and haggs tells StoryPop. */
export async function POST(request: Request) {
  const user = await verifyUser(request);
  const token = requestToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!user || !token) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!url || !anon) return Response.json({ ok: false, error: "Not switched on." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { reference?: unknown; status?: unknown; resultUrl?: unknown; reason?: unknown };
  const reference = cleanReference(body.reference);
  const status = body.status === "failed" ? "failed" : body.status === "completed" ? "completed" : null;
  const resultUrl = typeof body.resultUrl === "string" && /^https:\/\//.test(body.resultUrl) && body.resultUrl.length <= 1000 ? body.resultUrl : null;
  if (!reference || !status) return Response.json({ ok: false, error: "reference and status are required" }, { status: 400 });
  if (status === "completed" && !resultUrl) return Response.json({ ok: false, error: "Add the link to the finished video (https)." }, { status: 400 });

  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: jobId, error } = await db.rpc("storypop_job_finish", { job_reference: reference, new_status: status, url: resultUrl });
  if (error || !jobId) return Response.json({ ok: false, error: "That job isn't waiting on you." }, { status: 404 });

  const { data } = await db.rpc("credits_balance");
  const row = Array.isArray(data) ? data[0] : data;
  const balance = (Number(row?.plan) || 0) + (Number(row?.topup) || 0);
  const delivered = await sendToStoryPop(
    status === "completed"
      ? { type: "job.completed", haggsUserId: user.id, haggsJobId: String(jobId), ...(resultUrl ? { resultUrl } : {}), creditsBalance: balance }
      : { type: "job.failed", haggsUserId: user.id, haggsJobId: String(jobId), ...(typeof body.reason === "string" ? { reason: body.reason.slice(0, 200) } : {}), creditsBalance: balance }
  );
  return Response.json({ ok: true, delivered });
}
