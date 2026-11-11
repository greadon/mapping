import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStage,reverseSection,junctionLabel,History,emptyProject,validateProject} from '../public/draft.js';
test('reversal swaps control ends, retains services and renumbers posts in the new direction',()=>{
  const project=emptyProject('event'),stage=project.stages.a={...emptyStage(),route:[[0,0],[0,1]],waypoints:[[0,0],[0,.5],[0,1]]};
  stage.controls=[{id:'start',name:'Start',kind:'Start',point:[0,0],notes:'',locationId:'',services:{radio:true}},{id:'stop',name:'Stop',kind:'Stop',point:[0,1],notes:'',locationId:''}];
  stage.junctions=[{number:1,x:.2},{number:2,x:.6},{number:2,suffix:'a',x:.7}].map((item,index)=>({id:String(index),number:item.number,...(item.suffix?{suffix:item.suffix}:{}),name:'Post '+item.number+(item.suffix||''),kind:'Junction',notes:'',locationId:'',point:[0,item.x]}));
  const history=new History(project);history.commit(draft=>reverseSection(draft.stages.a));const reversed=history.project.stages.a;
  assert.deepEqual(reversed.route,[[0,1],[0,0]]);assert.deepEqual(reversed.controls[0].point,[0,1]);assert.deepEqual(reversed.controls[1].point,[0,0]);assert.equal(reversed.controls[0].services.radio,true);
  assert.deepEqual(reversed.junctions.map(junctionLabel),['1','1a','2']);assert.deepEqual(reversed.junctions.map(post=>post.point[1]),[.7,.6,.2]);
  assert.equal(validateProject(history.project,'event').stages.a.controls[0].services.radio,true);
  history.undo();assert.deepEqual(history.project,project);
});
test('liaison time control moves to the new end',()=>{
  const stage={...emptyStage(),sectionType:'liaison',route:[[0,0],[0,1]],controls:[{id:'tc',kind:'Time control',point:[0,1]}]};reverseSection(stage);assert.deepEqual(stage.controls[0].point,[0,0]);
});
