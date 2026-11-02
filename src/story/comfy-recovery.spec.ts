import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasAmbiguousLegacy,recoveryId,unrecovered} from './comfy-recovery';

test('outputs with the same filename in different folders remain distinct',()=>{
 const a={job:'job-1',filename:'render.mp4',subfolder:'one'},b={...a,subfolder:'two'};
 assert.notEqual(recoveryId(a),recoveryId(b));
 assert.deepEqual(unrecovered([a,b],new Set([recoveryId(a)])),[b]);
 assert.deepEqual(unrecovered([a,b],new Set(['job-1:render.mp4'])),[a,b],'ambiguous old entries do not hide either candidate');
 assert.equal(hasAmbiguousLegacy([a,b],new Set(['job-1:render.mp4'])),true);
 assert.equal(hasAmbiguousLegacy([a,b],new Set([recoveryId(a)])),false);
});
test('unambiguous legacy records are still recognized and duplicate outputs do not confuse them',()=>{
 const a={job:'job-1',filename:'render.mp4',subfolder:'one'},b={...a,job:'job-2'};
 assert.deepEqual(unrecovered([a,{...a},b],new Set(['job-1:render.mp4'])),[b]);
 assert.equal(hasAmbiguousLegacy([a,{...a},b],new Set(['job-1:render.mp4'])),false);
 assert.deepEqual(unrecovered([a,{...a},b],new Set()),[a,b]);
 assert.deepEqual(unrecovered([a,b],new Set([recoveryId(a),'job-2:render.mp4'])),[]);
});
