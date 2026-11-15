"use server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  RUNPOD_COOKIE,
  runpodOwner,
  runpodConnection,
  sealRunpod,
  unsealRunpod,
} from "../../server/runpod-connection";
import { runpodJournal } from "../../server/runpod-journal";
import {
  createRunpodClient,
  endpointSchema,
  renderSchema,
  type RenderInput,
} from "../../runpod/client";
import { inputHash, submitOnce, type Intent } from "../../runpod/journal";
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 86400,
};
const intentId = z.string().uuid();
export async function connectRunpod(
  endpoint: string,
  key: string,
): Promise<
  | { ok: true; endpoint: string; connectionId: string }
  | { ok: false; reason: string }
> {
  try {
    endpoint = endpointSchema.parse(endpoint);
    const owner = await runpodOwner();
    const id = createHash("sha256")
      .update(JSON.stringify([owner, endpoint, key]))
      .digest("hex")
      .slice(0, 32);
    const sealed = sealRunpod({
      id,
      endpoint,
      key,
      owner,
      expires: Date.now() + options.maxAge * 1000,
    });
    await createRunpodClient({ endpoint, key }).health();
    (await cookies()).set(RUNPOD_COOKIE, sealed, options);
    return { ok: true, endpoint, connectionId: id };
  } catch {
    return {
      ok: false,
      reason:
        "Could not verify the endpoint. Check its ID and API key locally. In production, sign in and configure the host encryption key. No worker was started by this check.",
    };
  }
}
export async function heldRunpod(): Promise<{
  endpoint: string;
  connectionId: string;
} | null> {
  try {
    const c = await runpodConnection();
    return { endpoint: c.endpoint, connectionId: c.id };
  } catch {
    return null;
  }
}
export async function disconnectRunpod() {
  (await cookies()).set(RUNPOD_COOKIE, "", { ...options, maxAge: 0 });
}
export async function runpodHealth() {
  try {
    const c = await runpodConnection();
    return {
      ok: true as const,
      health: await createRunpodClient({
        endpoint: c.endpoint,
        key: c.key,
      }).health(),
    };
  } catch {
    return {
      ok: false as const,
      reason: "Endpoint health could not be read. No job was submitted.",
    };
  }
}
export async function runpodExecutionEnabled() {
  return process.env.HAGGS_RUNPOD_EXECUTION_ENABLED === "1";
}
/** The app flag stays OFF until endpoint/storage/runtime and a paid proof have been approved. */
export async function submitRunpod(
  id: string,
  raw: RenderInput,
  approved: boolean,
): Promise<{ ok: true; intent: Intent } | { ok: false; reason: string }> {
  try {
    if (process.env.HAGGS_RUNPOD_EXECUTION_ENABLED !== "1")
      throw Error(
        "RunPod generation is not enabled on this host. Finish the worker/storage setup and approve a proof render first. Nothing submitted.",
      );
    if (approved !== true)
      throw Error("Confirm this compute-billed job before submitting.");
    intentId.parse(id);
    const input = renderSchema.parse(raw),
      connection = await runpodConnection();
    const journal = await runpodJournal(
      connection.owner === "local-development"
        ? connection.id
        : connection.owner,
    );
    const intent: Intent = {
      id,
      owner: connection.owner,
      connection: connection.id,
      endpoint: connection.endpoint,
      hash: inputHash(input),
      state: "SUBMITTING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const record = await submitOnce(journal, intent, () =>
      createRunpodClient({
        endpoint: connection.endpoint,
        key: connection.key,
      }).submit(input, id),
    );
    return { ok: true, intent: record };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "Submission stopped. Check the original request before resubmitting.",
    };
  }
}
export async function statusRunpod(
  id: string,
): Promise<{ ok: true; intent: Intent } | { ok: false; reason: string }> {
  try {
    intentId.parse(id);
    const c = await runpodConnection(),
      journal = await runpodJournal(
        c.owner === "local-development" ? c.id : c.owner,
      ),
      intent = await journal.get(id);
    if (
      !intent ||
      intent.connection !== c.id ||
      intent.endpoint !== c.endpoint ||
      intent.owner !== c.owner
    )
      throw Error("Request not found for this connection.");
    if (!intent.job) return { ok: true, intent };
    const job = await createRunpodClient({
        endpoint: c.endpoint,
        key: c.key,
      }).status(intent.job.id),
      next = { ...intent, job, state: job.status, updatedAt: Date.now() };
    await journal.put(next);
    return { ok: true, intent: next };
  } catch {
    return {
      ok: false,
      reason:
        "Could not read the existing job. Do not submit a replacement automatically; check RunPod request history.",
    };
  }
}
export async function cancelRunpod(id: string) {
  try {
    intentId.parse(id);
    const c = await runpodConnection(),
      journal = await runpodJournal(
        c.owner === "local-development" ? c.id : c.owner,
      ),
      intent = await journal.get(id);
    if (!intent?.job || intent.owner !== c.owner || intent.connection !== c.id)
      throw Error();
    await createRunpodClient({ endpoint: c.endpoint, key: c.key }).cancel(
      intent.job.id,
    );
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      reason:
        "Cancellation could not be confirmed. Check the original job in RunPod.",
    };
  }
}
/** Reconciliation attaches a provider ID to the held intent; it never submits a replacement. */
export async function reconcileRunpod(id: string, jobId: string) {
  try {
    intentId.parse(id);
    const c = await runpodConnection(),
      journal = await runpodJournal(
        c.owner === "local-development" ? c.id : c.owner,
      ),
      intent = await journal.get(id);
    if (
      !intent ||
      intent.connection !== c.id ||
      intent.owner !== c.owner ||
      intent.job
    )
      throw Error();
    const job = await createRunpodClient({
      endpoint: c.endpoint,
      key: c.key,
    }).status(jobId);
    const next = { ...intent, job, state: job.status, updatedAt: Date.now() };
    await journal.put(next);
    return { ok: true as const, intent: next };
  } catch {
    return {
      ok: false as const,
      reason:
        "Could not attach this provider job. Verify it is the original request in your endpoint history.",
    };
  }
}
