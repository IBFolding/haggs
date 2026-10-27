import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedWorkflowCost} from './bounded-price';
import type {Catalog} from './convert';
const catalog={Video:{api_node:true},LoadImage:{},KSampler:{}} as unknown as Catalog;
const price={nodes:[{node:'1',name:'Video',min:.03,max:.03,perSecond:true,label:'rate'}],min:.03,max:.03,perSecond:true,label:'rate'};
test('reservation uses exact duration and fails closed for missing price or native runtime',()=>{
 assert.equal(boundedWorkflowCost({'1':{class_type:'Video',inputs:{duration:4}}},catalog,price),.12);
 assert.equal(boundedWorkflowCost({'1':{class_type:'Video',inputs:{duration:12}}},catalog,price),.36);
 for(const duration of [undefined,-1,Infinity,['2',0]]) assert.equal(boundedWorkflowCost({'1':{class_type:'Video',inputs:{duration}}},catalog,price),null);
 assert.equal(boundedWorkflowCost({'1':{class_type:'Video',inputs:{duration:4}},'2':{class_type:'KSampler',inputs:{}}},catalog,price),null);
 assert.equal(boundedWorkflowCost({'1':{class_type:'Video',inputs:{duration:4}}},catalog,{...price,nodes:[]}),null);
});
