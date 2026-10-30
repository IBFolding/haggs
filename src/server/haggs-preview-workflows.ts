import drag from '../../public/workflows/game-director/workflows/preview-no-model/01-drag-to-action.json';
import boss from '../../public/workflows/game-director/workflows/preview-no-model/02-boss-fight-choreographer.json';
import reskin from '../../public/workflows/game-director/workflows/preview-no-model/04-game-reskin-director.json';
import moveset from '../../public/workflows/game-director/workflows/preview-no-model/05-animation-moveset-builder.json';
import enemy from '../../public/workflows/game-director/workflows/preview-no-model/06-enemy-intent-painter.json';
import vfxMask from '../../public/workflows/world-motion-vfx/workflows/07-vfx-placement-mask-preview.json';
import vfxReuse from '../../public/workflows/world-motion-vfx/workflows/08-vfx-reuse-existing-take.json';
import savedMotion from '../../public/workflows/world-motion-vfx/workflows/05-saved-motion-bridge-preview.json';
import { HAGGS_PREVIEWS, haggsPreview } from '../comfy/haggs-preview';
import { appOf } from '../comfy/apps';
import { prepare, validate, type Catalog, type UiWorkflow } from '../comfy/convert';
import type { Entry, Opened } from './comfy-library';
import fixture from '../comfy/fixtures/haggs-preview.catalog.json';

const graphs: Record<string, unknown> = { haggs_preview_drag_to_action:drag, haggs_preview_boss_fight:boss, haggs_preview_game_reskin:reskin, haggs_preview_moveset:moveset, haggs_preview_enemy_intent:enemy, haggs_preview_vfx_mask:vfxMask, haggs_preview_vfx_reuse:vfxReuse, haggs_preview_saved_motion:savedMotion };
export function previewTemplate(name: string): UiWorkflow | null {
  const meta = haggsPreview(name);
  if (!meta) return null;
  const ui = structuredClone(graphs[name]) as UiWorkflow;
  // Use named fields: CreateVideo's optional input order varies by Comfy version.
  for (const node of ui.nodes) if (node.type === 'CreateVideo') node.widgets_values = { fps:24, bit_depth:'auto', color_space:'sRGB' };
  // The website returns a video; do not silently create an atlas that it cannot deliver.
  if (name === 'haggs_preview_moveset' || name === 'haggs_preview_enemy_intent') {
    ui.nodes = ui.nodes.filter(node => String(node.id) !== '950');
    ui.links = ui.links.filter(link => {
      const pair = Array.isArray(link) ? [link[1], link[3]] : [(link as {origin_id:number}).origin_id, (link as {target_id:number}).target_id];
      return pair.every(id => String(id) !== '950');
    });
  }
  return ui;
}
/** Only exact bundled graphs inherit CPU preview eligibility when saved as an app. */
export function savedHaggsPreviewName(file: string): string | null {
  if (file.length > 5_000_000) return null;
  try {
    const candidate = JSON.stringify(JSON.parse(file));
    return HAGGS_PREVIEWS.find(item => candidate === JSON.stringify(previewTemplate(item.name)))?.name ?? null;
  } catch { return null; }
}
export const isSavedHaggsPreview = (file: string) => savedHaggsPreviewName(file) !== null;
export function previewEntries(): Entry[] {
  return HAGGS_PREVIEWS.map(e => ({ name:e.name, title:e.title, description:e.description, category:'Video Tools', kind:'video', tags:['Haggs', 'Preview', 'Local'], models:['No model'], thumb:`/workflows/${e.pack}/${e.image}`, usage:0, inputs:[], runnable:null, open:true }));
}
export function openHaggsPreview(name: string, catalog: Catalog): Opened {
  const ui = previewTemplate(name); const entry = previewEntries().find(item => item.name === name);
  if (!ui || !entry) throw new Error('Unknown Haggs preview.');
  const {prompt, problems} = prepare(ui, catalog);
  problems.push(...validate(prompt, catalog));
  const app = appOf(ui, prompt, catalog);
  // These prompts describe a later H3 run and do not alter the no-model preview.
  app.fields = app.fields.filter(f => f.kind === 'media' || f.input === 'timeline_json' || f.input === 'seconds').map(f => {
    if (f.input === 'timeline_json') return {...f, label:'Timing and placement (JSON)'};
    if (f.input === 'seconds') return {...f, label:'Preview length (seconds)'};
    return f;
  });
  if (name === 'haggs_preview_saved_motion') {
    app.fields = [
      {kind:'text', node:'1', input:'file', label:'NPZ filename inside ComfyUI/input', value:'haggs-studio-synthetic-motion.npz'},
      {kind:'number', node:'1', input:'duration', label:'Motion duration (seconds)', value:5, min:0.5, max:12},
      {kind:'number', node:'900', input:'yaw_degrees', label:'Camera angle', value:0, min:-180, max:180},
      {kind:'number', node:'900', input:'speed', label:'Playback speed', value:1, min:0.25, max:4},
    ];
  }
  if (!app.output || app.produces !== 'video') problems.push('A video output is required for this preview.');
  return {entry,ui,app,problems,catalog};
}
export function openHaggsPreviewForDisplay(name: string): Opened {
  const result = openHaggsPreview(name, fixture as unknown as Catalog);
  return {...result, problems: []};
}
