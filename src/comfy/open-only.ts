/**
 * Open weights only: a switch in the header that keeps every run off partner
 * models (the Comfy nodes flagged api_node, and the Router and fal endpoints,
 * which are all partner APIs). Open-weights workflows still run, on your own
 * GPU when one is connected and on Comfy Cloud otherwise. The switch is a
 * cookie so the server enforces it, not just the page.
 */

export const OPEN_COOKIE = "haggs-open-only";

export const PARTNER_REFUSAL = "Open weights only is on, and this uses a partner model, so nothing was started. Turn the switch off in the header to use it.";

export const openOnlyIn = (jar: { get(name: string): { value: string } | undefined }) => jar.get(OPEN_COOKIE)?.value === "1";

/** Why a workflow can't run with the switch on, naming the partner nodes it calls, or null when it can. */
export function workflowRefusal(openOnly: boolean, partners: readonly string[]): string | null {
  if (!openOnly || partners.length === 0) return null;
  const named = [...new Set(partners)].slice(0, 3).join(", ");
  return `Open weights only is on, and this workflow calls a partner model (${named}${partners.length > 3 ? ", …" : ""}), so nothing was started. Use an open-weights app, or turn the switch off in the header.`;
}
