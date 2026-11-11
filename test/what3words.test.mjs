import test from 'node:test';
import assert from 'node:assert/strict';
import {markerWords} from '../what3words.mjs';
test('what3words needs configuration and converts marker coordinates without exposing its key',async()=>{
  assert.deepEqual(await markerWords([52,-3],{}),{configured:false});
  const result=await markerWords([52,-3],{key:'test-key',fetcher:async url=>{assert.equal(url.searchParams.get('coordinates'),'52,-3');assert.equal(url.searchParams.get('language'),'en');return {ok:true,json:async()=>({words:'test.marker.position'})};}});
  assert.deepEqual(result,{configured:true,words:'test.marker.position'});assert.equal(JSON.stringify(result).includes('test-key'),false);
  await assert.rejects(()=>markerWords([91,0],{}),/Invalid/);
  await assert.rejects(()=>markerWords([52,-3],{key:'test',fetcher:async()=>({ok:false,json:async()=>({error:{message:'BadKey'}})})}),/unavailable/);
});
