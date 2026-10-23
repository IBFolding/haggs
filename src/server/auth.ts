import { createClient } from "@supabase/supabase-js";

import type { User } from "./billing";

/**
 * Who is asking, from the Supabase access token: sent as a bearer token to
 * API routes, and kept in the `haggs-at` cookie so server actions can see it
 * too. Supabase checks the token; nothing here trusts a user id the browser
 * claims on its own.
 */

export const TOKEN_COOKIE = "haggs-at";

const checked = new Map<string, { user: User | null; until: number }>();

/** The person a token belongs to, or null. A verdict is remembered for a minute so a burst of requests asks Supabase once. */
export async function verifyToken(token: string | undefined | null): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || token.length > 4000 || !url || !key) return null;
  const hit = checked.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  const user = error || !data.user?.email ? null : { id: data.user.id, email: data.user.email };
  if (checked.size > 500) checked.clear();
  checked.set(token, { user, until: Date.now() + 60_000 });
  return user;
}

const bearer = (request: Request) => /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
const cookieToken = (header: string | null) => header?.split(/;\s*/).map((c) => c.split("=")).find(([k]) => k === TOKEN_COOKIE)?.[1];

/** The person behind an API request: by bearer token, or by the cookie the app keeps. */
export async function verifyUser(request: Request): Promise<User | null> {
  return verifyToken(bearer(request) ?? cookieToken(request.headers.get("cookie")));
}

/** The person behind a server action. Null outside a request, or when nobody is signed in. */
export async function userNow(): Promise<User | null> {
  try {
    const { cookies } = await import("next/headers");
    return verifyToken((await cookies()).get(TOKEN_COOKIE)?.value);
  } catch {
    return null;
  }
}

/** Whether saving files needs a signed-in person (HAGGS_REQUIRE_SIGNIN=1). Off until sign-in is switched on for the project. */
export const signInRequired = () => process.env.HAGGS_REQUIRE_SIGNIN === "1";

/** The folder name files are kept under: the signed-in person's, or a shared guest folder. */
export const ownerOf = (user: User | null) => (user ? `u-${user.id}` : "guest");
