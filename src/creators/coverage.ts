import plans from './data/coverage-plans.json';
import setups from './data/setups.json';
import {createProject,newShot,type Project} from '../story/model';
import {defaultGrey,type GreyFrame} from '../story/grey';
import {normalizeScene,type GreyScene} from '../story/grey-scene';
/** Slate data, Apache-2.0; provenance and original notices in third_party/imagination-studio. */
export const COVERAGE_PLANS=plans.plans;
export const DIRECTOR_SETUPS=setups.categories;
export function coverageProject(options:{brief:string;title:string;plan:string;setups:string[];grey?:GreyFrame;scene?:GreyScene}):Project {
 const recipe=COVERAGE_PLANS.find(p=>p.id===options.plan);if(!recipe)throw Error('Choose a coverage plan.');
 if(options.brief.trim().length<12||options.brief.length>6000)throw Error('Describe a scene in 12–6,000 characters.');
 const selected=DIRECTOR_SETUPS.flatMap(c=>c.setups).filter(s=>options.setups.includes(s.id));if(selected.length!==options.setups.length||selected.length>8)throw Error('Choose up to eight known directing setups.');
 const base=createProject(options.title.trim().slice(0,120)||'Coverage study'),start=options.grey??defaultGrey();
 const style=selected.map(s=>s.snippet).join(' ');
 const shots=recipe.shots.map((slot,i)=>{
  const wide=/^(WS|EWS|LS)$/.test(slot.size),tight=/CU|Insert/.test(slot.size),angle=/high|overhead/i.test(slot.angle)?2.8:/low/i.test(slot.angle)?.6:start.cam.height;
  const frame:GreyFrame={...structuredClone(start),cam:{...start.cam,height:angle,lens:wide?28:tight?75:50}};delete frame.camKeys;
  const shot={...newShot(),heading:`${i+1}. ${slot.slot}`,beat:`${options.brief.trim()}\nCoverage purpose: ${slot.intent}\nFrame: ${slot.promptGuidance}`,seconds:4,grey:frame,direction:{camera:`${slot.size}; ${slot.angle}; ${slot.movement}`,staging:slot.promptGuidance,constants:style}};
  return options.scene?{...shot,greyScene:normalizeScene(structuredClone(options.scene))}:shot;
 });
 return {...base,direction:{...base.direction,constants:style},boards:[{id:crypto.randomUUID(),name:recipe.label,kind:'board',shots,notes:[]}],source:{templateId:`slate:${recipe.id}`,name:'Slate coverage · Keys + Sam Wasserman'}};
}
