import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,emptyStage,validateProject,routeKilometres,marshalPoint,History,reorderedSections} from '../public/draft.js';
const marker=(id,locationId='')=>({id,locationId,name:'Start',kind:'Start',notes:'',point:[52,-3]});

test('itinerary moves preserve section contents and survive save, undo and redo',()=>{
  const project=emptyProject('event');
  for(const id of ['a','b','c'])project.stages[id]={...emptyStage(),title:id};
  project.stages.b.sectionType='liaison';project.stages.a.controls=[marker('start')];
  const history=new History(project);
  history.commit(draft=>{draft.sectionOrder=reorderedSections(draft,'c','a');});
  assert.deepEqual(history.project.sectionOrder,['c','a','b']);
  assert.deepEqual(history.project.stages,project.stages);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(history.project)),'event'),history.project);
  history.undo();assert.deepEqual(history.project,project);
  history.redo();assert.deepEqual(history.project.sectionOrder,['c','a','b']);
  assert.deepEqual(reorderedSections(history.project,'c','b',true),['a','b','c']);
  assert.deepEqual(reorderedSections(history.project,'c','c'),['c','a','b']);
  assert.throws(()=>reorderedSections(history.project,'missing','a'),/no longer/);
});

test('global Key filters survive reopening and reject invalid settings',()=>{
  const project=emptyProject('event');project.stages.a=emptyStage();
  project.visibility={route:false,liaison:true,controls:true,junctions:false,marshals:true,directions:false};
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),'event'),project);
  assert.equal(project.stages.a.layers.route,true);
  assert.throws(()=>validateProject({...project,visibility:{route:'hidden'}},'event'),/visibility/);
  assert.throws(()=>validateProject({...project,visibility:[]},'event'),/visibility/);
  assert.throws(()=>validateProject({...project,visibility:{liaison:'hidden'}},'event'),/visibility/);
  assert.throws(()=>validateProject({...project,visibility:{directions:'hidden'}},'event'),/visibility/);
});

test('save and reopen retain independent routes, markers and layer visibility per stage',()=>{
  const project=emptyProject('event');project.stages.one=emptyStage();project.stages.two=emptyStage();
  project.stages.one.route=[[52,-3],[52.01,-3.02]];project.stages.one.controls.push(marker('a','10'));project.stages.one.layers.marshals=false;
  project.stages.two.junctions.push({...marker('b'),kind:'Junction'});
  const reopened=validateProject(JSON.parse(JSON.stringify(project)),'event');
  assert.deepEqual(reopened,project);reopened.stages.two.layers.route=false;
  assert.equal(reopened.stages.one.layers.route,true);assert.equal(reopened.stages.two.route.length,0);
});
test('invalid imports fail instead of corrupting a draft',()=>{
  const project=emptyProject('1');project.stages.one=emptyStage();
  assert.throws(()=>validateProject(project,'2'),/different event/);
  project.stages.one.route=[[52,-3]];assert.throws(()=>validateProject(project,'1'),/at least two/);
  project.stages.one.route=[[52,-3],[91,0]];assert.throws(()=>validateProject(project,'1'),/valid coordinates/);
  project.stages.one.route=[];project.stages.one.controls=[marker('a','10')];project.stages.one.junctions=[marker('b','10')];assert.throws(()=>validateProject(project,'1'),/linked once/);
  project.stages.one.junctions=[marker('a')];assert.throws(()=>validateProject(project,'1'),/duplicate/);
  assert.throws(()=>validateProject(JSON.parse('{"version":1,"eventId":"1","stages":{"__proto__":{}}}'),'1'),/identifier/);
});
test('undo and redo restore route deletion and marker moves without changing another stage',()=>{
  const project=emptyProject('1');project.stages.one=emptyStage();project.stages.two=emptyStage();project.stages.one.route=[[52,-3],[53,-3]];project.stages.one.controls=[marker('a')];
  const history=new History(project);history.commit(draft=>{draft.stages.one.route=[];draft.stages.one.controls[0].point=[51,0];});history.undo();assert.deepEqual(history.project,project);
  history.redo();assert.deepEqual(history.project.stages.one.route,[]);assert.deepEqual(history.project.stages.one.controls[0].point,[51,0]);assert.deepEqual(history.project.stages.two,project.stages.two);
  history.undo();history.commit(draft=>draft.stages.one.layers.route=false);assert.equal(history.future.length,0);
});
test('marshal overlay follows a linked placeholder only within its own stage',()=>{
  const first=emptyStage(),second=emptyStage();first.controls=[marker('a','10')];
  const location={locationId:'10',latitude:51,longitude:-2};
  assert.deepEqual(marshalPoint(location,first),[52,-3]);assert.deepEqual(marshalPoint(location,second),[51,-2]);assert.equal(marshalPoint({...location,latitude:null},second),null);
});
test('drawn route distance uses geography and remains zero for an empty route',()=>{
  assert.equal(routeKilometres([]),0);assert.ok(Math.abs(routeKilometres([[0,0],[0,1]])-111.195)<.01);
});

test('legacy maps migrate and rally section order, routing and junction numbers survive export',()=>{
  const legacy={version:1,eventId:'1',stages:{one:{route:[],controls:[],junctions:[]}}};
  const project=validateProject(legacy,'1');assert.equal(project.stages.one.sectionType,'stage');
  project.stages.two=emptyStage();project.stages.two.sectionType='liaison';
  project.stages.one.routing='road';project.stages.one.route=[[52,-3],[53,-2]];project.stages.one.waypoints=[[52,-3],[53,-2]];
  project.stages.one.junctions=[{...marker('j'),kind:'Junction',number:3}];project.sectionOrder=['two','one'];
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project)),'1'),project);
  project.sectionOrder=['one','one'];assert.throws(()=>validateProject(project,'1'),/section order/);
  project.sectionOrder=['two','one'];project.stages.one.junctions[0].number=0;assert.throws(()=>validateProject(project,'1'),/junction number/);
});
