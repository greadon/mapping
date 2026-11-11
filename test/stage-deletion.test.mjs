import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyStage,emptyProject,History,validateProject,syncSectionIdentifiers} from '../public/draft.js';

function editorFor(project){
  const editor=Object.create(StageEditor.prototype);
  Object.assign(editor,{local:true,data:{event:{eventId:'local'},stages:Object.entries(project.stages).map(([stageId,stage])=>({stageId,name:stage.title||stageId}))},history:new History(project),stageId:Object.keys(project.stages)[0],liveRoute:{cancel(){}},notice(){},fit(){},prepareSwitch:()=>true});
  editor.change=action=>editor.history.commit(action);
  return editor;
}

test('deleting a section removes its contents and order entry; Undo restores everything',()=>{
  const project=emptyProject('local');project.stages.one={...emptyStage(),title:'One',route:[[52,-3],[53,-2]]};project.stages.two={...emptyStage(),sectionType:'liaison'};project.sectionOrder=['one','two'];
  const editor=editorFor(project);editor.deleteStage();
  assert.equal(editor.project.stages.one,undefined);assert.deepEqual(editor.project.sectionOrder,['two']);assert.equal(editor.stageId,'two');
  assert.deepEqual(validateProject(editor.project,'local'),editor.project);
  editor.history.undo();assert.deepEqual(editor.project,project);editor.history.redo();assert.equal(editor.project.stages.one,undefined);
});

test('the last local stage can be deleted and connected stages cannot be deleted',()=>{
  const project=emptyProject('local');project.stages.one=emptyStage();project.sectionOrder=['one'];
  const connected=editorFor(project);connected.local=false;connected.deleteStage();assert.deepEqual(connected.project,project);
  const editor=editorFor(project);editor.deleteStage();assert.deepEqual(editor.project.stages,{});assert.deepEqual(editor.project.sectionOrder,[]);assert.equal(editor.stageId,'');
  assert.deepEqual(validateProject(editor.project,'local'),editor.project);
});

test('deleting is blocked when an existing draft cannot be saved',()=>{
  const project=emptyProject('local');project.stages.one=emptyStage();const editor=editorFor(project);editor.prepareSwitch=()=>false;editor.deleteStage();assert.deepEqual(editor.project,project);
});

test('deleting while editing cancels the pending preview and Undo restores the saved section',()=>{
  const project=emptyProject('local');project.stages.one={...emptyStage(),title:'Original',route:[[52,-3],[53,-2]]};project.sectionOrder=['one'];
  const editor=editorFor(project);editor.working=[[51,-4],[52,-3]];editor.workingSectionName='Unsaved';editor.workingSectionType='liaison';editor.prepareSwitch=()=>false;
  let cancelled=false;editor.liveRoute.cancel=()=>{cancelled=true;};editor.deleteStage();
  assert.equal(cancelled,true);assert.equal(editor.working,null);assert.equal(editor.workingSectionName,null);assert.deepEqual(editor.project.stages,{});
  editor.history.undo();assert.deepEqual(editor.project,project);
});

test('reopening does not recreate the deleted initial stage or populate an empty saved map',t=>{
  const original={document:globalThis.document,localStorage:globalThis.localStorage,Option:globalThis.Option};
  t.after(()=>{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  globalThis.document={getElementById:()=>({replaceChildren(){}})};globalThis.Option=class{};
  for(const stages of [{two:{...emptyStage(),title:'Kept stage',identifier:'SS2'}},{}]){
    const project={...emptyProject('local'),stages,sectionOrder:Object.keys(stages)};
    globalThis.localStorage={getItem:()=>JSON.stringify(project)};
    const editor=editorFor(project);editor.render=()=>{};editor.open({event:{eventId:'local'},stages:[{stageId:'local-1',identifier:'SS1',name:'Stage 1'}]},{scope:'local',local:true});
    syncSectionIdentifiers(project);assert.deepEqual(editor.project,project);assert.deepEqual(editor.data.stages.map(stage=>stage.stageId),Object.keys(stages));
  }
});
