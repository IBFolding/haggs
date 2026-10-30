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
 if(input.width*input.height*input.frames>100_000_000)throw Error('Guide exceeds the pixel limit.');
 const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
 for(const value of actors){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid actor.');
  const actor=value as Record<string,unknown>,path=actor.path??[[0,.5,.55]],events=actor.events??[],scale=actor.scale??.75,facing=actor.facing??1;
  if(!finite(scale)||scale<.1||scale>1.5||![1,-1].includes(facing as number))throw Error('Invalid actor settings.');
  if(!Array.isArray(path)||!path.length||path.length>500)throw Error('Invalid path.');const times=new Set<number>();
  for(const point of path){if(!Array.isArray(point)||point.length!==3||!point.every(finite)||point[0]!<0||point[1]!<0||point[1]!>1||point[2]!<0||point[2]!>1||times.has(point[0]!))throw Error('Invalid path.');times.add(point[0]!);}
  if(!Array.isArray(events)||events.length>500)throw Error('Invalid actions.');
  for(const e of events){if(!e||typeof e!=='object'||Array.isArray(e)||!['idle','walk','attack','dodge','hit','victory'].includes(e.action)||!finite(e.start)||!finite(e.end)||e.start<0||e.start>=e.end)throw Error('Invalid action.');}
 }

 return {availability:'unverified',outputNode:'911',prompt:{
  '900':{class_type:'HaggsActionGuide',inputs:{timeline_json:timeline,scene:input.scene,width:input.width,height:input.height,frame_count:input.frames}},
  '910':{class_type:'CreateVideo',inputs:{images:['900',0],fps:24,bit_depth:'auto',color_space:'sRGB'}},
  '911':{class_type:'SaveVideo',inputs:{video:['910',0],filename_prefix:'video/haggs-game/action-guide',format:'auto'}},
 }};
}
