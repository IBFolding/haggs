import {resolveOwnedInputs,type Journal} from './owned-input-upload';import {prepareOwnedReskin,prepareOwnedSceneBranches} from './owned-game-bundle-workflow';
/** Caller supplies authenticated identity and a server-selected deployment; asset IDs never come from the client. */
export async function prepareOwnedGameMedia(user:string,reference:string,deployment:string,journal:Journal,input:{mode:'reskin';style:string;width:number;height:number;frames:number;threshold:number}|{mode:'branches';labels:string[]},now=Date.now()){
 const fields=input.mode==='reskin'?['899/file']:['1/file','2/file','3/file'];const assets=await resolveOwnedInputs(user,reference,deployment,journal,fields,now);
 return input.mode==='reskin'?prepareOwnedReskin({...input,video:assets['899/file']!}):prepareOwnedSceneBranches(fields.map(f=>assets[f]!),input.labels);
}
