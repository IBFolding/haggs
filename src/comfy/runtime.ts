import type {ApiPrompt,Catalog} from './convert';
import {partnerNodes} from './partner';
import {localBase} from '../providers/local';
/** Decide the execution destination before uploading media or submitting a job. */
export function workflowRuntime(prompt:ApiPrompt,catalog:Catalog,address:string|undefined,hasCloudKey:boolean,destination?:'local'|'cloud'):{kind:'local';base:string}|{kind:'cloud'} {
 if(destination==='local' && (!address || partnerNodes(prompt,catalog).length)) throw new Error('Your GPU was selected, but this workflow needs a reachable local ComfyUI without partner nodes. No cloud fallback or job was started.');
 if(destination==='cloud') {if(!hasCloudKey)throw new Error('Comfy Cloud was selected. Add a Comfy key; no local fallback or job was started.');return {kind:'cloud'};}
 if(address&&!partnerNodes(prompt,catalog).length)return {kind:'local',base:localBase(address)};
 if(!hasCloudKey)throw new Error('This workflow uses cloud services and needs a Comfy key. No job was submitted.');
 return {kind:'cloud'};
}
