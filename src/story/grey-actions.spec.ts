import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyGreyActions,quickGreyPlan,sceneRevision,greyProposalSchema} from './grey-actions';
import {addProp,updateProp} from './grey-scene';
const scene=addProp({source:{url:'/clip.mp4',kind:'video',trimIn:2}}, {url:'/lamp.png',name:'Lamp'});
const id=scene.props![0]!.id;
test('quick edits produce reviewable operations and preserve original media',()=>{
 const next=applyGreyActions(scene,quickGreyPlan(scene,id,'Make it 50% smaller'));
 assert.equal(next.props![0]!.w,.125);assert.deepEqual(next.source,scene.source);assert.equal(scene.props![0]!.w,.25);
 assert.notEqual(sceneRevision(next),sceneRevision(scene));
});
test('plans reject unknown operations, unsafe assets and ambiguous commands',()=>{
 assert.throws(()=>applyGreyActions(scene,[{type:'shell',command:'rm'}]));
 assert.throws(()=>applyGreyActions(scene,[{type:'object.add',name:'x',url:'javascript:alert(1)'}]));
 assert.throws(()=>quickGreyPlan(scene,null,'make it smaller'));
 assert.throws(()=>quickGreyPlan(scene,id,'make it smaller and delete everything'));
 assert.throws(()=>greyProposalSchema.parse({shotId:'s',actions:[],revision:'x'}));
});
test('locked and deleted targets reject whole plans without partial mutation',()=>{
 const locked=updateProp(scene,id,{locked:true});
 assert.throws(()=>applyGreyActions(locked,[{type:'lighting.add',kind:'key'},{type:'object.scale',id,factor:.5}]));
 assert.equal(locked.lights,undefined);
 assert.throws(()=>applyGreyActions(scene,[{type:'object.move',id:'gone',x:.5,y:.5}]));
});
test('batch plans survive JSON and apply bounded transforms and lighting',()=>{
 const actions=[{type:'object.scale',id,factor:20},{type:'object.move',id,x:.2,y:.6},{type:'lighting.add',kind:'key'}];
 const next=applyGreyActions(scene,JSON.parse(JSON.stringify(actions)));
 assert.equal(next.props![0]!.w,1.5);assert.equal(next.props![0]!.x,.2);assert.equal(next.lights?.length,1);
});
test('revision tolerates normalization and key order but catches actual changes',()=>{
 const reordered={props:scene.props!,source:scene.source!};
 assert.equal(sceneRevision(scene),sceneRevision(reordered));
 assert.notEqual(sceneRevision(scene),sceneRevision(updateProp(scene,id,{x:.2})));
});
test('scale updates animated size keys instead of being hidden by them',()=>{
 const keyed=updateProp(scene,id,{keys:[{t:0,w:.2},{t:2,w:.4}]});
 const next=applyGreyActions(keyed,[{type:'object.scale',id,factor:.5}]);
 assert.deepEqual(next.props![0]!.keys,[{t:0,w:.1},{t:2,w:.2}]);
});
