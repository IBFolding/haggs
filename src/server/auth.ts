import { createClient } from "@supabase/supabase-js";

import type { User } from "./billing";

/**
 * Who is asking, from the Supabase access token the app sends as a bearer
 * token. Supabase checks the token; nothing here trusts a user id the browser
 * claims on its own.
 */
export async function verifyUser(request: Request): Promise<User | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}
