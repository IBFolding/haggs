/**
 * A project made on your own computer points at files on that computer
 * (/api/local/...), which no other device can open. These helpers find those
 * links and swap them for copies in your account, so the copy that travels is
 * playable everywhere while the copy on this machine is left as it was.
 */

const LOCAL = /\/api\/local\/[^"'\s\\)]+/g;

/** Every file on this machine that a project or its sheets point at, once each. */
export function localLinks(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.match(LOCAL) ?? []) found.add(m);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return [...found];
}

/** A copy of `value` with the links in `map` swapped for their cloud address. The original is not changed. */
export function withLinks<T>(value: T, map: Record<string, string>): T {
  const swap = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(LOCAL, (m) => map[m] ?? m);
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return swap(value) as T;
}
