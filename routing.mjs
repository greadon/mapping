export function validateWaypoints(points) {
  if(!Array.isArray(points)||points.length<2||points.length>100||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>90||Math.abs(p[1])>180))throw new Error('Road routing requires 2–100 valid waypoints.');
  return points;
}
export async function routeRoad(points,{endpoint='https://router.project-osrm.org',fetcher=fetch}={}) {
  validateWaypoints(points);
  const base=new URL(endpoint);
  if(base.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('Routing requires HTTPS.');
  const url=new URL(`/route/v1/driving/${points.map(([lat,lon])=>`${lon},${lat}`).join(';')}`,base);
  url.search='overview=full&geometries=geojson&steps=false';
  let response;
  try{response=await fetcher(url,{signal:AbortSignal.timeout(20000),redirect:'error'});}
  catch(error){throw new Error(error.name==='TimeoutError'?'Road snapping timed out. Retry snapping or add closer waypoints.':'Cannot reach the road routing service. Retry snapping or choose Manual / tracks.');}
  if(!response.ok)throw new Error('The road routing service is unavailable.');
  const body=await response.json(),coordinates=body.routes?.[0]?.geometry?.coordinates;
  if(body.code!=='Ok'||!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>20000)throw new Error('No road route found. Add closer waypoints or choose Manual.');
  const route=coordinates.map(p=>[p[1],p[0]]);
  if(route.some(p=>!p.every(Number.isFinite)||Math.abs(p[0])>90||Math.abs(p[1])>180))throw new Error('Invalid road routing response.');
  return route;
}
