import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {modelRequirements} from './preflight';
import {prepare, type ApiPrompt, type Catalog, type UiWorkflow} from './convert';

const prompt: ApiPrompt = {'1':{class_type:'UNETLoader',inputs:{unet_name:'requested.safetensors'}}};
const catalog = (files:string[]):Catalog => ({UNETLoader:{input:{required:{unet_name:[files]}}}});
test('an empty model inventory cannot pass the preflight',()=>{
 assert.match(modelRequirements(prompt,catalog([])).join(' '),/requested.safetensors.*not confirmed/);
});
test('a similarly named model is not silently accepted',()=>{
 assert.equal(modelRequirements(prompt,catalog(['requested-fp8.safetensors'])).length,1);
 assert.equal(prompt['1']!.inputs.unet_name,'requested.safetensors');
});
test('an exact installed model passes, while an absent node explains the next action',()=>{
 assert.deepEqual(modelRequirements(prompt,catalog(['requested.safetensors'])),[]);
 assert.match(modelRequirements(prompt,{}).join(' '),/Missing node UNETLoader.*required node package/);
});
test('an unreported model inventory is unknown, not installed',()=>{
 assert.equal(modelRequirements(prompt,{UNETLoader:{input:{required:{unet_name:['STRING']}}}}).length,1);
});
for(const name of ['image_z_image_turbo','text_to_video_wan']) {
 test(`${name}: actual public graph fails closed against incomplete recorded inventory`,()=>{
  const ui=JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8')) as UiWorkflow;
  const c=JSON.parse(readFileSync(new URL('./fixtures/trajectory-vace.catalog.json',import.meta.url),'utf8')) as Catalog;
  const result=prepare(ui,c);
  assert.ok(Object.keys(result.prompt).length>0);
  assert.ok(result.problems.length>0,'incomplete catalog must not be treated as render readiness');
 });
}
