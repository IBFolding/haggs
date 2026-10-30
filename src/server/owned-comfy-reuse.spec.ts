import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedPortalPaint} from './owned-comfy-reuse';
const asset=(id:string)=>({__type:'core/ASSET' as const,info:{id}});
const assets={'1/file':asset('layer-1'),'10001/file':asset('source-1'),'10002/audio':asset('audio-1')};
test('portal paint binds only its allowed controls and uploaded assets',()=>{
 const {prompt,outputNode}=prepareOwnedPortalPaint({'10000/amount':0.5},assets);
 assert.equal(outputNode,'10004');assert.equal(prompt['10000']?.inputs.amount,0.5);assert.deepEqual(prompt['1']?.inputs.file,asset('layer-1'));
 assert.throws(()=>prepareOwnedPortalPaint({'10000/amount':2},assets),/range/);
 assert.throws(()=>prepareOwnedPortalPaint({'10000/unknown':1},assets),/Unknown/);
 assert.throws(()=>prepareOwnedPortalPaint({}, {'1/file':asset('layer')}),/required media/);
 assert.throws(()=>prepareOwnedPortalPaint({}, {...assets,'1/file':asset('../unsafe')}),/Invalid/);
});
