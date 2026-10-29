import { importSheets } from "../sheets/sheets";
import { inbox, listSnapshots, propose, readSnapshot, type Proposal, type Snapshot } from "./bridge";

type Item = Omit<Proposal, "id" | "at">;
export interface AgentStore {
  list(): Promise<{ id: string; name: string }[]>;
  load(project: string): Promise<Snapshot | null>;
  propose(project: string, item: Item): Promise<Proposal>;
  inbox(project: string): Promise<Proposal[]>;
}
export function agentMode(env: Record<string, string | undefined>): "live" | "local" { return env.HAGGS_TOKEN ? "live" : "local"; }
export function createAgentStore(root: string, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): AgentStore {
  if (agentMode(env) === "local") return { list: () => listSnapshots(root), load: (id) => readSnapshot(root, id), propose: (id, item) => propose(root, id, item), inbox: (id) => inbox(root, id) };
  const url = env.HAGGS_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.HAGGS_SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Set HAGGS_SUPABASE_URL and HAGGS_SUPABASE_KEY, or the public Supabase values in .env.local.");
  async function rpc<T>(name: string, args: object = {}): Promise<T> {
    const res = await fetcher(`${url!.replace(/\/$/, "")}/rest/v1/rpc/agent_${name}`, { method: "POST", redirect: "error", headers: { apikey: key!, "Content-Type": "application/json" }, body: JSON.stringify({ ...args, token: env.HAGGS_TOKEN }) });
    const body = await res.json();
    if (!res.ok) throw new Error(typeof body?.message === "string" ? body.message : `Agent request failed (${res.status}).`);
    return body as T;
  }
  return {
    async list() { return (await rpc<{ project_id: string; project_name: string }[]>("projects")).map((p) => ({ id: p.project_id, name: p.project_name })); },
    async load(project) { const row = (await rpc<{ data: Snapshot["project"]; sheets: string | null }[]>("project", { project }))[0]; return row ? { project: row.data, sheets: row.sheets ? importSheets(row.sheets) : null } : null; },
    async propose(project, item) { const id = await rpc<string>("propose", { project, board: item.boardId ?? null, kind: item.kind, summary: item.summary, payload: item.payload, format_id: item.formatId ?? null }); return { ...item, id, at: Date.now() }; },
    async inbox() { throw new Error("Live agent tokens cannot read the inbox. Review waiting proposals on haggsfield.studio."); },
  };
}
