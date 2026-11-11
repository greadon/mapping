import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,emptyStage,firstCarDue,routeKilometres,validateProject} from '../public/draft.js';
test('time control due times accumulate only the assigned leg and respond to speed changes',()=>{
  const project=emptyProject('event');project.legs=[{id:'one',name:'Leg 1',color:'#123456',startTime:'23:00'},{id:'two',name:'Leg 2',color:'#654321',startTime:'08:00'}];
  const route=[[0,0],[0,1]],mph=routeKilometres(route)/1.609344;
  project.stages.a={...emptyStage(),legId:'one',route,averageSpeedMph:mph};project.stages.other={...emptyStage(),legId:'two',route,averageSpeedMph:1};
  const tc={id:'tc',kind:'Time control',name:'Time control',point:[0,1],notes:'',locationId:''};
  project.stages.b={...emptyStage(),legId:'one',sectionType:'liaison',route,averageSpeedMph:mph*2,controls:[tc]};project.sectionOrder=['a','other','b'];
  assert.deepEqual(firstCarDue(project,'b',tc),{time:'00:30',dayOffset:1});
  project.stages.a.averageSpeedMph=mph*2;assert.deepEqual(firstCarDue(project,'b',tc),{time:'00:00',dayOffset:1});
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),'event'),project);
  project.legs[0].startTime='';assert.equal(firstCarDue(project,'b',tc),null);
});
test('invalid leg start times and non-positive speeds cannot be saved',()=>{
  const project=emptyProject('event');project.legs=[{id:'one',name:'Leg 1',color:'#123456',startTime:'25:00'}];assert.throws(()=>validateProject(project,'event'),/start time/);
  project.legs[0].startTime='09:00';project.stages.a={...emptyStage(),averageSpeedMph:0};assert.throws(()=>validateProject(project,'event'),/Average speed/);
});
