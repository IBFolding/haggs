import type { ApiPrompt } from './convert';
import type { Field } from './apps';

/** Static image controls; red-channel masks repeat over the shot. */
const specs = [
  { id:'haggs_subject_mask', input:'subject_mask', label:'Subject protection mask (optional still image; white protects)' },
  { id:'haggs_region_mask', input:'region_mask', label:'Effect region mask (optional still image; white selects)' },
  { id:'haggs_band_map', input:'band_map', label:'RGB audio band map (optional still image)' },
] as const;
export const contestMaskFields: Field[] = specs.map(s => ({kind:'media',node:s.id,input:'image',media:'image',label:s.label,optional:true}));
export const isContestMaskField = (node: string) => specs.some(s => s.id === node);
// These capabilities follow effects.py, not merely the node's input schema:
// every compositor declares all three optional sockets, but not every branch uses them.
const capabilities: Record<string, readonly string[]> = {
  HaggsWorldOrchestra: ['haggs_subject_mask', 'haggs_band_map'],
  HaggsImpossibleDuet: ['haggs_subject_mask'],
  HaggsPortalPaint: ['haggs_subject_mask', 'haggs_region_mask'],
  HaggsRealityScrubber: ['haggs_subject_mask'],
  HaggsFoleyOrchestra: [],
  HaggsFutureEcho: ['haggs_subject_mask'],
  HaggsMotionBecomesMatter: ['haggs_subject_mask'],
};
export function contestMaskFieldsFor(effectType: string): Field[] {
  const allowed = capabilities[effectType] ?? [];
  return contestMaskFields.filter(field => allowed.includes(field.node)).map(field => {
    if (field.node === 'haggs_subject_mask' && ['HaggsImpossibleDuet', 'HaggsFutureEcho', 'HaggsMotionBecomesMatter'].includes(effectType)) {
      return {...field, label:'Subject silhouette and protection mask (optional still image; white marks subject)'};
    }
    return field;
  });
}

/** Add only supplied images; never mutate the original graph or replace existing nodes. */
export function addContestMasks(prompt: ApiPrompt, uploaded: Record<string, string | number | boolean>): ApiPrompt {
  const next = structuredClone(prompt);
  const effect = next['10000'];
  if (!effect?.class_type.startsWith('Haggs')) throw new Error('The Haggs effect node is unavailable.');
  const allowed = new Set(contestMaskFieldsFor(effect.class_type).map(field => field.node));
  for (const s of specs) {
    const image = uploaded[`${s.id}/image`];
    if (image === undefined) continue;
    if (!allowed.has(s.id)) throw new Error(`${s.label} is not supported by this effect.`);
    if (typeof image !== 'string' || !/^[-\w.]{1,200}$/.test(image)) throw new Error(`${s.label} did not upload properly.`);
    const maskNode = `${s.id}_red`;
    if (next[s.id] || next[maskNode] || effect.inputs[s.input] !== undefined) throw new Error('The effect mask inputs conflict with the workflow.');
    next[s.id] = {class_type:'LoadImage',inputs:{image}};
    if (s.input === 'band_map') effect.inputs[s.input] = [s.id,0];
    else { next[maskNode] = {class_type:'ImageToMask',inputs:{image:[s.id,0],channel:'red'}}; effect.inputs[s.input] = [maskNode,0]; }
  }
  return next;
}
