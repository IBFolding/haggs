import { createClient } from "@supabase/supabase-js";

type CreditClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};
type ClientFactory = (url: string, key: string, token: string | undefined) => CreditClient;
const client: ClientFactory = (url, key, token) => createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
});

/** Request-scoped and lazy: no billing client is needed for the missing-key or own-key decisions. */
export function creditOperations(env: Record<string, string | undefined>, token: string | undefined, create: ClientFactory = client) {
  let db: CreditClient | undefined;
  const database = () => {
    if (db) return db;
    const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) throw new Error("Credit billing is not configured. No run was submitted. Contact the studio administrator.");
    db = create(url, key, token);
    return db;
  };
  return {
    spend: async (cents: number, memo: string, ref: string) => {
      const { data, error } = await database().rpc("credits_spend", { cents, memo, ref });
      if (error) throw new Error("Credits couldn't be checked. Try again in a moment.");
      return data === true;
    },
    refund: async (ref: string) => {
      const { error } = await database().rpc("credits_refund", { ref });
      if (error) throw new Error("Credit refund is pending. Check your account before retrying.");
    },
    hasCredits: async () => {
      const { data, error } = await database().rpc("credits_balance");
      if (error) return false;
      const row = (Array.isArray(data) ? data[0] : data) as { plan?: unknown; topup?: unknown } | null;
      return Number(row?.plan ?? 0) + Number(row?.topup ?? 0) > 0;
    },
  };
}
