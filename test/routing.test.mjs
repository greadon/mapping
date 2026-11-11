import test from 'node:test';
import assert from 'node:assert/strict';
import {routeRoad,validateWaypoints} from '../routing.mjs';

test('road routing sends longitude first and retains the full road geometry',async()=>{
  const route=await routeRoad([[52,-3],[53,-2]],{fetcher:async url=>{
    assert.equal(url.pathname,'/route/v1/driving/-3,52;-2,53');
    assert.equal(url.searchParams.get('overview'),'full');
    return Response.json({code:'Ok',routes:[{geometry:{coordinates:[[-3,52],[-2.8,52.4],[-2,53]]}}]});
  }});
  assert.deepEqual(route,[[52,-3],[52.4,-2.8],[53,-2]]);
});
test('routing rejects invalid input and unavailable roads without inventing straight lines',async()=>{
  for(const points of [[],[[91,0],[0,0]],[[0,'0'],[1,1]],Array.from({length:101},()=>[0,0])])assert.throws(()=>validateWaypoints(points));
  await assert.rejects(routeRoad([[52,-3],[53,-2]],{fetcher:async()=>Response.json({code:'NoRoute'})}),/No road route/);
  await assert.rejects(routeRoad([[52,-3],[53,-2]],{fetcher:async()=>new Response('',{status:503})}),/unavailable/);
});
