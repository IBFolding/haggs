import {test} from 'node:test';import assert from 'node:assert/strict';import {shareDefinition} from './share-definition';
test('shared graph keeps wiring and models while removing supplied text, media and credentials',()=>{
 const out=JSON.parse(shareDefinition(JSON.stringify({'1':{class_type:'LoadImage',inputs:{image:'https://private.example/photo?token=secret',api_key:'secret'}},'2':{class_type:'Render',inputs:{image:['1',0],prompt:'private story',model:'wan.safetensors',seed:42,options:{token:'secret'}},_meta:{title:'Private name'}}})));
 assert.deepEqual(out['2'].inputs.image,['1',0]);assert.equal(out['2'].inputs.model,'wan.safetensors');assert.equal(out['2'].inputs.seed,42);assert.equal(out['2'].inputs.prompt,'');assert.equal(out['1'].inputs.api_key,'');assert.equal(out['1'].inputs.image,'');assert.equal(out['2']._meta,undefined);assert.equal(out['2'].inputs.options,null);
});
