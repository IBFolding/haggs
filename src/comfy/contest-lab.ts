import catalog from '../../public/workflows/contest-lab/WORKFLOW-CATALOG.json';
export const CONTEST_EFFECTS = catalog.map(e => ({ ...e, image: `/workflows/contest-lab/${e.slug}-illustrative.webp`, preview: `/workflows/contest-lab/previews/${e.slug}-synthetic.mp4` }));
export type ContestKind = 'ltx' | 'reuse';
export const contestName = (slug: string, kind: ContestKind) => `haggs_fx_${kind}_${slug}`;
export function contestVariant(name: string) {
  for (const effect of CONTEST_EFFECTS) for (const kind of ['ltx', 'reuse'] as const) {
    if (contestName(effect.slug, kind) === name) return { effect, kind };
  }
  return undefined;
}
