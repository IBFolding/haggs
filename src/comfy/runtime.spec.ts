import test from 'node:test';import assert from 'node:assert/strict';import {workflowRuntime} from './runtime';import type {Catalog} from './convert';
const graph={'1':{class_type:'Example',inputs:{}}};
test('imported open workflow can select an existing local server without a cloud key',()=>{assert.deepEqual(workflowRuntime(graph,{Example:{api_node:false}} as unknown as Catalog,'127.0.0.1:8188',false),{kind:'local',base:'http://127.0.0.1:8188'});});
test('partner workflow cannot silently use local execution to avoid cloud key requirements',()=>{const catalog={Example:{api_node:true}} as unknown as Catalog;assert.throws(()=>workflowRuntime(graph,catalog,'127.0.0.1:8188',false),/needs a Comfy key/);assert.deepEqual(workflowRuntime(graph,catalog,'127.0.0.1:8188',true),{kind:'cloud'});});
test('local workflow still rejects public server destinations',()=>{assert.throws(()=>workflowRuntime(graph,{} as Catalog,'https://example.com',false),/Only ComfyUI/);});

test('explicit destinations never fall back to another execution location',()=>{
 const open={Example:{api_node:false}} as unknown as Catalog;
 const partner={Example:{api_node:true}} as unknown as Catalog;
 assert.deepEqual(workflowRuntime(graph,open,'127.0.0.1:8188',true,'cloud'),{kind:'cloud'});
 assert.throws(()=>workflowRuntime(graph,open,undefined,true,'local'),/No cloud fallback/);
 assert.throws(()=>workflowRuntime(graph,partner,'127.0.0.1:8188',true,'local'),/No cloud fallback/);
 assert.throws(()=>workflowRuntime(graph,open,'127.0.0.1:8188',false,'cloud'),/no local fallback/);
});
