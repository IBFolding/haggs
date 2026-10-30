import {test} from 'node:test';import assert from 'node:assert/strict';import {persistGameBundle} from './game-artifact-bundle';
const clip=new Uint8Array(Buffer.from('0000ftypisom0000'));
const branches=[0,1,2].map(i=>({node:'9000',name:`branch-${i}.mp4`,mime:'video/mp4',bytes:clip})).concat({node:'9000',name:'branches.json',mime:'application/json',bytes:new Uint8Array(Buffer.from(JSON.stringify({choices:['Walk','Dodge','Attack']})))});
test('bundle requires all safe artifacts before saving and can retry partial persistence',async()=>{
 const saved=new Map<string,string>();let failed=false,writes=0;
 const save=async(role:string)=>{if(!saved.has(role)){writes++;saved.set(role,`saved:${role}`);}if(role==='branch1'&&!failed){failed=true;throw Error('lost response');}return saved.get(role)!;};
 await assert.rejects(persistGameBundle('branches',branches.slice(0,3),save),/Incomplete/);assert.equal(writes,0);
 await assert.rejects(persistGameBundle('branches',branches,save),/lost response/);
 const out=await persistGameBundle('branches',branches,save);assert.equal(out.branch2,'saved:branch2');assert.equal(writes,4);
 const evil=branches.map(x=>({...x}));evil[0]!.bytes=new Uint8Array([1]);await assert.rejects(persistGameBundle('branches',evil,save),/video/);
});
