import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyProject,emptyStage,History,syncSectionIdentifiers,validateProject} from '../public/draft.js';
test('stage identifiers follow displayed sequence on reopen, reorder and undo',()=>{
  const project=emptyProject('event');project.stages.a={...emptyStage(),identifier:'SS6',title:'Forest'};project.stages.b={...emptyStage(),identifier:'SS8',title:'Hill'};project.stages.c={...emptyStage(),sectionType:'liaison'};project.sectionOrder=['a','b','c'];syncSectionIdentifiers(project);
  assert.equal(project.stages.a.identifier,'SS1');assert.equal(project.stages.b.identifier,'SS2');assert.equal(project.stages.c.identifier,'L1');
  const editor=Object.create(StageEditor.prototype);Object.assign(editor,{history:new History(project),prepareSwitch:()=>true,save(){return true;},render(){},notice(){}});
  editor.moveSection('b','a');assert.equal(editor.project.stages.b.identifier,'SS1');assert.equal(editor.project.stages.a.identifier,'SS2');assert.equal(editor.project.stages.a.title,'Forest');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(editor.project)),'event'),editor.project);
  editor.history.undo();assert.equal(editor.project.stages.a.identifier,'SS1');editor.history.redo();assert.equal(editor.project.stages.b.identifier,'SS1');
});

test('interleaved stages and liaisons have independent sequences after reordering',()=>{
 const project=emptyProject('event');for(const id of ['a','b','c','d'])project.stages[id]=emptyStage();project.stages.b.sectionType='liaison';project.stages.d.sectionType='liaison';project.sectionOrder=['a','b','c','d'];syncSectionIdentifiers(project);
 assert.deepEqual(project.sectionOrder.map(id=>project.stages[id].identifier),['SS1','L1','SS2','L2']);
 project.sectionOrder=['d','c','b','a'];syncSectionIdentifiers(project);assert.deepEqual(project.sectionOrder.map(id=>project.stages[id].identifier),['L1','SS1','L2','SS2']);
});
