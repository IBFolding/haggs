import type { SavedApp } from "../story/apps";
import { checkFee } from "./fees";

/**
 * Community apps over Supabase: publish one of your apps for anyone to run,
 * browse what's published, and charge or refund a run. The database applies
 * the 80/20 split and the credit balance; this only calls it and turns its
 * refusals into sentences.
 */

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
/** The three Supabase calls used, so tests don't need a server. */
export type Db = {
  insert: (table: string, row: Record<string, unknown>) => Result<Record<string, unknown>>;
  select: (table: string, opts: { order: string; limit: number }) => Result<Record<string, unknown>[]>;
  rpc: (fn: string, args: Record<string, unknown>) => Result<unknown>;
};

export type CommunityApp = { id: string; name: string; description: string; creatorName: string; feeCents: number; runs: number; workflow: string; recipe?: unknown; cover?: { url: string; kind: "image" | "video" } };

const fail = (e: { message: string } | null, fallback: string) => {
  if (e) throw new Error(e.message || fallback);
};

export async function publishApp(db: Db, app: SavedApp, feeCents: number, creatorName: string): Promise<string> {
  const fee = checkFee(feeCents);
  const cover = app.cover && /^https:\/\//.test(app.cover.url) ? app.cover : undefined;
  const { data, error } = await db.insert("community_apps", {
    name: app.name.slice(0, 80),
    description: app.description.slice(0, 400),
    workflow: app.workflow,
    recipe: app.recipe ?? null,
    creator_name: creatorName.slice(0, 60),
    fee_cents: fee,
    ...(cover ? { cover_url: cover.url, cover_kind: cover.kind } : {}),
  });
  fail(error, "The app couldn't be published.");
  return String(data?.id ?? "");
}

export async function listApps(db: Db): Promise<CommunityApp[]> {
  const { data, error } = await db.select("community_apps", { order: "runs", limit: 60 });
  fail(error, "The community shelf couldn't be loaded.");
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: String(r.description ?? ""),
    creatorName: String(r.creator_name ?? ""),
    feeCents: Number(r.fee_cents ?? 0),
    runs: Number(r.runs ?? 0),
    workflow: String(r.workflow),
    ...(r.recipe ? { recipe: r.recipe } : {}),
    ...(typeof r.cover_url === "string" && (r.cover_kind === "image" || r.cover_kind === "video") ? { cover: { url: r.cover_url, kind: r.cover_kind } } : {}),
  }));
}

/** Takes the creator's fee from the runner's credits before the run starts. */
export async function chargeRun(db: Db, appId: string): Promise<{ run: string; feeCents: number }> {
  const { data, error } = await db.rpc("charge_app_run", { app: appId });
  fail(error, "The run couldn't be charged.");
  const r = data as { run: string; fee_cents: number };
  return { run: r.run, feeCents: r.fee_cents };
}

export async function refundRun(db: Db, run: string): Promise<void> {
  const { error } = await db.rpc("refund_app_run", { run });
  fail(error, "The fee couldn't be refunded.");
}
