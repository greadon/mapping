import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,markerRouteDistances,routeKilometres,itineraryMarkerDistances} from '../public/draft.js';
test('itinerary distance accumulates across sections and resets only at time and start controls',()=>{
  const make=(id,kind,longitude)=>({id,kind,point:[0,longitude]});
  const start=make('start','Start',0),post=make('post','Junction',.5),stop=make('stop','Stop',1),time=make('time','Time control',2),next=make('next','Junction',2.5);
  const project={sectionOrder:['a','b','c'],stages:{a:{...emptyStage(),route:[[0,0],[0,1]],controls:[start,stop],junctions:[post]},b:{...emptyStage(),sectionType:'liaison',route:[[0,1],[0,2]],controls:[time]},c:{...emptyStage(),route:[[0,2],[0,3]],junctions:[next]}}};
  const km=routeKilometres([[0,0],[0,1]]);
  const atStop=itineraryMarkerDistances(project,'a',stop);assert.ok(Math.abs(atStop.intermediary-km)<1e-6);assert.ok(Math.abs(atStop.fromPrevious-.5*km)<1e-6);
  const atTime=itineraryMarkerDistances(project,'b',time);assert.equal(atTime.intermediary,0);assert.ok(Math.abs(atTime.total-2*km)<1e-6);
  const result=itineraryMarkerDistances(project,'c',next);assert.ok(Math.abs(result.total-2.5*km)<1e-6);assert.ok(Math.abs(result.intermediary-.5*km)<1e-6);assert.ok(Math.abs(result.fromPrevious-.5*km)<1e-6);
  project.stages.c.controls=[make('new-start','Start',2.25)];assert.ok(Math.abs(itineraryMarkerDistances(project,'c',next).intermediary-.25*km)<1e-6);
});
test('marker distances follow bends and include controls and sub-posts in route order',()=>{
  const stage=emptyStage();stage.route=[[52,0],[52,1],[53,1]];
  const start={id:'start',kind:'Start',point:[52,.2]},post={id:'post',kind:'Junction',point:[52,.8]},sub={id:'sub',kind:'Junction',point:[52.5,1]},stop={id:'stop',kind:'Stop',point:[53,1]};
  stage.controls=[stop,start];stage.junctions=[sub,post];
  const result=markerRouteDistances(stage,stop);
  assert.ok(Math.abs(result.fromPrevious-routeKilometres([[52.5,1],[53,1]]))<.01);
  const expected=.8*routeKilometres([[52,0],[52,1]])+routeKilometres([[52,1],[53,1]]);
  assert.ok(Math.abs(result.fromStart-expected)<.01);
  assert.equal(markerRouteDistances(stage,start).fromStart,0);assert.equal(markerRouteDistances(stage,start).fromPrevious,null);
  stage.controls=[stop];assert.equal(markerRouteDistances(stage,post).fromStart,null);
  stage.route=[];assert.deepEqual(markerRouteDistances(stage,post),{fromStart:null,fromPrevious:null});
});
