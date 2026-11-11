const validPoint=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=90&&Math.abs(point[1])<=180;

export async function requestRoadRoute(points,{signal,fetcher=fetch}={}) {
  let response;
  try {
    response=await fetcher('/api/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points}),signal});
  } catch(error) {
    if(error.name==='AbortError')throw error;
    throw new Error('Cannot reach the mapping server. Check that the app is running, then retry snapping.');
  }
  let body;
  try{body=await response.json();}catch{throw new Error('The mapping server returned an invalid routing response. Restart the app and retry snapping.');}
  if(!response.ok)throw new Error(body.error?.message||'Road snapping is unavailable. Retry snapping or choose Manual / tracks.');
  const route=body.data?.route;
  if(!Array.isArray(route)||route.length<2||route.length>20000||!route.every(validPoint))throw new Error('The routing service returned invalid road geometry. Retry snapping.');
  return route;
}

// Only the latest waypoint revision may update the preview or become saveable.
export class LiveRoute {
  constructor({request=requestRoadRoute,onChange=()=>{},delay=150}={}) {
    this.request=request;this.onChange=onChange;this.delay=delay;this.revision=0;
    this.route=[];this.ready=false;this.pending=false;this.error='';
  }
  cancel(){clearTimeout(this.timer);this.controller?.abort();this.revision++;this.pending=false;this.ready=false;this.error='';this.route=[];}
  seed(points,mode,route){this.cancel();this.points=structuredClone(points);this.mode=mode;this.route=structuredClone(route);this.ready=points.length>=2&&route.length>=2;}
  update(points,mode){
    clearTimeout(this.timer);this.controller?.abort();const revision=++this.revision;
    this.points=structuredClone(points);this.mode=mode;this.ready=false;this.error='';
    if(mode==='manual'||points.length<2){this.route=mode==='manual'?structuredClone(points):[];this.pending=false;this.ready=points.length>=2;this.onChange();return;}
    this.pending=true;this.onChange();
    const controller=new AbortController();this.controller=controller;
    this.timer=setTimeout(async()=>{
      try{
        const route=await this.request(structuredClone(points),{signal:controller.signal});
        if(this.revision!==revision)return;
        this.route=route;this.ready=true;this.pending=false;this.onChange();
      }catch(error){
        if(this.revision!==revision)return;
        this.pending=false;this.ready=false;this.error=error.message||'Road snapping failed. Retry snapping.';this.onChange();
      }
    },this.delay);
  }
  snapshot(points,mode){
    if(!this.ready||this.pending||this.error||this.mode!==mode||JSON.stringify(points)!==JSON.stringify(this.points))throw new Error(this.error||'Wait for road snapping to finish before saving the route.');
    return structuredClone(this.route);
  }
}

// Use an existing road geometry for splits; Finish never asks the router again.
export function splitRoute(route,waypoints,index){
  if(!Number.isInteger(index)||index<=0||index>=waypoints.length-1)throw new Error('Select an interior waypoint to split the section.');
  if(route.length<3)throw new Error('This route has no interior road point to split. Move the split waypoint and retry.');
  const target=waypoints[index],scale=Math.cos(target[0]*Math.PI/180);
  let nearest=1,best=Infinity;
  for(let i=1;i<route.length-1;i++){
    const distance=(route[i][0]-target[0])**2+((route[i][1]-target[1])*scale)**2;
    if(distance<best){best=distance;nearest=i;}
  }
  return [route.slice(0,nearest+1),route.slice(nearest)];
}
