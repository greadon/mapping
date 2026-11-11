import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyProject,emptyStage,reuseStage,History,validateProject,linkMatchingStages} from '../public/draft.js';
test('linked edits sync in both directions while preserving names, legs and timings with Undo',()=>{
  const project=emptyProject('event');project.legs=[{id:'am',name:'AM',color:'#123456'},{id:'pm',name:'PM',color:'#654321'}];
  project.stages.a={...emptyStage(),title:'Morning',legId:'am',route:[[0,0],[0,1]],controls:[{id:'start',name:'Start',kind:'Start',point:[0,0],notes:'',locationId:''}],averageSpeedMph:70,targetTime:'01:00'};
  reuseStage(project,'a',{id:'b',name:'Afternoon',legId:'pm'});project.stages.b.averageSpeedMph=50;project.stages.b.targetTime='01:30';
  const editor=Object.create(StageEditor.prototype);Object.assign(editor,{history:new History(project),save(){return true;},render(){}});
  editor.saveMarkerFields('a','controls','start',{notes:'Gate key required',services:{radio:true,auxiliaryRadio:false,dataTracking:false,recovery:false,medic:true}});
  assert.equal(editor.project.stages.b.controls[0].notes,'Gate key required');assert.equal(editor.project.stages.b.controls[0].services.medic,true);
  editor.saveMarkerFields('b','controls','start',{controlName:'Shared start'});assert.equal(editor.project.stages.a.controls[0].controlName,'Shared start');
  assert.equal(editor.project.stages.a.title,'Morning');assert.equal(editor.project.stages.b.title,'Afternoon');assert.equal(editor.project.stages.b.legId,'pm');assert.equal(editor.project.stages.b.targetTime,'01:30');assert.equal(editor.project.stages.b.averageSpeedMph,50);
  editor.change(draft=>{draft.stages.b.route=[[0,0],[0,2]];draft.stages.b.junctions=[{id:'new',name:'Post 1',kind:'Junction',number:1,point:[0,1],notes:'',locationId:''}];});
  assert.deepEqual(editor.project.stages.a.route,editor.project.stages.b.route);assert.deepEqual(editor.project.stages.a.junctions,editor.project.stages.b.junctions);assert.equal(editor.project.stages.b.averageSpeedMph,50);assert.equal(editor.project.stages.a.averageSpeedMph,70);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(editor.project)),'event'),editor.project);
  editor.history.undo();assert.deepEqual(editor.project.stages.a.route,[[0,0],[0,1]]);assert.deepEqual(editor.project.stages.b.route,[[0,0],[0,1]]);
});
test('existing identical reused copies receive a durable link and shared marker identities',()=>{
  const project=emptyProject('event');project.stages.a={...emptyStage(),route:[[0,0],[0,1]],controls:[{id:'a',name:'Start',kind:'Start',point:[0,0],notes:'',locationId:''}]};project.stages.b=structuredClone(project.stages.a);project.stages.b.title='Afternoon';project.stages.b.controls[0].id='b';linkMatchingStages(project);
  assert.ok(project.stages.a.linkGroupId);assert.equal(project.stages.a.linkGroupId,project.stages.b.linkGroupId);assert.equal(project.stages.b.controls[0].id,'a');assert.deepEqual(validateProject(project,'event'),project);
});
