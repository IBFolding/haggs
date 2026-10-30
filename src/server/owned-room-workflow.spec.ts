import {test} from 'node:test';import assert from 'node:assert/strict';import {prepareOwnedRoom} from './owned-room-workflow';
test('room mapping uses only supported node inputs and never marks managed execution ready',()=>{
 const result=prepareOwnedRoom({character:'robot',theme:'temple',prompt:' A room ',reference:{__type:'core/ASSET',info:{id:'image1'}}});
 assert.equal(result.availability,'unavailable');assert.equal(result.outputNode,'1');assert.equal(result.prompt['1']?.class_type,'HaggsPlayableWorld');assert.deepEqual(result.prompt['1']?.inputs.visual_reference,['2',0]);assert.deepEqual(result.prompt['2']?.inputs.image,{__type:'core/ASSET',info:{id:'image1'}});
 assert.throws(()=>prepareOwnedRoom({character:'robot',theme:'outside',prompt:'test'}),/settings/);
 assert.throws(()=>prepareOwnedRoom({character:'robot',theme:'temple',prompt:'test',reference:{__type:'core/ASSET',info:{id:'../bad'}}}),/reference/);
});
test('fake loopback transport receives the mapped graph without enabling real room execution',async()=>{
 const {createComfyManaged}=await import('../providers/comfy-managed');let received:unknown;
 const api=createComfyManaged({base:'http://127.0.0.1:8198',localTest:true,keep:async()=>{throw Error('not used');},fetch:async(_url,init)=>{received=JSON.parse(String(init?.body));return Response.json({id:'job1',urls:{self:'/api/v2/jobs/job1'}});}});
 const mapped=prepareOwnedRoom({character:'knight',theme:'dungeon',prompt:'test'});assert.equal(mapped.availability,'unavailable');
 await api.submit(mapped.prompt,'test-reference');assert.deepEqual((received as {workflow:unknown}).workflow,mapped.prompt);
});
