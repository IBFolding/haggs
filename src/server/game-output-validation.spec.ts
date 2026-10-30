import {test} from 'node:test';import assert from 'node:assert/strict';import {validateAtlasMetadata,validateBranchLabels} from './game-output-validation';
const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(128,16);png.writeUInt32BE(64,20);
const encode=(o:unknown)=>Buffer.from(JSON.stringify(o));
test('atlas validation accepts bounded frame rectangles and discards provider paths',()=>{
 const frames=[{frame:0,x:0,y:0,width:64,height:64},{frame:1,x:64,y:0,width:64,height:64}];
 assert.deepEqual(validateAtlasMetadata(encode({image:'atlas.png',fps:24,frames,untrusted:'https://evil.example'}),png),{fps:24,frames});
 assert.throws(()=>validateAtlasMetadata(encode({image:'https://evil.example/a.png',fps:24,frames}),png),/metadata/);
 assert.throws(()=>validateAtlasMetadata(encode({image:'atlas.png',fps:24,frames:[{...frames[1],frame:0,x:100}]}),png),/frame/);
 assert.throws(()=>validateAtlasMetadata(encode({image:'atlas.png',fps:24,frames}),Buffer.from('not a png')),/size|image/);
});
test('branch player receives only bounded labels',()=>{assert.deepEqual(validateBranchLabels(['Walk','Dodge','Attack']),['Walk','Dodge','Attack']);assert.throws(()=>validateBranchLabels(['one','two','\n']),/labels/);assert.throws(()=>validateBranchLabels(['one']),/labels/);});
