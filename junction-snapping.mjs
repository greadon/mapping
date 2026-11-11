const valid=point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=90&&Math.abs(point[1])<=180;
export function nearestRoadPosition(point,elements){
  const nodes=new Map(elements.filter(item=>item.type==='node'&&valid([item.lat,item.lon])).map(item=>[item.id,[item.lat,item.lon]])),edges=new Map(),segments=[];
  const scale=Math.cos(point[0]*Math.PI/180),distance=p=>Math.hypot((p[0]-point[0])*111195,(p[1]-point[1])*111195*scale);
  for(const way of elements.filter(item=>item.type==='way'&&item.tags?.highway&&!['footway','cycleway','steps','path','construction','proposed'].includes(item.tags.highway))){
    for(let i=1;i<(way.nodes||[]).length;i++){
      const a=way.nodes[i-1],b=way.nodes[i];if(!nodes.has(a)||!nodes.has(b))continue;
      if(!edges.has(a))edges.set(a,new Set());if(!edges.has(b))edges.set(b,new Set());edges.get(a).add(b);edges.get(b).add(a);segments.push([nodes.get(a),nodes.get(b)]);
    }
  }
  const junctions=[...edges].filter(([,neighbours])=>neighbours.size>=3).map(([id])=>nodes.get(id)).filter(p=>distance(p)<=40).sort((a,b)=>distance(a)-distance(b));
  if(junctions.length)return {point:junctions[0],snapped:'junction'};
  let best=null,metres=25;
  for(const [a,b]of segments){const dx=(b[1]-a[1])*scale,dy=b[0]-a[0],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((point[1]-a[1])*scale*dx+(point[0]-a[0])*dy)/length)):0,p=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],d=distance(p);if(d<metres){metres=d;best=p;}}
  return best?{point:best,snapped:'road'}:{point,snapped:false};
}
export async function snapPost(point,{fetcher=fetch}={}){
  if(!valid(point))throw new Error('Invalid post coordinates.');
  const query=`[out:json][timeout:6];way[highway](around:100,${point[0]},${point[1]});(._;>;);out body;`;
  const response=await fetcher('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)throw new Error('Road intersection lookup unavailable.');
  const body=await response.json();if(!Array.isArray(body.elements)||body.elements.length>100000)throw new Error('Invalid road intersection response.');
  return nearestRoadPosition(point,body.elements);
}
