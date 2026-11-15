import { mkdir, open, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./auth";
import type { Intent, Journal } from "../runpod/journal";
/** Production persistence is account-scoped Supabase, not ephemeral serverless disk. */
export async function runpodJournal(owner: string): Promise<Journal> {
  if (process.env.NODE_ENV !== "production") {
    const root = join(process.cwd(), ".haggs", "runpod", owner);
    await mkdir(root, { recursive: true, mode: 0o700 });
    const path = (id: string) => {
      if (!/^[a-f\d-]{36}$/i.test(id)) throw Error("Invalid intent ID.");
      return join(root, id + ".json");
    };
    const get = async (id: string) => {
      try {
        return JSON.parse(await readFile(path(id), "utf8")) as Intent;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    };
    return {
      get,
      async claim(intent) {
        let handle;
        try {
          handle = await open(path(intent.id), "wx", 0o600);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            const found = await get(intent.id);
            if (!found) throw Error("Request journal is not readable.");
            return { created: false, intent: found };
          }
          throw error;
        }
        try {
          await handle.writeFile(JSON.stringify(intent));
          await handle.sync();
        } finally {
          await handle.close();
        }
        return { created: true, intent };
      },
      async put(intent) {
        const target = path(intent.id),
          temp = target + "." + crypto.randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(intent), { mode: 0o600 });
        await rename(temp, target);
      },
    };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!url || !key || !token)
    throw Error(
      "Account-backed RunPod job storage is not configured. No job submitted.",
    );
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const get = async (id: string) => {
    const { data, error } = await db
      .from("runpod_jobs")
      .select("intent")
      .eq("user_id", owner)
      .eq("id", id)
      .maybeSingle();
    if (error)
      throw Error(
        "RunPod job journal unavailable. No submission retry was made.",
      );
    return data?.intent as Intent | undefined;
  };
  return {
    get,
    async claim(intent) {
      const { error } = await db
        .from("runpod_jobs")
        .insert({ id: intent.id, user_id: owner, intent });
      if (!error) return { created: true, intent };
      if (error.code === "23505") {
        const found = await get(intent.id);
        if (found) return { created: false, intent: found };
      }
      throw Error(
        "Could not reserve a durable RunPod request. Nothing was submitted.",
      );
    },
    async put(intent) {
      const { error, data } = await db
        .from("runpod_jobs")
        .update({ intent, updated_at: new Date().toISOString() })
        .eq("user_id", owner)
        .eq("id", intent.id)
        .select("id");
      if (error || !data?.length)
        throw Error(
          "Could not save RunPod job status. Reconcile the existing request; do not resubmit.",
        );
    },
  };
}
