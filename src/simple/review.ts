import type {Project} from '../story/model';
import {view} from '../story/boards';
import {buildCut} from '../story/cut';
export type Finding={severity:'error'|'review';message:string;shot?:string};
/** Metadata preflight only. Does not claim to judge acting, identity, image artifacts or audio quality. */
export function reviewFilm(project:Project,board:string):Finding[]{
 const p=view(project,board),cut=buildCut(p),out:Finding[]=[];
 for(const s of p.shots){if(!s.render)out.push({severity:'error',shot:s.id,message:`${s.heading||'A shot'} has no selected picture or video.`});if((s.voices??[]).some(v=>!v.url))out.push({severity:'error',shot:s.id,message:`${s.heading||'A shot'} has a voice line that has not been spoken.`});if(s.caption&&s.caption.length>90)out.push({severity:'review',shot:s.id,message:`${s.heading||'A shot'} has a long title/caption. Check its reading time and placement.`});if(s.fit==='fill'&&!s.focus&&!s.reframe)out.push({severity:'review',shot:s.id,message:`${s.heading||'A shot'} uses a centered crop. Check that the subject stays in frame.`});}
 if(!cut.clips.length)out.push({severity:'error',message:'There is no selected media to export.'});
 if(cut.voices.length&&cut.music&&!(p.sound?.duck))out.push({severity:'review',message:'Music is not ducked under dialogue. Listen for masked words.'});
 if(cut.voices.length&&!(p.sound?.clipMute)&&((p.sound?.clipGain??0)>-6))out.push({severity:'review',message:'Video audio may overlap the narration. Listen to both tracks together.'});
 if((p.effects??[]).some(e=>e.start<0||e.start+e.seconds>cut.total+.05))out.push({severity:'error',message:'A sound effect extends beyond the cut.'});
 if((p.overlays??[]).some(o=>o.start<0||o.start+o.seconds>cut.total+.05))out.push({severity:'error',message:'An overlay extends beyond the cut.'});
 if(!p.sound?.loud)out.push({severity:'review',message:'Loudness normalization is off. Check the final playback level.'});return out;
}
