import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatedTargetTime,targetTimeNeedsUpdate,emptyProject,emptyStage,validateProject,speedForTargetTime,routeKilometres} from '../public/draft.js';
test('target time derives speed and subsequent distance changes derive the new target',()=>{
  assert.ok(Math.abs(speedForTargetTime(70*1.609344,'01:00')-70)<1e-8);
  assert.throws(()=>speedForTargetTime(10,'00:00'),/positive/);
  const editor=Object.create(StageEditor.prototype),route=[[0,0],[0,.1]],distance=routeKilometres(route);
  Object.assign(editor,{working:route,creatingSectionRoute:false,workingSectionType:'stage',workingTargetType:'stage',workingTargetTime:'00:20',workingTargetDistance:distance,workingAverageSpeed:speedForTargetTime(distance,'00:20'),liveRoute:{ready:true,route}});
  editor.workingTargetSpeed=editor.workingAverageSpeed;editor.updateAutomaticTargetTime();assert.equal(editor.workingTargetTime,'00:20');
  editor.liveRoute.route=[[0,0],[0,.2]];editor.updateAutomaticTargetTime();assert.equal(editor.workingTargetTime,'00:40');
  editor.workingAverageSpeed*=2;editor.updateAutomaticTargetTime();assert.equal(editor.workingTargetTime,'00:20');
});
import {StageEditor} from '../public/editor.js';
test('target times use 70mph for stages, 30mph for liaisons and round up to minutes',()=>{
  assert.equal(calculatedTargetTime(70*1.609344,'stage'),'01:00');
  assert.equal(calculatedTargetTime(30*1.609344,'liaison'),'01:00');
  assert.equal(calculatedTargetTime(1,'stage'),'00:01');assert.equal(calculatedTargetTime(1,'liaison'),'00:02');
  assert.equal(calculatedTargetTime(0,'stage'),'00:00');
});
test('distance and speed basis survive saving and detect stale target times',()=>{
  const project=emptyProject('event');project.stages.a={...emptyStage(),targetTime:'00:10',targetTimeDistanceKm:10,targetTimeSectionType:'stage'};
  assert.deepEqual(validateProject(project,'event'),project);
  assert.equal(targetTimeNeedsUpdate(10,'stage',10,'stage'),false);assert.equal(targetTimeNeedsUpdate(11,'stage',10,'stage'),true);assert.equal(targetTimeNeedsUpdate(10,'liaison',10,'stage'),true);
});
test('recalculate is staged with the route and clears the outdated distance basis',()=>{
  const editor=Object.create(StageEditor.prototype);let rendered=false;
  Object.assign(editor,{working:[[0,0],[0,.1]],workingSectionType:'liaison',liveRoute:{ready:true,pending:false,route:[[0,0],[0,.1]]},render(){rendered=true;}});
  editor.recalculateTargetTime();assert.equal(editor.workingTargetTime,'00:14');assert.equal(editor.workingTargetType,'liaison');assert.ok(editor.workingTargetDistance>11);assert.equal(rendered,true);
});
