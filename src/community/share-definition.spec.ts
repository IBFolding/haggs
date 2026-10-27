import {test} from 'node:test';import assert from 'node:assert/strict';import {shareDefinition} from './share-definition';
test('shared graph keeps wiring and models while removing supplied text, media and credentials',()=>{
 const out=JSON.parse(shareDefinition(JSON.stringify({'1':{class_type:'LoadImage',inputs:{image:'https://private.example/photo?token=secret',api_key:'secret'}},'2':{class_type:'Render',inputs:{image:['1',0],prompt:'private story',model:'wan.safetensors',seed:42,options:{token:'secret'}},_meta:{title:'Private name'}}})));
 assert.deepEqual(out['2'].inputs.image,['1',0]);assert.equal(out['2'].inputs.model,'wan.safetensors');assert.equal(out['2'].inputs.seed,42);assert.equal(out['2'].inputs.prompt,'');assert.equal(out['1'].inputs.api_key,'');assert.equal(out['1'].inputs.image,'');assert.equal(out['2']._meta,undefined);assert.equal(out['2'].inputs.options,null);
});
test('a saved app in the editor format is shared with its wiring and models, without titles, notes or supplied values',()=>{
 const ui={nodes:[
  {id:1,type:'LoadImage',title:'My daughter',pos:[10,20],size:[300,200],properties:{secret:'x'},inputs:[],outputs:[{name:'IMAGE',type:'IMAGE',links:[1],slot_index:0}],widgets_values:['family-photo.png','image']},
  {id:2,type:'KSampler',inputs:[{name:'image',type:'IMAGE',link:1}],outputs:[],widgets_values:[42,'randomize',20,7,'euler','normal',1]},
  {id:3,type:'CLIPTextEncode',inputs:[],outputs:[],widgets_values:['a private story about https://example.com?token=abc']},
  {id:4,type:'CheckpointLoaderSimple',inputs:[],outputs:[],widgets_values:['wan2.1_t2v_14B.safetensors']},
  {id:5,type:'VHS_LoadVideo',inputs:[],outputs:[],widgets_values:{video:'clip.mp4',api_key:'sk-secret',model:'wan.safetensors',frame_rate:24}},
 ],links:[[1,1,0,2,0,'IMAGE']],groups:[{title:'Secret plan'}],extra:{ds:{scale:1}}};
 const out=JSON.parse(shareDefinition(JSON.stringify(ui)));
 assert.deepEqual(out.links,[[1,1,0,2,0,'IMAGE']]);assert.equal(out.groups,undefined);assert.equal(out.extra,undefined);
 assert.equal(out.nodes[0].title,undefined);assert.equal(out.nodes[0].properties,undefined);assert.deepEqual(out.nodes[0].pos,[10,20]);
 assert.deepEqual(out.nodes[0].widgets_values,['','image']);
 assert.deepEqual(out.nodes[1].widgets_values,[42,'randomize',20,7,'euler','normal',1]);assert.equal(out.nodes[1].inputs[0].link,1);
 assert.deepEqual(out.nodes[2].widgets_values,['']);
 assert.deepEqual(out.nodes[3].widgets_values,['wan2.1_t2v_14B.safetensors']);
 assert.deepEqual(out.nodes[4].widgets_values,{video:'',api_key:'',model:'wan.safetensors',frame_rate:24});
 assert.ok(!JSON.stringify(out).includes('secret')&&!JSON.stringify(out).includes('daughter'));
});
test('shared editor-format templates still convert to the same runnable graph',async()=>{
 const {readFileSync}=await import('node:fs');const {toApiPrompt}=await import('../comfy/convert');
 const at=(f:string)=>JSON.parse(readFileSync(new URL(`../comfy/fixtures/${f}.json`,import.meta.url),'utf8'));
 const catalog=at('catalog');
 for(const f of ['api_nano_banana_2_1_t2i','template_qwen_multiangle.app','3d_moge_perspective_to_mesh']){
  const ui=at(f);const before=toApiPrompt(ui,catalog),after=toApiPrompt(JSON.parse(shareDefinition(JSON.stringify(ui))),catalog);
  assert.deepEqual(Object.keys(after.prompt).sort(),Object.keys(before.prompt).sort(),f);assert.deepEqual(after.problems,[],f);
  for(const [id,n] of Object.entries(before.prompt))for(const [k,v] of Object.entries(n.inputs))if(Array.isArray(v))assert.deepEqual(after.prompt[id]!.inputs[k],v,`${f} ${id}.${k}`);
 }
});
