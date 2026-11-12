import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileShot} from './compile';
import {createProject,newShot} from './model';
import {promptFor} from './assemble';
import {getModelCard,MODELS} from '../catalog/models';
import {inputsFor} from './references';

test('continuity compilation uses the exact generation prompt, model image limit and coerced settings',()=>{
 const model=MODELS.find(m=>m.inputImages>0)!;
 const project={...createProject('Continuity'),shots:[{...newShot(),beat:'She crosses the doorway.',model:{id:model.id,settings:{unrecognized:'drop'}},refs:['/a.png','/b.png','/c.png','/d.png','/e.png','/f.png','/g.png','/h.png','/i.png']} ]};
 const brief=compileShot(project,0),card=getModelCard(model.id);
 assert.equal(brief.prompt,promptFor(project,0));
 assert.deepEqual(brief.images,inputsFor(project.shots[0]!,card.inputImages).images);
 assert.equal('unrecognized' in brief.settings,false);
 assert.deepEqual(brief.omittedReferences,project.shots[0]!.refs.filter(r=>!brief.images.includes(r)));
});
test('cast references are reported honestly and stale first frames block generation',()=>{
 const shot={...newShot(),model:{id:MODELS.find(m=>m.inputImages===0)!.id,settings:{}},beat:'She waits',threadIds:['actor','missing'],startsFrom:{shotId:'gone',sourceUrl:'/old.mp4',sourceAt:0,from:0,seconds:5,frameUrl:'/frame.png'}};
 const project={...createProject('Continuity'),shots:[shot],threads:[{id:'actor',kind:'character' as const,name:'Rowan',color:'blue',ref:'/rowan.png'}]};
 const brief=compileShot(project,0);
 assert.equal(brief.cast[0]!.included,false);
 assert.ok(brief.warnings.some(w=>w.includes('Rowan')));
 assert.ok(brief.warnings.some(w=>w.includes('missing')));
 assert.ok(brief.blockers.some(w=>w.includes('previous clip changed')));
 assert.ok(brief.prompt.includes('Rowan'),'assigned cast is compiled into the real prompt');
});

test('character reference is compiled as reference, never promoted into starting frame',()=>{
 const model=MODELS.find(m=>m.inputImages>0)!;
 const shot={...newShot(),model:{id:model.id,settings:{}},beat:'She waits',threadIds:['actor']};
 const project={...createProject('Cast'),shots:[shot],threads:[{id:'actor',kind:'character' as const,name:'Rowan',color:'blue',ref:'/rowan.png'}]};
 const brief=compileShot(project,0);
 assert.deepEqual(brief.images,['/rowan.png']);assert.equal(brief.firstFrame,false);assert.equal(brief.cast[0]!.included,true);
});
