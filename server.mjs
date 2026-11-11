import {markerWords} from './what3words.mjs';
import {snapPost} from './junction-snapping.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {routeRoad,validateWaypoints} from './routing.mjs';

const files = new Map([['/', ['index.html','text/html']], ['/app.js',['app.js','text/javascript']], ['/model.js',['model.js','text/javascript']], ['/demo.js',['demo.js','text/javascript']], ['/styles.css',['styles.css','text/css']]]);
files.set('/editor.js',['editor.js','text/javascript']);
files.set('/draft.js',['draft.js','text/javascript']);
files.set('/live-route.js',['live-route.js','text/javascript']);
files.set('/workspace-layout.js',['workspace-layout.js','text/javascript']);
files.set('/workspace.css',['workspace.css','text/css']);
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object[key]]));
export function createMappingServer({ upstream = 'http://127.0.0.1:8080', publicOrigin, fetcher = fetch, routingEndpoint=process.env.ROUTING_URL||'https://router.project-osrm.org', routingFetcher=fetch,what3wordsKey=process.env.WHAT3WORDS_API_KEY,what3wordsFetcher=fetch } = {}) {
  const target = new URL(upstream);
  if (!['http:','https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error('STAGEMODE_URL must be an origin without credentials or a path.');
  if (target.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(target.hostname)) throw new Error('Use HTTPS for a remote StageMode server.');
  const sessions = new Map(),wordsCache=new Map();
  function json(res, status, data) { res.writeHead(status, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(data)); }
  async function request(path, session, method = 'GET', body) {
    const response = await fetcher(new URL(path, target), {method, headers:{accept:'application/json', ...(session ? {cookie:session.cookie} : {}), ...(body ? {'content-type':'application/json'} : {})}, body, redirect:'error', signal:AbortSignal.timeout(15000)});
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error?.message || 'StageMode could not complete this request.'); error.status = response.status; throw error; }
    return {data:result.data, response};
  }
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://tile.openstreetmap.org https://unpkg.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const url = new URL(req.url, 'http://localhost');
    const sessionId = /(?:^|;\s*)mapping_session=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '')?.[1];
    for (const [id, session] of sessions) if (session.expires <= Date.now()) sessions.delete(id);
    const session = sessions.get(sessionId);
    const origin = publicOrigin || `http://${req.headers.host}`;
    const cookie = (value, age) => res.setHeader('Set-Cookie', `mapping_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`);
    try {
      if (req.method === 'POST') {
        if (!req.headers.origin || req.headers.origin !== origin || req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res,403,{error:{message:'Request origin or content type is not allowed.'}});
        if(url.pathname==='/api/what3words'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return json(res,413,{error:{message:'Request too large.'}});}
          let point;try{point=JSON.parse(body).point;validateWaypoints([point,point]);}catch{return json(res,400,{error:{message:'Invalid coordinates.'}});}
          const cacheKey=point.join(',');if(wordsCache.has(cacheKey))return json(res,200,{data:wordsCache.get(cacheKey)});
          try{const result=await markerWords(point,{key:what3wordsKey,fetcher:what3wordsFetcher});if(result.configured){if(wordsCache.size>=512)wordsCache.delete(wordsCache.keys().next().value);wordsCache.set(cacheKey,result);}return json(res,200,{data:result});}catch{return json(res,502,{error:{message:'what3words lookup unavailable. Check the API connection.'}});}
        }
        if(url.pathname==='/api/snap-post'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1024)return json(res,413,{error:{message:'Request too large.'}});}
          let point;try{point=JSON.parse(body).point;validateWaypoints([point,point]);}catch{return json(res,400,{error:{message:'Invalid post coordinates.'}});}
          try{return json(res,200,{data:await snapPost(point)});}catch{return json(res,200,{data:{point,snapped:false,unavailable:true}});}
        }
        if(url.pathname==='/api/route'){
          let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)return json(res,413,{error:{message:'Route request too large.'}});}
          let points;try{points=validateWaypoints(JSON.parse(body).points);}catch(error){return json(res,400,{error:{message:error.message}});}
          try{return json(res,200,{data:{route:await routeRoad(points,{endpoint:routingEndpoint,fetcher:routingFetcher})}});}catch(error){return json(res,502,{error:{message:error.message}});}
        }
        if (url.pathname === '/api/login') {
          let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) return json(res,413,{error:{message:'Sign-in request is too large.'}}); }
          let payload; try { payload = JSON.parse(body); } catch { return json(res,400,{error:{message:'Invalid sign-in request.'}}); }
          const {data,response} = await request('/api/auth/login',null,'POST',JSON.stringify({userid:payload.userid,password:payload.password}));
          const remoteCookie = (response.headers.getSetCookie?.() || [response.headers.get('set-cookie')]).filter(Boolean).map(value => value.split(';')[0]).find(value => value.startsWith('stagemode_session='));
          if (!remoteCookie) throw new Error('StageMode did not return a session.');
          if (sessionId) sessions.delete(sessionId);
          const id = randomBytes(32).toString('base64url'); sessions.set(id,{cookie:remoteCookie,expires:Date.now()+12*3600000}); cookie(id,43200);
          return json(res,200,{data:pick(data,['forename','surname','userid'])});
        }
        if (url.pathname === '/api/logout') {
          try { if (session) await request('/api/auth/logout',session,'POST','{}'); }
          finally { sessions.delete(sessionId); cookie('',0); }
          return json(res,200,{data:{signedOut:true}});
        }
        return json(res,405,{error:{message:'Mapping is read only.'}});
      }
      if (req.method !== 'GET') return json(res,405,{error:{message:'Method not allowed.'}});
      if (url.pathname === '/api/config') return json(res,200,{data:{controlUrl:target.origin}});
      if (url.pathname.startsWith('/api/')) {
        if (!session) return json(res,401,{error:{message:'Sign in with your StageMode account.'}});
        if (url.pathname === '/api/me') { const {data} = await request('/api/auth/me',session); return json(res,200,{data:pick(data,['forename','surname','userid'])}); }
        if (url.pathname === '/api/events') { const {data} = await request('/api/events',session); return json(res,200,{data:data.map(event => pick(event,['eventId','name','status','startDate']))}); }
        const eventMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
        if (eventMatch) {
          const {data} = await request(`/api/events/${eventMatch[1]}?view=marshals`,session);
          return json(res,200,{data:{event:pick(data.event,['eventId','name','units']),stages:[...(data.stages||[]),...(data.timeControls||[]),...(data.areas||[])].map(stage => pick(stage,['stageId','name','identifier','status','stageType','distance','units','firstCompetitorTime'])),allocations:(data.marshalAllocations||[]).map(row => pick(row,['stageId','locationId','roleId','roleName','personId','personName','callSign','invitationStatus','alreadySignedOn']))}});
        }
        const locationsMatch = url.pathname.match(/^\/api\/events\/(\d+)\/stages\/(\d+)\/locations$/);
        if (locationsMatch) {
          const {data} = await request(url.pathname,session);
          return json(res,200,{data:{roles:data.roles,locations:data.locations.map(row => pick(row,['locationId','name','comment','distance','sortOrder','dataLocation','mandatoryRadio','latitude','longitude','requirements']))}});
        }
        return json(res,404,{error:{message:'Unknown mapping endpoint.'}});
      }
      const file = files.get(url.pathname);
      if (!file) return json(res,404,{error:{message:'Page not found.'}});
      const content = await readFile(new URL(`./public/${file[0]}`,import.meta.url));
      res.writeHead(200,{'content-type':`${file[1]}; charset=utf-8`,'cache-control':'no-cache'}); res.end(content);
    } catch (error) {
      if (error.status === 401) { sessions.delete(sessionId); cookie('',0); }
      json(res,error.status || 502,{error:{message:error.status ? error.message : 'Cannot reach StageMode. Check the connection and try again.'}});
    }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const host = process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 8091);
  createMappingServer({upstream:process.env.STAGEMODE_URL,publicOrigin:process.env.PUBLIC_ORIGIN}).listen(port,host,() => console.log(`StageMode Mapping: http://${host}:${port}`));
}
