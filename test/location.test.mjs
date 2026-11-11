import test from 'node:test';
import assert from 'node:assert/strict';
import {StageEditor} from '../public/editor.js';
test('opening centres on GPS and ignores a late result after user navigation',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let success,failure,move,view;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(ok,error){success=ok;failure=error;}}}});
  try{
    const editor=Object.create(StageEditor.prototype);editor.data={};editor.map={on(events,handler){move=handler;},off(){},setView(point,zoom){view={point,zoom};}};
    editor.centerOnDevice();success({coords:{latitude:52,longitude:-3}});assert.deepEqual(view,{point:[52,-3],zoom:14});
    view=null;editor.centerOnDevice();move();success({coords:{latitude:53,longitude:-2}});assert.equal(view,null);
    editor.centerOnDevice();failure({code:1});assert.equal(view,null);
    editor.centerOnDevice();editor.data=null;success({coords:{latitude:53,longitude:-2}});assert.equal(view,null);
  }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
