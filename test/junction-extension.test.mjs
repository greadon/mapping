import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProject,emptyStage,extendPreviousJunction,junctionLabel,validateProject,History,insertJunction,renumberJunctions} from '../public/draft.js';
test('post type, control name and information stay linked through saving and renumbering',()=>{
  const project=emptyProject('event'),stage=project.stages.a=emptyStage();stage.route=[[52,0],[52,2]];
  stage.junctions=[{id:'post-one',number:8,name:'Post 8',kind:'Start',controlName:'Forest start',notes:'Access from the south.',services:{radio:true,auxiliaryRadio:false,dataTracking:true,recovery:false,medic:true},locationId:'',point:[52,1]}];
  const reopened=validateProject(JSON.parse(JSON.stringify(project)),'event');renumberJunctions(reopened.stages.a);
  const post=reopened.stages.a.junctions[0];assert.equal(post.id,'post-one');assert.equal(post.number,1);assert.equal(post.kind,'Start');assert.equal(post.controlName,'Forest start');assert.equal(post.notes,'Access from the south.');
  assert.deepEqual(post.services,stage.junctions[0].services);
  post.services.radio='yes';assert.throws(()=>validateProject(reopened,'event'),/post services/);
});
test('whole stage renumbering sorts a late insertion by route position and retains sub-junction groups',()=>{
  const project=emptyProject('event'),stage=project.stages.a=emptyStage();stage.route=[[52,0],[52,10]];
  stage.junctions=[{number:1,x:1},{number:2,x:3},{number:2,suffix:'a',x:4},{number:2,suffix:'b',x:5},{number:3,x:7},{number:8,x:2}].map((item,index)=>({id:String(index),number:item.number,...(item.suffix?{suffix:item.suffix}:{}),name:'Junction '+item.number+(item.suffix||''),kind:'Junction',notes:'',locationId:'',point:[52,item.x]}));
  stage.junctions[4].name='Named access';const history=new History(project);
  history.commit(draft=>renumberJunctions(draft.stages.a));
  assert.deepEqual(history.project.stages.a.junctions.map(junctionLabel),['1','2','3','3a','3b','4']);
  assert.equal(history.project.stages.a.junctions[1].id,'5');assert.equal(history.project.stages.a.junctions.at(-1).name,'Named access');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(history.project)),'event'),history.project);
  const once=structuredClone(history.project);renumberJunctions(history.project.stages.a);assert.deepEqual(history.project,once);
  history.undo();assert.deepEqual(history.project,project);
});
test('retrospective insertion shifts base numbers and all lettered extensions together',()=>{
  const project=emptyProject('event'),stage=project.stages.a=emptyStage();stage.route=[[52,0],[52,10]];
  stage.junctions=[{number:6,x:1},{number:7,x:3},{number:7,suffix:'a',x:4},{number:7,suffix:'b',x:5},{number:8,x:7}].map((item,index)=>({id:String(index),number:item.number,...(item.suffix?{suffix:item.suffix}:{}),name:'Junction '+item.number+(item.suffix||''),kind:'Junction',notes:'',locationId:'',point:[52,item.x]}));
  const history=new History(project);
  history.commit(draft=>insertJunction(draft.stages.a,{id:'new',kind:'Junction',notes:'',locationId:'',point:[52,2]}));
  assert.deepEqual(history.project.stages.a.junctions.map(junctionLabel),['6','7','8','8a','8b','9']);
  assert.equal(history.project.stages.a.junctions[3].name,'Post 8a');
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(history.project)),'event'),history.project);
  history.undo();assert.deepEqual(history.project,project);
});
test('extensions produce 7a and 7b and renumber following junctions with saved suffixes',()=>{
  const project=emptyProject('event'),stage=project.stages.a=emptyStage();
  stage.junctions=[7,8,9,10].map(number=>({id:String(number),number,name:'Junction '+number,kind:'Junction',notes:'',locationId:'',point:[52,-3]}));
  const history=new History(project);
  history.commit(draft=>extendPreviousJunction(draft.stages.a,'8'));
  assert.deepEqual(history.project.stages.a.junctions.map(junctionLabel),['7','7a','8','9']);
  history.commit(draft=>extendPreviousJunction(draft.stages.a,'9'));
  assert.deepEqual(history.project.stages.a.junctions.map(junctionLabel),['7','7a','7b','8']);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(history.project)),'event'),history.project);
  history.undo();assert.deepEqual(history.project.stages.a.junctions.map(junctionLabel),['7','7a','8','9']);
  assert.throws(()=>extendPreviousJunction(stage,'7'),/Choose/);
});
