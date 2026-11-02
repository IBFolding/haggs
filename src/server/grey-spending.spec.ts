import {test} from 'node:test';import assert from 'node:assert/strict';
import {withGreySpending,verifiedGreyMaximum} from './grey-spending';
test('no customer, cap reservation, or verified maximum means no paid call',async()=>{
 let calls=0,reserves=0;const base={userId:'user',maximumUsd:1,reserve:async()=>{reserves++;return false;},finish:async()=>true};const run=async()=>{calls++;return {ok:true};};
 await withGreySpending({...base,userId:undefined},run);await withGreySpending({...base,maximumUsd:undefined},run);await withGreySpending(base,run);
 assert.equal(calls,0);assert.equal(reserves,1);for(const kind of ['proposal','still','video'] as const)assert.equal(verifiedGreyMaximum(kind),undefined);
});
test('uncertain reservations fail closed and unknown provider charges stay reserved',async()=>{
 let calls=0;const amounts:(number|null)[]=[];
 const base={userId:'user',maximumUsd:1,reserve:async()=>true,finish:async(_id:string,actual:number|null)=>{amounts.push(actual);return true;}};
 await withGreySpending({...base,reserve:async()=>{throw Error('uncertain commit');}},async()=>{calls++;});assert.equal(calls,0);
 await withGreySpending(base,async()=>{calls++;return {ok:true};});assert.deepEqual(amounts,[null]);
 await assert.rejects(()=>withGreySpending(base,async()=>{throw Error('provider timeout');}));assert.deepEqual(amounts,[null,null]);
});
test('known charges settle even on output failure; ambiguous reports and settlement errors retain safety',async()=>{
 const settled:(number|null)[]=[];const deps={userId:'one',maximumUsd:1,reserve:async()=>true,finish:async(_id:string,actual:number|null)=>{settled.push(actual);return true;}};
 await withGreySpending(deps,async report=>{report(.12);return {ok:false};});
 await assert.rejects(()=>withGreySpending(deps,async report=>{report(.2);throw Error('parse');}));
 await withGreySpending(deps,async report=>{report(.1);report(.01);});
 await withGreySpending(deps,async report=>{report(NaN);});
 assert.deepEqual(settled,[.12,.2,null,null]);
 const result=await withGreySpending({...deps,finish:async()=>{throw Error('unavailable');}},async report=>{report(.1);return 'output preserved';});assert.equal(result,'output preserved');
});
