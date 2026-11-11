import test from 'node:test';
import assert from 'node:assert/strict';
import {solarTimes,emptyProject,validateProject} from '../public/draft.js';
test('London summer and winter daylight produce plausible UTC times with correct seasonal lengths',()=>{
  const summer=solarTimes('2026-06-21',51.5074,-.1278),winter=solarTimes('2026-12-21',51.5074,-.1278);
  assert.ok(Math.abs(summer.sunrise.getUTCHours()*60+summer.sunrise.getUTCMinutes()-223)<10);
  assert.ok(Math.abs(summer.sunset.getUTCHours()*60+summer.sunset.getUTCMinutes()-1221)<10);
  assert.ok(summer.sunset-summer.sunrise>16*3600000);assert.ok(winter.sunset-winter.sunrise<9*3600000);
  const displayed=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}).format(summer.sunrise);
  assert.ok(displayed.startsWith('04:'));
});
test('event date survives saving, rejects invalid dates and handles polar daylight',()=>{
  const project=emptyProject('event');project.eventDate='2028-02-29';assert.deepEqual(validateProject(project,'event'),project);
  project.eventDate='2026-02-29';assert.throws(()=>validateProject(project,'event'),/date/);
  assert.equal(solarTimes('2026-06-21',80,0).state,'Midnight sun');assert.equal(solarTimes('2026-12-21',80,0).state,'Polar night');
});
