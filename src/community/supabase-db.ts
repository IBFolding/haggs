import type { SupabaseClient } from "@supabase/supabase-js";

import type { Db } from "./community";

/** The Supabase client as the three calls the community code makes. */
export const dbOf = (sb: SupabaseClient): Db => ({
  insert: async (table, row) => {
    const { data, error } = await sb.from(table).insert(row).select().single();
    return { data: data as Record<string, unknown> | null, error };
  },
  select: async (table, { order, limit }) => {
    const { data, error } = await sb.from(table).select("*").eq("published", true).order(order, { ascending: false }).limit(limit);
    return { data: data as Record<string, unknown>[] | null, error };
  },
  rpc: async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    return { data, error };
  },
});
