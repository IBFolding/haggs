import drag from '../../public/workflows/game-director/workflows/preview-no-model/01-drag-to-action.json';
import boss from '../../public/workflows/game-director/workflows/preview-no-model/02-boss-fight-choreographer.json';
import reskin from '../../public/workflows/game-director/workflows/preview-no-model/04-game-reskin-director.json';
import moveset from '../../public/workflows/game-director/workflows/preview-no-model/05-animation-moveset-builder.json';
import enemy from '../../public/workflows/game-director/workflows/preview-no-model/06-enemy-intent-painter.json';
import vfxMask from '../../public/workflows/world-motion-vfx/workflows/07-vfx-placement-mask-preview.json';
import vfxReuse from '../../public/workflows/world-motion-vfx/workflows/08-vfx-reuse-existing-take.json';
import savedMotion from '../../public/workflows/world-motion-vfx/workflows/05-saved-motion-bridge-preview.json';
import roomRecording from '../../public/workflows/world-motion-vfx/workflows/09-load-room-recording-no-model.json';
import sam2 from '../../public/workflows/contest-lab/workflows/08-SAM2-tracked-mask-helper.json';
import { HAGGS_PREVIEWS, haggsPreview } from '../comfy/haggs-preview';
import { appOf } from '../comfy/apps';
import { prepare, validate, type Catalog, type UiWorkflow } from '../comfy/convert';
import type { Entry, Opened } from './comfy-library';
import fixture from '../comfy/fixtures/haggs-preview.catalog.json';

const graphs: Record<string, unknown> = { haggs_preview_drag_to_action:drag, haggs_preview_boss_fight:boss, haggs_preview_game_reskin:reskin, haggs_preview_moveset:moveset, haggs_preview_enemy_intent:enemy, haggs_preview_vfx_mask:vfxMask, haggs_preview_vfx_reuse:vfxReuse, haggs_preview_saved_motion:savedMotion, haggs_preview_room_recording:roomRecording, haggs_sam2_mask_preview:sam2 };
export function previewTemplate(name: string): UiWorkflow | null {
  const meta = haggsPreview(name);
  if (!meta) return null;
  const ui = structuredClone(graphs[name]) as UiWorkflow;
  if (name === 'haggs_sam2_mask_preview') {
    const loader = ui.nodes.find(node => String(node.id) === '3');
    if (!loader) throw new Error('The SAM2 model loader is unavailable.');
    loader.widgets_values = ['sam2.1_hiera_tiny.safetensors','video','cpu','fp32'];
    ui.nodes.push({id:90,type:'CreateVideo',inputs:[{name:'images',type:'IMAGE',link:90},{name:'fps',type:'FLOAT',link:91}],widgets_values:{bit_depth:'auto',color_space:'sRGB'}}, {id:91,type:'SaveVideo',inputs:[{name:'video',type:'VIDEO',link:92}],widgets_values:['video/haggs/sam2-mask','auto','auto']});
    ui.links.push([90,6,0,90,0,'IMAGE'],[91,2,2,90,1,'FLOAT'],[92,90,0,91,0,'VIDEO']);
  }
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
/** Only exact bundled graphs inherit their preview identity when saved as an app. */
export function savedHaggsPreviewName(file: string): string | null {
  if (file.length > 5_000_000) return null;
  try {
    const candidate = JSON.stringify(JSON.parse(file));
    return HAGGS_PREVIEWS.find(item => candidate === JSON.stringify(previewTemplate(item.name)))?.name ?? null;
  } catch { return null; }
}
export const isSavedHaggsPreview = (file: string) => savedHaggsPreviewName(file) !== null;
export function previewInputProblem(name: string | null, values: Record<string, string | number | boolean>): string | null {
  if (name === 'haggs_preview_room_recording' && !/^[0-9a-f]{32}$/.test(String(values['1/value'] ?? ''))) return 'Enter the 32-character session ID from your recorded Playable World room.';
  if (name === 'haggs_sam2_mask_preview') {
    const match = /^(\d{1,5})\s*,\s*(\d{1,5})$/.exec(String(values['4/value'] ?? '').trim());
    if (!match || Number(match[1]) > 32767 || Number(match[2]) > 32767) return 'Enter a first-frame point as X, Y in pixels, for example 100, 100.';
  }
  return null;
}
export function previewValues(name: string | null, values: Record<string, string | number | boolean>) {
  if (name !== 'haggs_sam2_mask_preview' || previewInputProblem(name, values)) return values;
  const [x,y] = String(values['4/value']).split(',').map(Number);
  return {...values, '4/value':JSON.stringify([{x,y}])};
}
export function previewEntries(): Entry[] {
  return HAGGS_PREVIEWS.map(e => ({ name:e.name, title:e.title, description:e.description, category:'Video Tools', kind:'video', tags:['Haggs', 'Preview', 'Local'], models:e.name === 'haggs_sam2_mask_preview' ? ['SAM2'] : ['No model'], thumb:`/workflows/${e.pack}/${e.image}`, usage:0, inputs:[], runnable:null, open:true }));
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
  if (name === 'haggs_preview_room_recording') {
    app.fields = [{kind:'text', node:'1', input:'value', label:'Recorded room session ID', value:''}];
  }
  if (name === 'haggs_sam2_mask_preview') {
    app.fields = [...app.fields.filter(f => f.kind === 'media').map(f => ({...f,label:'Source video'})),
      {kind:'text',node:'4',input:'value',label:'Subject point on first frame (X, Y in pixels)',value:''},
      {kind:'choice',node:'3',input:'device',label:'SAM2 device',value:'cpu',options:['cpu','cuda','mps']}];
  }
  if (!app.output || app.produces !== 'video') problems.push('A video output is required for this preview.');
  return {entry,ui,app,problems,catalog};
}
export function openHaggsPreviewForDisplay(name: string): Opened {
  const result = openHaggsPreview(name, fixture as unknown as Catalog);
  return {...result, problems: []};
}
