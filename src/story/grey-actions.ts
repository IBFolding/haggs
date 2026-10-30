import { z } from 'zod';
import { normalizeScene, addLight, addProp, removeProp, updateLight, updateProp, type GreyScene } from './grey-scene';

const id = z.string().min(1).max(100);
const unit = z.number().finite().min(0).max(1);
const media = z.string().max(4000).refine(s => /^(https?:\/\/|\/(?!\/))/.test(s), 'Use an image URL or a local media path.');
export const greyActionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('object.add'), name:z.string().min(1).max(60), url:media, role:z.enum(['actor','object']).optional()}).strict(),
  z.object({type:z.literal('object.move'), id, x:unit, y:unit}).strict(),
  z.object({type:z.literal('object.scale'), id, factor:z.number().finite().min(.02).max(20)}).strict(),
  z.object({type:z.literal('object.rotate'), id, degrees:z.number().finite().min(-360).max(360)}).strict(),
  z.object({type:z.literal('object.remove'), id}).strict(),
  z.object({type:z.literal('lighting.add'), kind:z.enum(['key','fill','glow','practical'])}).strict(),
  z.object({type:z.literal('lighting.adjust'), id, x:unit.optional(), y:unit.optional(), intensity:unit.optional(), color:z.string().regex(/^#[0-9a-f]{6}$/i).optional()}).strict(),
]);
export const greyActionsSchema = z.array(greyActionSchema).min(1).max(30);
export type GreyAction = z.infer<typeof greyActionSchema>;
/** Exact scene precondition, not a security token. Rejects proposals made before any intervening edit. */
export const sceneRevision = (scene: GreyScene) => JSON.stringify(normalizeScene(scene), (_key, value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value);
export const greyProposalSchema = z.object({shotId:id, revision:z.string().max(2_000_000), actions:greyActionsSchema}).strict();

/** Atomic pure edits. No rendering, network requests, file writes or shell execution. */
export function applyGreyActions(scene: GreyScene, input: unknown): GreyScene {
  const actions = greyActionsSchema.parse(input);
  let next = scene;
  for (const action of actions) {
    if (action.type === 'object.add') {
      next = addProp(next, action);
      next = updateProp(next, next.props!.at(-1)!.id, {role:action.role ?? 'object'});
    } else if (action.type === 'lighting.add') next = addLight(next, action.kind);
    else if (action.type === 'lighting.adjust') {
      if (!next.lights?.some(l=>l.id===action.id)) throw new Error('That light no longer exists. Refresh the scene.');
      const {type:_type,id:lightId,...patch}=action;
      next=updateLight(next, lightId, Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==undefined)));
    } else {
      const prop=next.props?.find(p=>p.id===action.id);
      if (!prop) throw new Error('That object no longer exists. Refresh the scene.');
      if (prop.locked) throw new Error(`${prop.name} is locked. Unlock it before editing.`);
      if (action.type==='object.move') next=updateProp(next,prop.id,{x:action.x,y:action.y,...(prop.keys?{keys:prop.keys.map(k=>({...k,...(k.x!==undefined?{x:Math.max(0,Math.min(1,k.x+action.x-prop.x))}:{}),...(k.y!==undefined?{y:Math.max(0,Math.min(1,k.y+action.y-prop.y))}:{})}))}:{})});
      if (action.type==='object.scale') next=updateProp(next,prop.id,{w:prop.w*action.factor,...(prop.keys?{keys:prop.keys.map(k=>k.w===undefined?k:{...k,w:Math.max(.03,Math.min(1.5,k.w*action.factor))})}:{})});
      if (action.type==='object.rotate') next=updateProp(next,prop.id,{rotate:prop.rotate+action.degrees,...(prop.keys?{keys:prop.keys.map(k=>k.rotate===undefined?k:{...k,rotate:((k.rotate+action.degrees)%360+360)%360})}:{})});
      if (action.type==='object.remove') next=removeProp(next,prop.id);
    }
  }
  return next;
}

/** Deliberately limited quick commands; free-form planning belongs to a connected MCP assistant. */
export function quickGreyPlan(scene:GreyScene, selected:string|null, text:string):GreyAction[] {
  const command=text.trim().toLowerCase().replace(/[.!]$/, '');
  const light=/^add (?:a )?(key|fill|glow|practical) light$/.exec(command);
  if(light) return [{type:'lighting.add',kind:light[1] as 'key'|'fill'|'glow'|'practical'}];
  const prop=scene.props?.find(p=>p.id===selected);
  if(!prop) throw new Error('Select an object first, or try “Add a key light”.');
  if(command==='make it smaller') return [{type:'object.scale',id:prop.id,factor:.8}];
  if(command==='make it larger') return [{type:'object.scale',id:prop.id,factor:1.25}];
  const percent=/^make it (\d+(?:\.\d+)?)% smaller$/.exec(command);
  if(percent && +percent[1]!>0 && +percent[1]!<100) return [{type:'object.scale',id:prop.id,factor:1- +percent[1]!/100}];
  const direction=/^move it (left|right|up|down)$/.exec(command);
  if(direction) return [{type:'object.move',id:prop.id,x:Math.max(0,Math.min(1,prop.x+(direction[1]==='left'?-.1:direction[1]==='right'?.1:0))),y:Math.max(0,Math.min(1,prop.y+(direction[1]==='up'?-.1:direction[1]==='down'?.1:0)))}];
  if(command==='rotate it right') return [{type:'object.rotate',id:prop.id,degrees:15}];
  throw new Error('Try “Make it 50% smaller”, “Move it left”, “Rotate it right”, or “Add a key light”. Other requests need your connected MCP assistant.');
}
export function describeGreyAction(scene:GreyScene,a:GreyAction):string {
 const name='id' in a ? scene.props?.find(p=>p.id===a.id)?.name ?? scene.lights?.find(l=>l.id===a.id)?.kind ?? a.id : '';
 switch(a.type){
 case 'object.add':return `Add ${a.name} as a flat ${a.role==='actor'?'actor':'object'} layer`;
 case 'object.scale':return `Resize ${name} to ${Math.round(a.factor*100)}% of its current size`;
 case 'object.move':return `Move ${name} to ${Math.round(a.x*100)}% across, ${Math.round(a.y*100)}% down`;
 case 'object.rotate':return `Rotate ${name} by ${a.degrees}°`;
 case 'object.remove':return `Remove ${name}`;
 case 'lighting.add':return `Add a ${a.kind} preview light`;
 case 'lighting.adjust':return `Adjust ${name} preview light`;
 }
}
