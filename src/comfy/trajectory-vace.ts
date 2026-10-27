import type {ApiPrompt,Catalog} from './convert';
import {validate} from './convert';
import base from './fixtures/trajectory-vace.api.json';
import {controlSpec} from '../story/trajectory-control';
import type {Trajectory} from '../story/trajectory';
export function trajectoryWorkflow(t:Trajectory,vertical:boolean,prompt:string){
 if(!prompt.trim()||prompt.length>4000)throw Error('Describe the intended scene in 1–4000 characters.');
 const spec=controlSpec(t,vertical),graph=structuredClone(base) as ApiPrompt;
 Object.assign(graph['49']!.inputs,{width:spec.width,height:spec.height,length:spec.frames});
 graph['68']!.inputs.fps=spec.fps;graph['6']!.inputs.text=prompt.trim();graph['3']!.inputs.seed=42;
 graph['145']!.inputs.file='haggs-depth-control.mp4';graph['134']!.inputs.image='reference.png';
 return graph;
}
export function trajectoryPreflight(graph:ApiPrompt,catalog:Catalog){return [...Object.values(graph).filter(n=>!catalog[n.class_type]).map(n=>`Missing node: ${n.class_type}`),...validate(graph,catalog)];}
