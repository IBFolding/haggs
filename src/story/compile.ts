import { getModelCard } from '../catalog/models';
import { coerceSettings } from '../catalog/settings';
import { promptFor } from './assemble';
import { acceptsStartFrame, continuityStale } from './continuity';
import { inputsFor, renderSeconds } from './references';
import type { Project } from './model';

/** Shared by generation and inspection. Never calls a provider or mutates the board. */
export function compileShot(project: Project, index: number) {
 const shot=project.shots[index];
 if(!shot) throw Error('That shot is not on the board any more.');
 const card=getModelCard(shot.model.id), prompt=promptFor(project,index);
 const actors=project.threads.filter(t=>t.kind==='character'&&shot.threadIds.includes(t.id));
 const references=[...new Set([...(shot.refs??[]),...actors.flatMap(t=>t.ref?[t.ref]:[])])];
 const {images,firstFrame}=inputsFor({...shot,refs:references},card.inputImages);
 const settings=coerceSettings(card.settings,shot.model.settings);
 const seconds=renderSeconds(shot,card.settings.duration);
 if(seconds!==null) settings.duration=seconds;
 const endFrame=firstFrame&&shot.endsOn?shot.endsOn:undefined;
 const blockers:string[]=[], warnings:string[]=[];
 if(!prompt.trim()) blockers.push('Give the shot a beat before generating it.');
 if(shot.startsFrom&&continuityStale(project,shot)) blockers.push('The previous clip changed. Update or remove its starting-frame dependency before generating this shot.');
 if(shot.startsFrom&&!acceptsStartFrame(shot)) blockers.push('This model does not accept a video starting frame. Choose a supported video model or remove the dependency.');
 const omittedReferences=references.filter(ref=>!images.includes(ref));
 if(omittedReferences.length) warnings.push(`${omittedReferences.length} reference(s) excluded by this model's ${card.inputImages}-image limit.`);
 const cast=actors.map(t=>({id:t.id,name:t.name,reference:t.ref??null,included:!!t.ref&&images.includes(t.ref)}));
 for(const actor of cast) if(!actor.included) warnings.push(`${actor.name}: ${actor.reference?'cast reference is not attached to this request':'no cast reference saved'}.`);
 for(const id of shot.threadIds) if(!project.threads.some(t=>t.id===id)) warnings.push(`Missing continuity thread: ${id}.`);
 if(shot.endsOn&&!endFrame) warnings.push('End frame is not sent because there is no supported starting frame.');
 return {shotId:shot.id,model:shot.model.id,modelName:card.name,prompt,settings,images,firstFrame,...(endFrame?{endFrame}:{}),cast,omittedReferences,blockers,warnings,
  direction:{...project.direction,...shot.direction},previousShotId:project.shots[index-1]?.id??null,
  voices:(shot.voices??[]).map(v=>({speaker:v.speaker,text:v.text,voice:v.voice,hasAudio:!!v.url})),
 };
}
