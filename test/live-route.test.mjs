import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveRoute,requestRoadRoute,splitRoute} from '../public/live-route.js';
import {StageEditor} from '../public/editor.js';
import {emptyStage} from '../public/draft.js';

const points=[[52,-3],[52.01,-2.99]],road=[[52,-3],[52.003,-2.998],[52.01,-2.99]];
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('adding waypoints computes road geometry before Finish and Finish saves it without routing again',async()=>{
  let calls=0;const live=new LiveRoute({delay:0,request:async()=>{calls++;return road;}});
  live.update(points,'road');assert.equal(live.pending,true);await tick();
  assert.equal(live.ready,true);assert.deepEqual(live.snapshot(points,'road'),road);
  globalThis.document={getElementById:()=>({value:'road'})};
  const project={stages:{one:emptyStage()}},messages=[];
  const editor={local:true,working:structuredClone(points),workingSectionType:'liaison',workingSectionName:'Renamed section',stageId:'one',liveRoute:live,notice:value=>messages.push(value),change:action=>action(project)};
  StageEditor.prototype.finish.call(editor);
  assert.equal(calls,1);assert.equal(editor.working,null);
  assert.deepEqual(project.stages.one.route,road);assert.deepEqual(project.stages.one.waypoints,points);
  assert.equal(project.stages.one.sectionType,'liaison');
  assert.equal(project.stages.one.title,'Renamed section');
  assert.equal(messages.at(-1),'Route saved.');delete globalThis.document;
});

test('cancelling a route edit discards a staged section type change',()=>{
  const stage={...emptyStage(),title:'Original'},editor={stage,working:structuredClone(points),workingSectionType:'liaison',workingSectionName:'Unsaved',mode:'route',liveRoute:new LiveRoute(),notice(){},render(){}};
  StageEditor.prototype.cancel.call(editor);
  assert.equal(editor.working,null);assert.equal(editor.workingSectionType,null);assert.equal(editor.mode,'select');assert.equal(stage.sectionType,'stage');
  assert.equal(editor.workingSectionName,null);assert.equal(stage.title,'Original');
});

test('rapid waypoint revisions ignore stale success and stale errors, even when a server ignores abort',async()=>{
  const first=deferred(),second=deferred(),requests=[first,second],signals=[];
  const live=new LiveRoute({delay:0,request:(_,{signal})=>{signals.push(signal);return requests.shift().promise;}});
  live.update(points,'road');await tick();const newer=[...points,[52.02,-2.98]];
  live.update(newer,'road');await tick();assert.equal(signals[0].aborted,true);
  second.resolve([...road,newer[2]]);await tick();first.reject(new Error('old failure'));await tick();
  assert.equal(live.error,'');assert.deepEqual(live.snapshot(newer,'road'),[...road,newer[2]]);
  assert.throws(()=>live.snapshot(points,'road'),/Wait/);
});

test('undo to one point, mode switches and cancellation discard pending road results',async()=>{
  const pending=deferred(),live=new LiveRoute({delay:0,request:()=>pending.promise});
  live.update(points,'road');await tick();live.update([points[0]],'road');pending.resolve(road);await tick();
  assert.equal(live.ready,false);assert.deepEqual(live.route,[]);
  live.update(points,'manual');assert.deepEqual(live.snapshot(points,'manual'),points);
  live.cancel();assert.equal(live.ready,false);assert.deepEqual(live.route,[]);
});

test('routing failures retain waypoints, prevent Finish and can be retried',async()=>{
  let fail=true;const live=new LiveRoute({delay:0,request:async()=>{if(fail)throw new Error('Service unavailable');return road;}});
  live.update(points,'road');await tick();assert.equal(live.ready,false);assert.deepEqual(live.points,points);
  assert.throws(()=>live.snapshot(points,'road'),/Service unavailable/);
  fail=false;live.update(points,'road');await tick();assert.deepEqual(live.snapshot(points,'road'),road);
});

test('split sections use the preview geometry and share an identical boundary',()=>{
  const waypoints=[points[0],road[1],points[1]],parts=splitRoute(road,waypoints,1);
  assert.deepEqual(parts,[[road[0],road[1]],[road[1],road[2]]]);
  assert.throws(()=>splitRoute(road,waypoints,0),/interior waypoint/);
});

test('client explains disconnected servers, HTTP errors and invalid routing responses',async()=>{
  await assert.rejects(requestRoadRoute(points,{fetcher:async()=>{throw new TypeError('fetch failed');}}),/mapping server/);
  await assert.rejects(requestRoadRoute(points,{fetcher:async()=>Response.json({error:{message:'No road route found'}},{status:502})}),/No road route/);
  await assert.rejects(requestRoadRoute(points,{fetcher:async()=>new Response('<html>wrong server</html>')}),/invalid routing response/);
  await assert.rejects(requestRoadRoute(points,{fetcher:async()=>Response.json({data:{route:[[99,0],[0,0]]}})}),/invalid road geometry/);
});
