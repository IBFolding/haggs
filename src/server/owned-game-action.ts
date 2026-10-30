import type {ApiPrompt} from '../comfy/convert';

/** Draft mapping of the two bundled no-model Action Guide graphs. It does not enable execution. */
export function prepareOwnedGameAction(input:{mode:'drag-to-action'|'boss-fight';timeline:unknown;scene:string;width:number;height:number;frames:number}):{prompt:ApiPrompt;outputNode:string;availability:'unverified'} {
 if(!['drag-to-action','boss-fight'].includes(input.mode))throw Error('Unknown action workflow.');
 if(typeof input.scene!=='string'||!input.scene.trim()||input.scene.length>4000)throw Error('Invalid scene.');
 for(const [value,min,max] of [[input.width,128,1280],[input.height,128,768],[input.frames,5,583]] as const)if(!Number.isInteger(value)||value<min||value>max)throw Error('Invalid dimensions or frame count.');
 if(input.width%32||input.height%32||(input.frames-5)%17)throw Error('Unsupported dimensions or frame count.');
 if(!input.timeline||typeof input.timeline!=='object'||Array.isArray(input.timeline))throw Error('Invalid timeline.');
 const timeline=JSON.stringify(input.timeline);if(!timeline||timeline.length>20000)throw Error('Invalid timeline.');
 const actors=(input.timeline as {actors?:unknown}).actors;
 if(!Array.isArray(actors)||actors.length!==(input.mode==='boss-fight'?2:1))throw Error('Invalid actor count.');
 return {availability:'unverified',outputNode:'911',prompt:{
  '900':{class_type:'HaggsActionGuide',inputs:{timeline_json:timeline,scene:input.scene,width:input.width,height:input.height,frame_count:input.frames}},
  '910':{class_type:'CreateVideo',inputs:{images:['900',0],fps:24,bit_depth:'auto',color_space:'sRGB'}},
  '911':{class_type:'SaveVideo',inputs:{video:['910',0],filename_prefix:'video/haggs-game/action-guide',format:'auto'}},
 }};
}
