import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,displayDistance,validateProject} from '../public/draft.js';
import {StageEditor} from '../public/editor.js';
test('event name and unit preference round trip without a StageMode connection',()=>{
  const project={...emptyProject('local'),eventName:'Forest Rally',units:'mi'};
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),'local'),project);
  assert.equal(displayDistance(1.609344,'mi'),'1.00 mi');assert.equal(displayDistance(1.609344,'km'),'1.61 km');
  assert.throws(()=>validateProject({...project,units:'invalid'},'local'),/units/);
  const editor=Object.create(StageEditor.prototype);editor.history={project};assert.equal(editor.displaySpeed(70),70);project.units='km';assert.equal(editor.displaySpeed(70),112.7);
});
