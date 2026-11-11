import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinates,locationSummary} from '../public/model.js';

test('missing coordinates never become zero; genuine zero remains valid',()=>{
  for(const latitude of [null,undefined,'',' ',91,'wrong'])assert.equal(coordinates({latitude,longitude:1}),null);
  assert.equal(coordinates({latitude:1,longitude:181}),null);
  assert.deepEqual(coordinates({latitude:'0',longitude:0}),[0,0]);
});
test('coverage deduplicates people per role, excludes invitations and other stages, and preserves role shortfalls',()=>{
  const location={locationId:'10',requirements:[{roleId:'radio',minimumQty:2},{roleId:'marshal',minimumQty:1}]};
  const allocation={stageId:'1',locationId:'10',roleId:'marshal',personId:'a',invitationStatus:'Allocated'};
  const result=locationSummary(location,'1',[allocation,allocation,{...allocation,personId:'b'}, {...allocation,personId:'c',roleId:'radio',invitationStatus:'Invited'},{...allocation,personId:'d',roleId:'radio',stageId:'2'}]);
  assert.equal(result.allocated,2);assert.equal(result.shortfall,2);assert.equal(result.pending,1);assert.equal(result.status,'short');
});
test('unset requirements are unknown, not covered',()=>{
  assert.equal(locationSummary({locationId:'1'},'1',[]).status,'unspecified');
  assert.equal(locationSummary({locationId:'1',requirements:[{roleId:'r',minimumQty:1}]},'1',[{stageId:'1',locationId:'1',roleId:'r',personId:'p'}]).status,'covered');
});
