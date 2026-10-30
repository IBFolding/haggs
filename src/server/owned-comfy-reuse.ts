import {contestEntries,openContestForDisplay} from './contest-workflows';
import {fill,type Values} from '../comfy/apps';
import {prepare,validate,type ApiPrompt} from '../comfy/convert';
import type {ComfyAsset} from '../providers/comfy-managed';

const NAME='haggs_fx_reuse_03-portal-paint';
/** Convert the bundled portal-paint reuse graph using the bundled display schema.
 * This does not prove a remote runtime has the nodes/models and must not enable execution. */
export function prepareOwnedPortalPaint(values:Values,assets:Record<string,ComfyAsset>):{prompt:ApiPrompt;outputNode:string} {
 return prepareOwnedReuse(NAME,values,assets);
}

export function prepareOwnedReuse(name:string,values:Values,assets:Record<string,ComfyAsset>):{prompt:ApiPrompt;outputNode:string} {
 if(!contestEntries().some(e=>e.name===name && e.name.startsWith('haggs_fx_reuse_')))throw Error('Unknown reuse workflow.');
 const opened=openContestForDisplay(name), converted=prepare(opened.ui,opened.catalog);
 if(converted.problems.length||converted.swaps.length||opened.app.output!=='10004')throw Error('Bundled workflow is invalid.');
 const allowed=new Set(opened.app.fields.filter(f=>f.kind!=='media').map(f=>`${f.node}/${f.input}`));
 if(Object.keys(values).some(k=>!allowed.has(k))) throw Error('Unknown workflow control.');
 const media=opened.app.fields.filter(f=>f.kind==='media');
 const keys=media.map(f=>`${f.node}/${f.input}`);
 if(Object.keys(assets).some(k=>!keys.includes(k))||keys.some(k=>!assets[k]))throw Error('Add all required media.');
 for(const key of keys){const a=assets[key];if(!a||a.__type!=='core/ASSET'||!a.info||!/^[a-zA-Z0-9_-]{1,128}$/.test(a.info.id))throw Error('Invalid uploaded asset.');}
 const placeholders=Object.fromEntries(keys.map(k=>[k,'uploaded-file']));
 const prompt=fill(converted.prompt,opened.app,{...values,...placeholders});
 const problems=validate(prompt,opened.catalog);if(problems.length)throw Error('Workflow input validation failed.');
 for(const field of media)prompt[field.node]!.inputs[field.input]=assets[`${field.node}/${field.input}`]!;
 return {prompt,outputNode:'10004'};
}
