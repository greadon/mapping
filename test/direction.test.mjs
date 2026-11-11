import test from 'node:test';
import assert from 'node:assert/strict';
import {directionArrows,calloutOffset,serviceBadgeOffsets} from '../public/draft.js';
test('each service circle touches its main or sub-post circle without overlapping the other service',()=>{
  for(const radius of [17,14,11]){
    const offsets=serviceBadgeOffsets({radio:true,medic:true},radius);
    assert.equal(offsets.length,2);
    for(const offset of offsets)assert.ok(Math.abs(Math.hypot(offset.x,offset.y)-(radius+15))<1e-8);
    for(let index=0;index<offsets.length;index++)for(const other of offsets.slice(index+1))assert.ok(Math.hypot(offsets[index].x-other.x,offsets[index].y-other.y)>=30);
  }
});

test('callout circles choose a clear side of horizontal and vertical routes',()=>{
  const origin={x:0,y:0};
  const horizontal=calloutOffset(origin,[[{x:-100,y:0},{x:100,y:0}]]);
  assert.ok(Math.abs(horizontal.y)>33);assert.ok(Math.abs(horizontal.x)<1);
  const vertical=calloutOffset(origin,[[{x:0,y:-100},{x:0,y:100}]]);
  assert.ok(Math.abs(vertical.x)>33);assert.ok(Math.abs(vertical.y)<1);
  const end=calloutOffset(origin,[[origin,{x:100,y:0}]]);
  assert.ok(Math.hypot(end.x,end.y)>33);
});
test('dense junction circles stay separated at successive zoom scales',()=>{
  for(const scale of [1,.1,.01]){
    const centers=[];
    for(let i=0;i<35;i++){
      const point={x:i*5*scale,y:0},offset=calloutOffset(point,[],centers),center={x:point.x+offset.x,y:point.y+offset.y};
      assert.ok(centers.every(other=>Math.hypot(center.x-other.x,center.y-other.y)>=40));centers.push(center);
    }
  }
});
test('service badge footprints avoid neighbouring labels',()=>{
  const occupied=[{x:50,y:-30},{x:90,y:0}],badges=[{x:38,y:-12},{x:72,y:-12}],point={x:0,y:0};
  const offset=calloutOffset(point,[],occupied,badges);
  for(const badge of [{x:0,y:0},...badges])assert.ok(occupied.every(other=>Math.hypot(offset.x+badge.x-other.x,offset.y+badge.y-other.y)>=40));
});

test('direction arrows follow route order and reverse with the route',()=>{
  const forward=directionArrows([{x:0,y:0},{x:200,y:0}]);
  assert.equal(forward.length,2);assert.deepEqual(forward.map(arrow=>arrow[1].x),[50,150]);
  assert.ok(forward.every(([wing,tip])=>tip.x>wing.x));
  const reverse=directionArrows([{x:200,y:0},{x:0,y:0}]);
  assert.ok(reverse.every(([wing,tip])=>tip.x<wing.x));
});
test('short routes, duplicate points and bends retain valid arrow geometry',()=>{
  assert.deepEqual(directionArrows([]),[]);assert.deepEqual(directionArrows([{x:0,y:0},{x:1,y:0}]),[]);
  const arrows=directionArrows([{x:0,y:0},{x:0,y:0},{x:30,y:0},{x:30,y:100}]);
  assert.equal(arrows.length,1);assert.equal(arrows[0][1].x,30);assert.ok(arrows[0][1].y>arrows[0][0].y);
});
