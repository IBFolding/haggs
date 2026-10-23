/**
 * Going to build something and coming back to where you were. A page that
 * sends you off to make a character, a place or an outfit adds `return` (where
 * you were) and `label` (what to call it); the builder shows a way back, and
 * the way back carries what you made as `pick`, so the page you return to
 * already has it chosen.
 */

export type PickKind = "character" | "place";

/** Only a path on this site, so a link can't send anyone elsewhere. */
export function safeReturn(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return null;
  try {
    const u = new URL(raw, "http://x.invalid");
    return u.host === "x.invalid" ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}

const join = (path: string, params: Record<string, string>) => {
  const u = new URL(path, "http://x.invalid");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.pathname + u.search;
};

/** The link to a builder, remembering where you are. */
export function withReturn(href: string, here: string, label: string): string {
  const back = safeReturn(here);
  return back ? join(href, { return: back, label: label.slice(0, 40) }) : href;
}

/** The way back, with what was made chosen. */
export function pickUrl(returnTo: string, kind: PickKind, id: string): string {
  const back = safeReturn(returnTo);
  if (!back) throw new Error("There is nowhere to go back to.");
  return join(back, { pick: `${kind}:${id}` });
}

/** What a page returned to should select, from its own URL. */
export function readPick(search: string): { kind: PickKind; id: string } | null {
  const raw = new URLSearchParams(search).get("pick");
  const m = /^(character|place):([A-Za-z0-9._-]{1,80})$/.exec(raw ?? "");
  return m ? { kind: m[1] as PickKind, id: m[2]! } : null;
}
