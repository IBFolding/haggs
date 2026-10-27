import type {ApiPrompt,Catalog} from './convert';
import {partnerNodes} from './partner';
import {localBase} from '../providers/local';
/** Decide the execution destination before uploading media or submitting a job. */
export function workflowRuntime(prompt:ApiPrompt,catalog:Catalog,address:string|undefined,hasCloudKey:boolean):{kind:'local';base:string}|{kind:'cloud'} {
 if(address&&!partnerNodes(prompt,catalog).length)return {kind:'local',base:localBase(address)};
 if(!hasCloudKey)throw new Error('This workflow uses cloud services and needs a Comfy key. No job was submitted.');
 return {kind:'cloud'};
}
