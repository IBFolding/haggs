import graph_0_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/01-world-orchestra.json';
import graph_0_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/01-world-orchestra.json';
import graph_1_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/02-impossible-duet.json';
import graph_1_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/02-impossible-duet.json';
import graph_2_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/03-portal-paint.json';
import graph_2_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/03-portal-paint.json';
import graph_3_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/04-reality-scrubber.json';
import graph_3_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/04-reality-scrubber.json';
import graph_4_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/05-foley-orchestra.json';
import graph_4_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/05-foley-orchestra.json';
import graph_5_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/06-future-echo.json';
import graph_5_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/06-future-echo.json';
import graph_6_ltx from '../../public/workflows/contest-lab/workflows/LTX-open-weights/07-motion-becomes-matter.json';
import graph_6_reuse from '../../public/workflows/contest-lab/workflows/reuse-existing-video/07-motion-becomes-matter.json';
import { CONTEST_EFFECTS, contestName, contestVariant } from '../comfy/contest-lab';
import { appOf, type Field } from '../comfy/apps';
import { toApiPrompt, validate, type Catalog, type UiWorkflow } from '../comfy/convert';
import type { Entry, Opened } from './comfy-library';
import coreCatalog from '../comfy/fixtures/catalog.json';
import contestCatalog from '../comfy/fixtures/contest-lab.catalog.json';
const graphs: Record<string, unknown> = {
  'haggs_fx_ltx_01-world-orchestra': graph_0_ltx,
  'haggs_fx_reuse_01-world-orchestra': graph_0_reuse,
  'haggs_fx_ltx_02-impossible-duet': graph_1_ltx,
  'haggs_fx_reuse_02-impossible-duet': graph_1_reuse,
  'haggs_fx_ltx_03-portal-paint': graph_2_ltx,
  'haggs_fx_reuse_03-portal-paint': graph_2_reuse,
  'haggs_fx_ltx_04-reality-scrubber': graph_3_ltx,
  'haggs_fx_reuse_04-reality-scrubber': graph_3_reuse,
  'haggs_fx_ltx_05-foley-orchestra': graph_4_ltx,
  'haggs_fx_reuse_05-foley-orchestra': graph_4_reuse,
  'haggs_fx_ltx_06-future-echo': graph_5_ltx,
  'haggs_fx_reuse_06-future-echo': graph_5_reuse,
  'haggs_fx_ltx_07-motion-becomes-matter': graph_6_ltx,
  'haggs_fx_reuse_07-motion-becomes-matter': graph_6_reuse,
};
export function contestTemplate(name: string): UiWorkflow | null {
  return Object.hasOwn(graphs, name) ? structuredClone(graphs[name]) as UiWorkflow : null;
}
/** Build the form from bundled schemas. Execution still checks the real runtime. */
export function openContestForDisplay(name: string): Opened {
  const catalog = { ...coreCatalog, ...contestCatalog,
    LoadAudio: { input: { required: { audio: ['STRING'] } }, output: ['AUDIO'] },
    PrimitiveStringMultiline: { input: { required: { value: ['STRING', { multiline: true, default: '' }] } }, output: ['STRING'] },
  } as unknown as Catalog;
  return openContest(name, catalog);
}
export function contestEntries(): Entry[] {
  return CONTEST_EFFECTS.flatMap(e => (['ltx', 'reuse'] as const).map(kind => ({ name: contestName(e.slug, kind), title: `${e.name} · ${kind === 'ltx' ? 'LTX' : 'Reuse video'}`, description: `${e.scope} Experimental local app: install ComfyUI-HaggsContestLab. Advanced masks and band maps must be connected in ComfyUI; otherwise the supplied geometric defaults apply.`, category: 'Video Tools', kind: 'video', tags: ['Haggs Contest Lab', 'Local', kind], models: kind === 'ltx' ? ['LTX 2.5'] : ['Existing video'], thumb: e.image, usage: 0, inputs: [], runnable: null, open: true })));
}
export function openContest(name: string, catalog: Catalog): Opened {
  const meta = contestVariant(name), ui = contestTemplate(name);
  if (!meta || !ui) throw new Error('Unknown Contest Lab workflow.');
  const { prompt, problems } = toApiPrompt(ui, catalog);
  problems.push(...validate(prompt, catalog));
  const app = appOf(ui, prompt, catalog);
  const fields: Field[] = app.fields.filter(f => f.kind === 'media');
  const bind = (field: Field, expectedType: string) => {
    if (prompt[field.node]?.class_type !== expectedType || !(field.input in prompt[field.node]!.inputs)) problems.push(`The effect control “${field.label}” is unavailable. Install the required Contest Lab nodes.`);
    else fields.push(field);
  };
  if (meta.kind === 'ltx') bind({kind:'text',node:'251:252',input:'value',label:'Effect layer prompt',value:String(prompt['251:252']?.inputs.value ?? 'Describe the generated effect layer.')}, 'PrimitiveStringMultiline');
  const effectType = `Haggs${meta.effect.name.replaceAll(' ', '')}`;
  const number = (input: string, label: string, min: number, max: number, step: number) => bind({kind:'number',node:'10000',input,label,value:Number(prompt['10000']?.inputs[input] ?? min),min,max,step},effectType);
  const text = (input: string, label: string) => bind({kind:'text',node:'10000',input,label,value:String(prompt['10000']?.inputs[input] ?? '')},effectType);
  number('amount','Effect amount',0,1,0.01);
  number('bpm','BPM (manual)',20,300,1);
  number('beat_offset_seconds','Beat offset (seconds)',0,600,0.01);
  text('beat_times_seconds','Explicit beat times (seconds, comma separated)');
  if (/duet|echo/.test(meta.effect.slug)) { number('delay_seconds','Echo delay (seconds)',0.01,10,0.01); number('spread_fraction','Horizontal spread',-0.5,0.5,0.01); }
  if (meta.effect.slug.includes('reality')) text('reality_schedule','Time:mix schedule (0–1)');
  if (meta.effect.slug.includes('foley')) number('source_impact_seconds','Marked source impact (seconds)',0,600,0.01);
  app.fields = fields;
  app.output = prompt['10004']?.class_type === 'SaveVideo' ? '10004' : null;
  app.produces = app.output ? 'video' : null;
  if (!app.output) problems.push('SaveVideo is required to return the finished effect.');
  return {entry:contestEntries().find(e=>e.name===name)!,ui,app,problems,catalog};
}
