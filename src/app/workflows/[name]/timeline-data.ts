export type Item = Record<string, unknown>;
export const object = (v: unknown): v is Item => v !== null && typeof v === 'object' && !Array.isArray(v);
export function parseTimeline(raw: string): {root: Item; group: 'actors' | 'effects' | 'telegraphs'; items: Item[]} | null {
  try {
    const root: unknown = JSON.parse(raw);
    if (!object(root)) return null;
    const group = (['actors', 'effects', 'telegraphs'] as const).find(k => Array.isArray(root[k]));
    if (!group || !(root[group] as unknown[]).every(object)) return null;
    return {root, group, items: root[group] as Item[]};
  } catch { return null; }
}
export function updateTimeline(raw: string, item: number, path: (string | number)[], value: string | number): string | null {
  const parsed = parseTimeline(raw);
  if (!parsed || !parsed.items[item] || path.length === 0 || path.some(p => p === '__proto__' || p === 'constructor' || p === 'prototype')) return null;
  let target: unknown = parsed.items[item];
  for (const key of path.slice(0, -1)) {
    if ((!object(target) && !Array.isArray(target)) || !(key in target)) return null;
    target = (target as Record<string | number, unknown>)[key];
  }
  const key = path[path.length - 1];
  if (key === undefined || (!object(target) && !Array.isArray(target)) || !(key in target)) return null;
  const prior = (target as Record<string | number, unknown>)[key];
  if (typeof prior !== typeof value || (typeof value === 'number' && !Number.isFinite(value))) return null;
  (target as Record<string | number, unknown>)[key] = value;
  return JSON.stringify(parsed.root, null, 2);
}
