export type Item = Record<string, unknown>;
// Keep in sync with the bundled Haggs Game Director node's ACTIONS.
export const ACTOR_ACTIONS = ['idle','walk','attack','dodge','hit','victory'] as const;
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
  // Both bundled node packs reject paths with duplicate or negative times.
  if (path.length===3 && path[0]==='path' && typeof path[1]==='number' && path[2]===0 && typeof value==='number') {
    const points=parsed.items[item]?.path;
    if (value<0 || !Array.isArray(points) || points.some((p,index)=>index!==path[1] && Array.isArray(p) && p[0]===value)) return null;
  }
  if (parsed.group==='actors' && path.length===3 && path[0]==='events' && typeof path[1]==='number') {
    const events=parsed.items[item]?.events, event=Array.isArray(events)?events[path[1]]:undefined;
    if (!object(event)) return null;
    if (path[2]==='action' && (typeof value!=='string' || !ACTOR_ACTIONS.some(action=>action===value))) return null;
    if ((path[2]==='start' || path[2]==='end') && typeof value==='number') {
      const start=path[2]==='start'?value:event.start, end=path[2]==='end'?value:event.end;
      if(typeof start!=='number'||typeof end!=='number'||!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=end)return null;
    }
  }
  (target as Record<string | number, unknown>)[key] = value;
  return JSON.stringify(parsed.root, null, 2);
}

/** Edit the existing actor events without changing other timeline data. */
export function changeActorEvents(raw:string,item:number,remove?:number):string|null {
 const parsed=parseTimeline(raw),entry=parsed?.items[item];
 if(!parsed||parsed.group!=='actors'||!entry||!Array.isArray(entry.events)||entry.events.length>100)return null;
 const events=entry.events;
 if(!events.every(e=>object(e)&&typeof e.action==='string'&&ACTOR_ACTIONS.some(a=>a===e.action)&&typeof e.start==='number'&&typeof e.end==='number'&&Number.isFinite(e.start)&&Number.isFinite(e.end)&&e.start>=0&&e.start<e.end))return null;
 if(remove!==undefined){if(!Number.isInteger(remove)||remove<0||remove>=events.length)return null;events.splice(remove,1);}
 else {if(events.length===100)return null;const start=events.reduce((latest,e)=>Math.max(latest,e.end as number),0);if(!Number.isFinite(start+1)||start+1<=start)return null;events.push({start,end:start+1,action:'idle'});}
 return JSON.stringify(parsed.root,null,2);
}

/** Add or remove a position without rewriting any other timeline fields. */
export function changePathPoints(raw: string, item: number, remove?: number): string | null {
  const parsed=parseTimeline(raw), entry=parsed?.items[item];
  if (!parsed || !entry || !Array.isArray(entry.path) || !entry.path.length || entry.path.length>100) return null;
  const points=entry.path;
  if (!points.every(p=>Array.isArray(p) && p.length===3 && p.every(n=>typeof n==='number' && Number.isFinite(n)) && p[0]>=0 && p[1]>=0 && p[1]<=1 && p[2]>=0 && p[2]<=1)) return null;
  if (new Set(points.map(p=>p[0])).size!==points.length) return null;
  if (remove!==undefined) {
    if (!Number.isInteger(remove) || remove<0 || remove>=points.length || points.length===1) return null;
    points.splice(remove,1);
  } else {
    if (points.length===100) return null;
    const last=points.reduce((a,b)=>a[0]>b[0]?a:b);
    const time=last[0]+1;
    if (!Number.isFinite(time) || time<=last[0]) return null;
    points.push([time,last[1],last[2]]);
  }
  return JSON.stringify(parsed.root,null,2);
}
