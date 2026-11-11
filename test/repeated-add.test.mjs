import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyProject,emptyStage,History} from '../public/draft.js';
test('selected add type remains active after placing multiple controls or posts',()=>{
  const original=globalThis.document;
  try{
    for(const kind of ['Start','Junction']){
      globalThis.document={getElementById:()=>({value:kind})};
      const project=emptyProject('event');project.stages.a=emptyStage();
      const editor=Object.create(StageEditor.prototype);Object.assign(editor,{data:{},history:new History(project),stageId:'a',mode:'controls',save(){return true;},render(){}});
      editor.mapClick({lat:52,lng:-3});editor.mapClick({lat:52.01,lng:-3});
      assert.equal(editor.mode,'controls');const markers=editor.stage[kind==='Junction'?'junctions':'controls'];assert.equal(markers.length,2);assert.ok(markers.every(marker=>marker.kind===kind));
    }
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
