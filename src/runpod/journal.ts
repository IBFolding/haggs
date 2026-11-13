/** A claim is written durably BEFORE /run. Ambiguous claims are never resubmitted automatically. */
import { createHash } from "node:crypto";
import { SubmissionRejected, type RenderInput, type RemoteJob } from "./client";
export type Intent = {
  id: string;
  connection: string;
  owner: string;
  endpoint: string;
  hash: string;
  state: "SUBMITTING" | "SUBMISSION_UNKNOWN" | "REJECTED" | RemoteJob["status"];
  job?: RemoteJob;
  createdAt: number;
  updatedAt: number;
};
export type Journal = {
  claim: (intent: Intent) => Promise<{ created: boolean; intent: Intent }>;
  get: (id: string) => Promise<Intent | undefined>;
  put: (intent: Intent) => Promise<void>;
};
export const inputHash = (input: RenderInput) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
export async function submitOnce(
  journal: Journal,
  intent: Intent,
  submit: () => Promise<RemoteJob>,
): Promise<Intent> {
  const claimed = await journal.claim(intent);
  const old = claimed.intent;
  if (
    old.connection !== intent.connection ||
    old.owner !== intent.owner ||
    old.endpoint !== intent.endpoint ||
    old.hash !== intent.hash
  )
    throw Error("This request ID belongs to a different connection or input.");
  if (!claimed.created) return old;
  try {
    const job = await submit();
    const next: Intent = {
      ...intent,
      job,
      state: job.status,
      updatedAt: Date.now(),
    };
    await journal.put(next);
    return next;
  } catch (error) {
    const next: Intent = {
      ...intent,
      state:
        error instanceof SubmissionRejected ? "REJECTED" : "SUBMISSION_UNKNOWN",
      updatedAt: Date.now(),
    };
    await journal.put(next);
    return next;
  }
}
