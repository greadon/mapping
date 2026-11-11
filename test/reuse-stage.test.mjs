import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,emptyStage,reuseStage,History,firstCarDue,validateProject,syncSectionIdentifiers} from '../public/draft.js';
test('morning and afternoon stage runs retain all marker settings with independent names and due times',()=>{
  const project=emptyProject('event');project.legs=[{id:'am',name:'Morning',color:'#ff0000',startTime:'09:00'},{id:'pm',name:'Afternoon',color:'#ff0000',startTime:'14:00'}];
  project.stages.original={...emptyStage(),title:'Forest morning',legId:'am',route:[[52,-3],[52.01,-3]],waypoints:[[52,-3],[52.01,-3]],averageSpeedMph:70,targetTime:'00:01',controls:[{id:'start',name:'Start',kind:'Start',point:[52,-3],notes:'Gate access',locationId:'',controlIdentifier:'SS1',services:{radio:true,auxiliaryRadio:false,dataTracking:true,recovery:false,medic:true}}],junctions:[{id:'p1',name:'Post 1a',kind:'Junction',number:1,suffix:'a',point:[52.005,-3],notes:'Keep clear',locationId:'',predictedMarshals:3}]};project.sectionOrder=['original'];
  const history=new History(project);history.commit(draft=>{reuseStage(draft,'original',{id:'repeat',name:'Forest afternoon',legId:'pm'});syncSectionIdentifiers(draft);});
  const original=history.project.stages.original,repeat=history.project.stages.repeat;
  assert.deepEqual(repeat.route,original.route);assert.deepEqual(repeat.waypoints,original.waypoints);assert.equal(repeat.controls[0].id,original.controls[0].id);assert.equal(repeat.junctions[0].id,original.junctions[0].id);
  assert.deepEqual(repeat.controls[0].services,original.controls[0].services);assert.equal(repeat.junctions[0].predictedMarshals,3);assert.equal(repeat.junctions[0].suffix,'a');assert.equal(repeat.title,'Forest afternoon');assert.equal(repeat.identifier,'SS2');
  assert.equal(firstCarDue(history.project,'original',original.controls[0]).time,'09:00');assert.equal(firstCarDue(history.project,'repeat',repeat.controls[0]).time,'14:00');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(history.project)),'event'),history.project);
  repeat.controls[0].notes='Afternoon access';assert.equal(original.controls[0].notes,'Gate access');
  history.undo();assert.deepEqual(history.project,project);
});
test('re-use rejects missing stages, liaison sections and unknown destination legs',()=>{
  const project=emptyProject('event');project.stages.one=emptyStage();project.stages.liaison={...emptyStage(),sectionType:'liaison'};
  assert.throws(()=>reuseStage(project,'missing',{name:'Copy'}),/special stage/);
  assert.throws(()=>reuseStage(project,'liaison',{name:'Copy'}),/special stage/);
  assert.throws(()=>reuseStage(project,'one',{name:'Copy',legId:'missing'}),/existing leg/);
});
