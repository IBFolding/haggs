import type {ApiPrompt} from '../comfy/convert';
import type {ComfyAsset} from '../providers/comfy-managed';

/** Draft conversion for the shipped node contract. It does not authorize a job. */
export function prepareOwnedRoom(input:{character:string;theme:string;prompt:string;reference?:ComfyAsset}):{prompt:ApiPrompt;outputNode:string;availability:'unavailable';reason:string}{
 if(!['knight','mage','robot'].includes(input.character)||!['dungeon','temple','spaceship'].includes(input.theme)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2000)throw Error('Invalid room settings.');
 const prompt:ApiPrompt={'1':{class_type:'HaggsPlayableWorld',inputs:{character:input.character,theme:input.theme,visual_prompt:input.prompt.trim(),eden_service_url:'http://127.0.0.1:8089'}}};
 if(input.reference){const asset=input.reference;if(asset.__type!=='core/ASSET'||!asset.info||!/^[a-zA-Z0-9_-]{1,128}$/.test(asset.info.id))throw Error('Invalid room reference.');prompt['2']={class_type:'LoadImage',inputs:{image:asset}};prompt['1']!.inputs.visual_reference=['2',0];}
 return {prompt,outputNode:'1',availability:'unavailable',reason:'The room requires an interactive Comfy session and a persistent recording backend; the managed connection does not yet provide these. Eden remains unavailable.'};
}
