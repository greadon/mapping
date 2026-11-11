import test from 'node:test';
import assert from 'node:assert/strict';
import {createMappingServer} from '../server.mjs';

test('standalone gateway enforces session, origin and read-only endpoint allowlist',async t=>{
  const calls=[];
  const server=createMappingServer({fetcher:async(url,options)=>{
    calls.push({path:url.pathname,search:url.search,options});
    if(url.pathname==='/api/auth/login')return new Response(JSON.stringify({data:{userid:'test@example.com'}}),{headers:{'set-cookie':'stagemode_session=upstream-secret; Path=/; HttpOnly'}});
    if(url.pathname==='/api/events/1')return new Response(JSON.stringify({data:{event:{eventId:'1',name:'Test'},stages:[],marshalAllocations:[{personId:'p',email:'private@example.com',personName:'Test'}],logs:[{private:'omit'}]}}));
    return new Response(JSON.stringify({data:[]}));
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/events`)).status,401);
  assert.equal((await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json',origin:'https://wrong.example'},body:'{}'})).status,403);
  const login=await fetch(`${base}/api/login`,{method:'POST',headers:{'content-type':'application/json',origin:base},body:'{"userid":"test@example.com","password":"test"}'});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(!cookie.includes('upstream-secret'));assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const result=await fetch(`${base}/api/events/1`,{headers:{cookie}});assert.equal(result.status,200);const body=await result.json();assert.equal(body.data.allocations[0].email,undefined);assert.equal(body.data.logs,undefined);assert.equal(calls.at(-1).search,'?view=marshals');assert.equal(calls.at(-1).options.headers.cookie,'stagemode_session=upstream-secret');
  assert.equal((await fetch(`${base}/api/events/1/marshal-allocations`,{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}'})).status,405);
  assert.equal((await fetch(`${base}/api/anything`,{headers:{cookie}})).status,404);
  assert.equal((await fetch(`${base}/server.mjs`)).status,404);
  await fetch(`${base}/api/logout`,{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:'{}'});
  assert.equal((await fetch(`${base}/api/events`,{headers:{cookie}})).status,401);
});
test('remote upstream requires HTTPS',()=>assert.throws(()=>createMappingServer({upstream:'http://example.com'}),/HTTPS/));
