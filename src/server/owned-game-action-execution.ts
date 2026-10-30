import {ownedComfyExecution} from './owned-comfy-execution';
import {prepareOwnedGameAction} from './owned-game-action';
import type {ApiPrompt} from '../comfy/convert';
type Dependencies=Parameters<typeof ownedComfyExecution>[4];
type Input=Parameters<typeof prepareOwnedGameAction>[0];
/** Draft integration boundary. The caller must provide trusted identity, journal and validated output storage. */
export async function ownedGameActionExecution(user:string|null,reference:string,mode:'drag-to-action'|'boss-fight',action:'start'|'recover',input:Input|null,deps:Omit<Dependencies,'workflow'|'submit'> & {submitPrompt(origin:string,prompt:ApiPrompt,reference:string):Promise<{id?:string;urls?:{self?:string}}>}){
 let prompt:ApiPrompt|undefined;
 if(action==='start'){if(!input||input.mode!==mode)throw Error('Invalid action inputs.');prompt=prepareOwnedGameAction(input).prompt;}
 return ownedComfyExecution(user,reference,mode,action,{...deps,workflow:async name=>name===mode?{outputNode:'911'}:null,submit:async(origin,_name,ref)=>{if(!prompt)throw Error('Workflow unavailable.');return deps.submitPrompt(origin,prompt,ref);}});
}
