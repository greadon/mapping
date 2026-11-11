import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,emptyStage,validateProject,removeLeg,History} from '../public/draft.js';
import {StageEditor} from '../public/editor.js';

test('moving into empty and collapsed legs preserves grouped order and supports Undo',()=>{
  const project=emptyProject('event');project.legs=[{id:'one',name:'Leg 1',color:'#123456'},{id:'two',name:'Leg 2',color:'#654321'}];
  project.stages.a={...emptyStage(),legId:'one'};project.stages.b={...emptyStage(),legId:'one'};project.sectionOrder=['a','b'];
  const editor=Object.create(StageEditor.prototype);
  Object.assign(editor,{history:new History(project),collapsedLegs:new Set(['two']),prepareSwitch:()=>true,save(){return true;},render(){},notice(){}});
  editor.moveSectionToLeg('a','two');assert.equal(editor.project.stages.a.legId,'two');assert.deepEqual(editor.project.sectionOrder,['b','a']);
  assert.equal(editor.collapsedLegs.has('two'),true);
  editor.moveSectionToLeg('b','two');assert.deepEqual(editor.project.sectionOrder,['a','b']);
  editor.moveSectionToLeg('a','');assert.equal(editor.project.stages.a.legId,undefined);assert.deepEqual(editor.project.sectionOrder,['b','a']);
  editor.history.undo();assert.equal(editor.project.stages.a.legId,'two');
  editor.moveSectionToLeg('a','missing');assert.equal(editor.project.stages.a.legId,'two');
  editor.prepareSwitch=()=>false;editor.moveSectionToLeg('a','one');assert.equal(editor.project.stages.a.legId,'two');
});

test('dragging adjacent sections into a leg assigns membership and Undo restores it',()=>{
  const project=emptyProject('event');project.legs=[{id:'day1',name:'Leg 1',color:'#ab45ef'}];
  project.stages.a={...emptyStage(),legId:'day1'};project.stages.b=emptyStage();project.sectionOrder=['a','b'];
  const editor=Object.create(StageEditor.prototype);
  Object.assign(editor,{history:new History(project),prepareSwitch:()=>true,save(){return true;},render(){},notice(){}});
  editor.moveSection('b','a',true);
  assert.equal(editor.project.stages.b.legId,'day1');
  assert.deepEqual(editor.project.sectionOrder,['a','b']);
  editor.history.undo();assert.equal(editor.project.stages.b.legId,undefined);
});

test('leg assignments and colours survive reopening and undo',()=>{
  const project=emptyProject('event');project.legs=[{id:'day1',name:'Leg 1',color:'#ab45ef'}];
  project.stages.a={...emptyStage(),legId:'day1'};
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),'event'),project);
  const history=new History(project);
  history.commit(draft=>{draft.legs[0].color='#123456';delete draft.stages.a.legId;removeLeg(draft,'day1');});
  assert.equal(history.project.legs.length,0);
  history.undo();assert.deepEqual(history.project,project);
});
test('only empty legs can be removed and invalid assignments cannot be imported',()=>{
  const project=emptyProject('event');project.legs=[{id:'day1',name:'Leg 1',color:'#ab45ef'}];
  project.stages.a={...emptyStage(),legId:'day1'};
  assert.throws(()=>removeLeg(project,'day1'),/Only empty/);assert.equal(project.legs.length,1);
  project.stages.a.legId='missing';assert.throws(()=>validateProject(project,'event'),/unknown leg/);
  delete project.stages.a.legId;project.legs[0].color='invalid';assert.throws(()=>validateProject(project,'event'),/colour/);
});
