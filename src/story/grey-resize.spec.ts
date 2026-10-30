import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draggedWidth} from './grey-resize';
test('tall and rotated objects shrink smoothly from the starting corner without jumping',()=>{
 const distance=Math.hypot(100,400);
 assert.equal(draggedWidth(.25,distance,distance),.25);
 assert.equal(draggedWidth(.25,distance,distance/2),.125);
 assert.equal(draggedWidth(.25,distance,0),.03);
 assert.equal(draggedWidth(.25,distance,distance*20),1.5);
 assert.equal(draggedWidth(.25,0,10),.25);
});
