import { runAdJobsNow } from "../../../../../server/adRunnerServer";
import { partnerKeyOk } from "../../../../../server/storypop";

export const maxDuration = 300;

/** Safety net: StoryPop (or a person) can ask the runner to pick up any ad jobs that are still waiting. */
export async function POST(request: Request) {
  if (!partnerKeyOk(request.headers.get("authorization"), process.env.STORYPOP_PARTNER_KEY)) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, ...(await runAdJobsNow(3)) });
}
