import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idbKv } from './kv';

for (const abort of [false, true]) test(`IndexedDB batch settles on transaction ${abort ? 'abort' : 'commit'}, not individual puts`, async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const puts: unknown[][] = []; let closed = false; let tx: {oncomplete?:()=>void;onabort?:()=>void;onerror?:()=>void;error:Error|null} | undefined;
  const db = { close:()=>{closed=true;}, transaction:()=>{
    tx={error:abort?new Error('Quota exceeded'):null};
    return Object.assign(tx,{objectStore:()=>({put:(...args:unknown[])=>{puts.push(args);return {};}}),abort:()=>tx!.onabort?.()});
  }};
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open:()=>{
    const req:{result:typeof db;onsuccess?:()=>void}={result:db};queueMicrotask(()=>req.onsuccess?.());return req;
  }}});
  try {
    let settled=false;
    const write=idbKv().setMany!([['record',{atlas:true}],['index',['record']]]).then(()=>{settled=true;});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(puts.length,2);assert.equal(settled,false);
    if(abort){const rejected=assert.rejects(write,/Quota/);tx!.onabort!();await rejected;assert.equal(settled,false);}
    else{tx!.oncomplete!();await write;assert.equal(settled,true);}
    assert.equal(closed,true);
  } finally { if(prior)Object.defineProperty(globalThis,'indexedDB',prior);else Reflect.deleteProperty(globalThis,'indexedDB'); }
});
