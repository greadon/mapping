import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyStage,ensureRouteEndControls} from '../public/draft.js';
test('liaison has only an end time control and stage has start and flying finish without duplicates',()=>{
  for(const sectionType of ['stage','liaison']){
    const stage={...emptyStage(),sectionType,route:[[52,-3],[53,-2]]};ensureRouteEndControls(stage);
    assert.deepEqual(stage.controls.map(marker=>marker.kind),sectionType==='stage'?['Start','Flying finish']:['Time control']);
    const endpoint=stage.controls.at(-1),id=endpoint.id;endpoint.controlIdentifier='TC1';stage.route[1]=[54,-1];ensureRouteEndControls(stage);
    assert.equal(stage.controls.at(-1).id,id);assert.equal(stage.controls.at(-1).controlIdentifier,'TC1');assert.deepEqual(stage.controls.at(-1).point,[54,-1]);
  }
});

test('double click creates one flying finish, excludes it from junctions, and saves only when ready',()=>{
  globalThis.document={getElementById:()=>({value:'road'})};
  try{
    const stage=emptyStage(),project={stages:{one:stage}},editor=Object.create(StageEditor.prototype);
    Object.assign(editor,{stageId:'one',mode:'route',working:[[52,-3],[52.01,-2.99],[52.02,-2.98]],createRouteJunctions:true,local:true,workingSectionName:'Stage 1',history:{project},notice(){},change:action=>action(project),updateRoute(){},liveRoute:{snapshot:points=>points,cancel(){}}});
    editor.endRouteAtStop({lat:52.02,lng:-2.98});
    assert.equal(editor.working.length,3);assert.equal(editor.finishAtStop,true);assert.equal(stage.controls.length,0);
    editor.mapClick({lat:53,lng:-3});assert.equal(editor.working.length,3);
    editor.finish();assert.equal(editor.working,null);assert.equal(stage.controls.length,2);assert.equal(stage.controls[0].kind,'Start');assert.equal(stage.controls[1].kind,'Flying finish');
    assert.deepEqual(stage.controls[1].point,stage.route.at(-1));assert.equal(stage.junctions.length,1);assert.equal(editor.finishAtStop,false);
  }finally{delete globalThis.document;}
});

test('placing a new stage start enters route drawing and saves numbered junctions',()=>{
  globalThis.document={getElementById:()=>({value:'manual'})};
  try{
    const stage=emptyStage(),project={stages:{one:stage}},editor=Object.create(StageEditor.prototype);
    Object.assign(editor,{stageId:'one',pendingStartStageId:'one',mode:'controls',local:true,data:{},history:{project},notice(){},change:action=>action(project),setMode(mode){this.mode=mode;this.working=[];this.workingSectionType='stage';this.workingSectionName='Stage 1';},updateRoute(){},liveRoute:{snapshot:points=>points,cancel(){}}});
    editor.mapClick({lat:52,lng:-3});
    assert.equal(stage.controls[0].kind,'Start');assert.deepEqual(stage.controls[0].point,[52,-3]);
    assert.equal(editor.mode,'route');assert.deepEqual(editor.working,[[52,-3]]);
    editor.mapClick({lat:52.01,lng:-2.99});editor.mapClick({lat:52.02,lng:-2.98});
    assert.equal(stage.junctions.length,0);editor.finish();
    assert.deepEqual(stage.junctions.map(item=>item.number),[1]);assert.deepEqual(stage.route[0],stage.controls[0].point);
    assert.equal(editor.createRouteJunctions,false);
  }finally{delete globalThis.document;}
});
