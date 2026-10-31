import repair from '../../public/workflows/ltx/01-repair-this-cut.json';
import handles from '../../public/workflows/ltx/02-give-this-shot-handles.json';
import continuity from '../../public/workflows/ltx/03-continuity-brief.json';
import beat from '../../public/workflows/ltx/04-action-on-this-beat-music-video.json';
import { LTX_WORKFLOWS, ltxWorkflow } from '../comfy/ltx';
import { appOf, type Field } from '../comfy/apps';
import { toApiPrompt, validate, type Catalog, type UiWorkflow } from '../comfy/convert';
import type { Entry, Opened } from './comfy-library';
import coreCatalog from '../comfy/fixtures/catalog.json';

const graphs: readonly unknown[] = [repair, handles, continuity, beat];
export function ltxTemplate(name: string): UiWorkflow | null {
  const index = LTX_WORKFLOWS.findIndex(w => w.name === name);
  return index < 0 ? null : structuredClone(graphs[index]) as unknown as UiWorkflow;
}
export function ltxEntries(): Entry[] {
  return LTX_WORKFLOWS.map(w => ({ name: w.name, title: w.title, description: w.description, category: 'Video', kind: 'video', tags: ['LTX', 'Open weights'], models: ['LTX 2.5'], thumb: w.image, usage: 0, inputs: [], runnable: null, open: true }));
}
export function openLtxForDisplay(name: string): Opened {
  const catalog = { ...coreCatalog,
    PrimitiveStringMultiline: { input: { required: { value: ['STRING', { multiline: true, default: '' }] } }, output: ['STRING'] },
    LoadAudio: { input: { required: { audio: ['STRING'] } }, output: ['AUDIO'] },
  } as unknown as Catalog;
  // Bundled schemas only expose the requirements and controls. Preflight and
  // submission still validate the selected runtime's real node/model catalog.
  return { ...openLtx(name, catalog), problems: [] };
}
/** Explicit controls are needed: upstream prompts are empty primitives, and duration is a linked primitive. */
export function openLtx(name: string, catalog: Catalog): Opened {
  const meta = ltxWorkflow(name);
  const ui = ltxTemplate(name);
  if (!meta || !ui) throw new Error('Unknown LTX workflow.');
  const { prompt, problems } = toApiPrompt(ui, catalog);
  // These curated graphs require their named weights; never silently substitute a similarly named model.
  problems.push(...validate(prompt, catalog));
  const app = appOf(ui, prompt, catalog);
  const fields: Field[] = [];
  const bind = (field: Field, type: string) => {
    if (prompt[field.node]?.class_type !== type || !(field.input in prompt[field.node]!.inputs)) {
      problems.push(`The LTX control “${field.label}” is unavailable with this node catalog.`);
    } else fields.push(field);
  };
  bind({ kind: 'text', node: meta.promptNode, input: 'value', label: 'Positive prompt', value: meta.prompt }, 'PrimitiveStringMultiline');
  if (meta.durationNode) bind({ kind: 'number', node: meta.durationNode, input: 'value', label: 'Duration (seconds)', value: name === 'haggs_ltx_continuity_brief' ? 10 : 5, min: 1, max: 20, step: 1 }, 'PrimitiveFloat');
  if (name === 'haggs_ltx_action_on_beat') bind({ kind: 'number', node: '5601', input: 'value', label: 'Audio start (seconds)', value: 0, min: 0, max: 3600, step: 0.1 }, 'PrimitiveFloat');
  // Keep the upstream negative prompt and enhancement internals fixed; expose one deliberate positive prompt.
  app.fields = [...app.fields.filter(f => f.kind === 'media'), ...fields];
  const output = Object.entries(prompt).find(([, n]) => n.class_type === 'SaveVideo');
  app.output = output?.[0] ?? null;
  app.produces = output ? 'video' : null;
  if (!output) problems.push('This LTX workflow needs SaveVideo to return its clip.');
  return { entry: ltxEntries().find(e => e.name === name)!, ui, app, problems, catalog };
}
