import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFavoriteWriter} from './favorite-writer';

test('rapid changes are persisted in order and snapshot their input',async()=>{
 const saved:string[][]=[];let release!:()=>void;
 const pending=new Promise<void>(resolve=>{release=resolve;});
 const write=createFavoriteWriter(async value=>{if(saved.length===0)await pending;saved.push(value);});
 const first=['one'],a=write(first),b=write(['one','two']);first.push('mutated');
 await Promise.resolve();assert.deepEqual(saved,[]);release();await Promise.all([a,b]);
 assert.deepEqual(saved,[['one'],['one','two']]);
});
test('a later save still runs after an earlier failure',async()=>{
 let count=0;const saved:string[][]=[];const write=createFavoriteWriter(async value=>{if(++count===1)throw Error('storage error');saved.push(value);});
 const a=write(['one']),b=write(['one','two']);await assert.rejects(a,/storage error/);await b;assert.deepEqual(saved,[['one','two']]);
});
