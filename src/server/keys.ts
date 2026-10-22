import type { cookies } from "next/headers";

export const KEY_COOKIE = "fal_key";
export const COMFY_COOKIE = "comfy_key";
/** The writer's key. Claude drafts scripts and fills sheets on your own Anthropic account. */
export const CLAUDE_COOKIE = "claude_key";

/**
 * In local development a key can also come from .env.local, so a machine that
 * already holds its keys doesn't need them typed again. A key in the browser
 * always wins; in production only the browser's key is ever used.
 */
const ENV_FOR: Record<string, string> = { [COMFY_COOKIE]: "COMFY_API_KEY", [KEY_COOKIE]: "FAL_KEY", [CLAUDE_COOKIE]: "ANTHROPIC_API_KEY" };
export function keyIn(jar: Awaited<ReturnType<typeof cookies>>, cookie: string): string | undefined {
  const own = jar.get(cookie)?.value;
  if (own) return own;
  if (process.env.NODE_ENV === "production") return undefined;
  return process.env[ENV_FOR[cookie] ?? ""]?.trim() || undefined;
}
