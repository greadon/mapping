import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
test('deleting a waypoint updates the preview and cancels pending automatic finish',()=>{
  let updates=0;const editor=Object.create(StageEditor.prototype);
  Object.assign(editor,{working:[[52,0],[52,1],[52,2]],selected:{layer:'vertex',id:1},finishAtStop:true,pendingStopPoint:[52,2],updateRoute(){updates++;}});
  editor.deleteWaypoint(1);assert.deepEqual(editor.working,[[52,0],[52,2]]);assert.equal(updates,1);assert.equal(editor.selected,null);assert.equal(editor.finishAtStop,false);assert.equal(editor.pendingStopPoint,null);
  editor.deleteWaypoint(5);assert.equal(updates,1);editor.busy=true;editor.deleteWaypoint(0);assert.equal(editor.working.length,2);
});
