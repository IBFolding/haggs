/**
 * A small fixed-window limiter for the expensive hosted endpoints. It lives in
 * one server instance's memory, so it is a brake on one person hammering a
 * button, not a guarantee across instances; the file store's own quota is the
 * hard stop.
 */

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

/** True while `key` is within `max` uses per `windowMs`. Each call counts as a use. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    if (windows.size > 5000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= max;
}

/** Who is asking, for limiting: the signed-in person, else the caller's address. */
export function caller(request: Request, userId?: string): string {
  if (userId) return `u:${userId}`;
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${fwd || request.headers.get("x-real-ip") || "unknown"}`;
}

export const resetLimits = () => windows.clear();
