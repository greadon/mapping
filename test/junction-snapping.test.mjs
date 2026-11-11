import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestRoadPosition,snapPost} from '../junction-snapping.mjs';
const node=(id,lat,lon)=>({type:'node',id,lat,lon});
const way=nodes=>({type:'way',tags:{highway:'track'},nodes});
test('shared three-way road junctions take priority over a nearby road',()=>{
  const elements=[node(1,52,-3),node(2,52,-3.001),node(3,52,-2.999),node(4,52.001,-3),way([2,1,3]),way([1,4])];
  const result=nearestRoadPosition([52.00005,-3.00003],elements);assert.equal(result.snapped,'junction');assert.deepEqual(result.point,[52,-3]);
  const road=nearestRoadPosition([52.00005,-3.0008],elements);assert.equal(road.snapped,'road');assert.ok(Math.abs(road.point[0]-52)<1e-8);
  assert.equal(nearestRoadPosition([53,-3],elements).snapped,false);
});
test('crossing roads without shared nodes do not become junctions and empty data preserves click',async()=>{
  const elements=[node(1,52,-3.001),node(2,52,-2.999),node(3,51.999,-3),node(4,52.001,-3),way([1,2]),way([3,4])];
  assert.equal(nearestRoadPosition([52,-3],elements).snapped,'road');
  const result=await snapPost([52,-3],{fetcher:async()=>({ok:true,json:async()=>({elements:[]})})});assert.deepEqual(result,{point:[52,-3],snapped:false});
  await assert.rejects(()=>snapPost([91,0]),/Invalid/);
});
