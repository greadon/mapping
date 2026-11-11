import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
import {emptyProject,History} from '../public/draft.js';
test('Add liaison immediately selects its section and starts an empty road route',()=>{
  const original={document:globalThis.document,Option:globalThis.Option};const fields=new Map();let seeded=false,opened=false;
  globalThis.document={getElementById(id){if(!fields.has(id))fields.set(id,{value:'',append(){}});return fields.get(id);},dispatchEvent(){opened=true;}};globalThis.Option=class{};
  try{
    const editor=Object.create(StageEditor.prototype);
    Object.assign(editor,{local:true,data:{event:{eventId:'event'},stages:[]},history:new History(emptyProject('event')),map:{},liveRoute:{seed(){seeded=true;}},prepareSwitch:()=>true,save(){return true;},render(){},notice(){}});
    editor.addStage('liaison');assert.equal(editor.stage.sectionType,'liaison');assert.equal(editor.mode,'route');assert.deepEqual(editor.working,[]);assert.equal(editor.sectionSelected,true);assert.equal(fields.get('routingMode').value,'road');assert.equal(seeded,true);assert.equal(opened,true);
  }finally{for(const [key,value]of Object.entries(original)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
