export const layerNames = ['route', 'controls', 'junctions', 'marshals'];
export function reuseStage(project,sourceId,{name,legId='',id='local-'+crypto.randomUUID()}={}){
  const source=project.stages[sourceId];
  if(!source||source.sectionType!=='stage')throw new Error('Select a special stage to re-use.');
  if(typeof name!=='string'||!name.trim()||name.trim().length>120)throw new Error('Enter a stage name.');
  if(legId&&!project.legs?.some(leg=>leg.id===legId))throw new Error('Choose an existing leg.');
  if(project.stages[id])throw new Error('Stage already exists.');
  source.linkGroupId||='linked-'+crypto.randomUUID();
  const copy=structuredClone(source);copy.title=name.trim();delete copy.identifier;delete copy.legId;
  if(legId)copy.legId=legId;
  const order=[...(project.sectionOrder||Object.keys(project.stages))];order.splice(order.indexOf(sourceId)+1,0,id);project.stages[id]=copy;project.sectionOrder=order;
  return id;
}
const runFields=new Set(['title','identifier','legId','visible','layers','targetTime','targetTimeDistanceKm','targetTimeSectionType','targetTimeAverageSpeedMph','averageSpeedMph','linkGroupId']);
const sharedStage=stage=>Object.fromEntries(Object.entries(stage).filter(([key])=>!runFields.has(key)));
export function syncLinkedStages(project,before){
  const groups=new Map();for(const [id,stage]of Object.entries(project.stages))if(stage.linkGroupId){if(!groups.has(stage.linkGroupId))groups.set(stage.linkGroupId,[]);groups.get(stage.linkGroupId).push(id);}
  for(const ids of groups.values()){
    const sourceId=ids.find(id=>before.stages[id]&&JSON.stringify(sharedStage(project.stages[id]))!==JSON.stringify(sharedStage(before.stages[id])));
    if(!sourceId)continue;
    const shared=sharedStage(project.stages[sourceId]);
    for(const id of ids)if(id!==sourceId){const stage=project.stages[id],oldDistance=routeKilometres(stage.route);
      for(const key of Object.keys(stage))if(!runFields.has(key))delete stage[key];Object.assign(stage,structuredClone(shared));
      const distance=routeKilometres(stage.route);if(Math.abs(distance-oldDistance)>1e-7){stage.targetTime=calculatedTargetTime(distance,stage.sectionType,averageSpeed(stage));stage.targetTimeDistanceKm=distance;stage.targetTimeSectionType=stage.sectionType;stage.targetTimeAverageSpeedMph=averageSpeed(stage);}
    }
  }
}
export function linkMatchingStages(project){
  const signatures=new Map();
  for(const stage of Object.values(project.stages)){
    if(stage.sectionType!=='stage'||stage.route.length<2)continue;
    const shape=sharedStage(stage);for(const layer of ['controls','junctions'])shape[layer]=stage[layer].map(({id,...marker})=>marker);
    const signature=JSON.stringify(shape),first=signatures.get(signature);
    if(first){const group=first.linkGroupId||stage.linkGroupId||'linked-'+crypto.randomUUID();first.linkGroupId=group;stage.linkGroupId=group;stage.controls=structuredClone(first.controls);stage.junctions=structuredClone(first.junctions);}else signatures.set(signature,stage);
  }
}
export const displayDistance=(kilometres,units='km')=>(units==='mi'?kilometres/1.609344:kilometres).toFixed(2)+' '+(units==='mi'?'mi':'km');
export const averageSpeed=stage=>stage?.averageSpeedMph??(stage?.sectionType==='liaison'?30:70);
export function speedForTargetTime(distanceKm,time){
  if(!/^\d{1,3}:[0-5]\d$/.test(time))throw new Error('Enter target time as HH:MM.');
  const [hours,minutes]=time.split(':').map(Number),duration=hours+minutes/60;
  if(duration<=0||distanceKm<=0)throw new Error('A positive route distance and target time are required.');
  return distanceKm/1.609344/duration;
}
export function calculatedTargetTime(distanceKm,sectionType,speedMph=sectionType==='liaison'?30:70){
  const minutes=Math.ceil(distanceKm/(speedMph*1.609344)*60-1e-9);
  return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
export function targetTimeNeedsUpdate(distanceKm,sectionType,basisDistance,basisType){return Math.abs(distanceKm-basisDistance)>.001||sectionType!==basisType;}
export function ensureRouteEndControls(stage){
  if(stage.route.length<2)return;
  const set=(kind,point)=>{const existing=[...stage.controls,...stage.junctions].find(marker=>marker.kind===kind);if(existing)existing.point=[...point];else stage.controls.push({id:crypto.randomUUID(),name:kind,kind,point:[...point],notes:'',locationId:''});};
  if(stage.sectionType==='liaison')set('Time control',stage.route.at(-1));
  else {set('Start',stage.route[0]);const finishKind=[...stage.controls,...stage.junctions].some(marker=>marker.kind==='Stop')?'Stop':'Flying finish';set(finishKind,stage.route.at(-1));}
}
export function solarTimes(date,latitude,longitude){
  const midnight=Date.parse(date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==date||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('Invalid event date or location.');
  // NOAA General Solar Position Calculations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  const year=new Date(midnight).getUTCFullYear(),days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000,day=(midnight-Date.UTC(year,0,1))/86400000;
  const gamma=2*Math.PI/days*day,eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
  const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma),lat=latitude*Math.PI/180;
  const cosine=Math.cos(90.833*Math.PI/180)/(Math.cos(lat)*Math.cos(decl))-Math.tan(lat)*Math.tan(decl);
  if(cosine>1)return {sunrise:null,sunset:null,state:'Polar night'};
  if(cosine< -1)return {sunrise:null,sunset:null,state:'Midnight sun'};
  const angle=Math.acos(cosine)*180/Math.PI,noon=720-4*longitude-eq;
  return {sunrise:new Date(midnight+(noon-4*angle)*60000),sunset:new Date(midnight+(noon+4*angle)*60000),state:'normal'};
}
export function syncSectionIdentifiers(project){
  let stages=0,liaisons=0;
  for(const id of project.sectionOrder||Object.keys(project.stages)){
    const stage=project.stages[id];stage.identifier=stage.sectionType==='liaison'?'L'+(++liaisons):'SS'+(++stages);
  }
}
export const postServices={radio:'Radio',auxiliaryRadio:'Auxiliary Radio',dataTracking:'Data Tracking',recovery:'Recovery',medic:'Medic'};
export function serviceBadgeOffsets(services={},radius=17){
  return Array.from({length:Number(!!services.radio)+Number(!!services.medic)},(_,index)=>{
    const angle=(index?38:-38)*Math.PI/180;return {x:Math.cos(angle)*(radius+15),y:Math.sin(angle)*(radius+15)};
  });
}
export function calloutOffset(point,paths,occupied=[],badges=[]){
  for(let ring=0;;ring++){
    const radius=34+ring*22;let best=null,score=-Infinity;
    for(let i=0;i<16;i++){
      const angle=(-45+i*22.5)*Math.PI/180,offset={x:Math.cos(angle)*radius,y:Math.sin(angle)*radius},center={x:point.x+offset.x,y:point.y+offset.y};
      if([{x:0,y:0},...badges].some(badge=>occupied.some(other=>Math.hypot(center.x+badge.x-other.x,center.y+badge.y-other.y)<40)))continue;
      let clearance=100;
      for(const path of paths)for(let j=1;j<path.length;j++){
        const a=path[j-1],b=path[j],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
        const t=length?Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.y-a.y)*dy)/length)):0;
        clearance=Math.min(clearance,Math.hypot(center.x-a.x-t*dx,center.y-a.y-t*dy));
      }
      if(clearance>score+.01){score=clearance;best=offset;}
    }
    if(best)return best;
  }
}

export const junctionLabel=marker=>String(marker.number||'J')+(marker.suffix||'');
export function renumberJunctions(stage){
  const route=stage.route.length>1?stage.route:stage.waypoints;
  if(route.length<2)throw new Error('Draw a route before renumbering its junctions.');
  const station=point=>{
    const scale=Math.cos(point[0]*Math.PI/180);let best=Infinity,position=0,travelled=0;
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=(b[1]-a[1])*scale,dy=b[0]-a[0],length=Math.hypot(dx,dy);
      const t=length?Math.max(0,Math.min(1,((point[1]-a[1])*scale*dx+(point[0]-a[0])*dy)/(length*length))):0;
      const distance=Math.hypot((point[1]-a[1])*scale-t*dx,point[0]-a[0]-t*dy);
      if(distance<best){best=distance;position=travelled+t*length;}travelled+=length;
    }
    return position;
  };
  const groups=new Map();
  for(const marker of stage.junctions){const key=marker.number||marker.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({marker,position:station(marker.point)});}
  const ordered=[...groups.values()].sort((a,b)=>(a.find(item=>!item.marker.suffix)||a[0]).position-(b.find(item=>!item.marker.suffix)||b[0]).position);
  stage.junctions=ordered.flatMap((group,index)=>{
    group.sort((a,b)=>Number(!!a.marker.suffix)-Number(!!b.marker.suffix)||a.position-b.position);let suffix=0;
    return group.map(({marker})=>{const automatic=/^(?:Junction|Post) \d+[a-z]*$/.test(marker.name);marker.number=index+1;if(marker.suffix)marker.suffix=letterSuffix(++suffix);if(automatic)marker.name='Post '+junctionLabel(marker);return marker;});
  });
}
export function insertJunction(stage,marker){
  const route=stage.route.length>1?stage.route:stage.waypoints;
  const station=point=>{
    let best=Infinity,position=0,travelled=0;const scale=Math.cos(point[0]*Math.PI/180);
    for(let i=1;i<route.length;i++){
      const a=route[i-1],b=route[i],dx=(b[1]-a[1])*scale,dy=b[0]-a[0],length=Math.hypot(dx,dy);
      const t=length?Math.max(0,Math.min(1,((point[1]-a[1])*scale*dx+(point[0]-a[0])*dy)/(length*length))):0;
      const distance=Math.hypot((point[1]-a[1])*scale-t*dx,point[0]-a[0]-t*dy);
      if(distance<best){best=distance;position=travelled+t*length;}travelled+=length;
    }
    return position;
  };
  const position=station(marker.point);let index=route.length>1?stage.junctions.findIndex(item=>station(item.point)>position+1e-10):-1;
  if(index<0)index=stage.junctions.length;
  // Keep an existing base number and all of its lettered extensions together.
  if(stage.junctions[index]?.suffix){const base=stage.junctions[index].number;while(index>0&&stage.junctions[index-1].number===base)index--;}
  const number=stage.junctions[index]?.number||Math.max(0,...stage.junctions.map(item=>item.number||0))+1;
  if(stage.junctions.some(item=>item.number>=number&&item.number>=9999))throw new Error('Junction number limit reached.');
  for(const item of stage.junctions)if(item.number>=number){const automatic=/^(?:Junction|Post) \d+[a-z]*$/.test(item.name);item.number++;if(automatic)item.name='Post '+junctionLabel(item);}
  Object.assign(marker,{number,name:'Post '+number});stage.junctions.splice(index,0,marker);
}
const letterSuffix=value=>{let text='';for(let n=value;n>0;n=Math.floor((n-1)/26))text=String.fromCharCode(97+(n-1)%26)+text;return text;};
export function extendPreviousJunction(stage,id){
  const index=stage.junctions.findIndex(marker=>marker.id===id),target=stage.junctions[index],previous=stage.junctions[index-1];
  if(!previous||!target?.number||!previous.number||target.suffix||target.number<=previous.number)throw new Error('Choose a numbered junction after another junction to extend it.');
  const oldNumber=target.number,base=previous.number,shift=oldNumber-base;
  let suffix=previous.suffix?[...previous.suffix].reduce((value,letter)=>value*26+letter.charCodeAt(0)-96,0):0;
  for(const marker of stage.junctions.slice(index)){
    const automatic=/^(?:Junction|Post) \d+[a-z]*$/.test(marker.name);
    if(marker.number===oldNumber){marker.number=base;marker.suffix=letterSuffix(++suffix);}
    else if(marker.number>oldNumber)marker.number-=shift;
    if(automatic)marker.name='Post '+junctionLabel(marker);
  }
}
export function directionArrows(points,spacing=100){
  const segments=points.slice(1).map((point,index)=>({a:points[index],b:point,length:Math.hypot(point.x-points[index].x,point.y-points[index].y)}));
  const total=segments.reduce((sum,segment)=>sum+segment.length,0);
  if(total<18)return [];
  const step=Math.max(spacing,total/1000),arrows=[];let distance=Math.min(step/2,total/2),travelled=0;
  for(const {a,b,length}of segments){
    if(!length)continue;
    while(distance<=travelled+length){
      const ratio=(distance-travelled)/length,dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
      const tip={x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio};
      arrows.push([{x:tip.x-dx*5-dy*3,y:tip.y-dy*5+dx*3},tip,{x:tip.x-dx*5+dy*3,y:tip.y-dy*5-dx*3}]);distance+=step;
    }
    travelled+=length;
  }
  return arrows;
}
export function emptyStage() { return {route:[],waypoints:[],routing:'manual',sectionType:'stage',controls:[],junctions:[],visible:true,layers:Object.fromEntries(layerNames.map(key=>[key,true]))}; }
export function emptyProject(eventId) { return {version:1,eventId:String(eventId),stages:{}}; }
const validPoint = point => Array.isArray(point) && point.length===2 && point.every(Number.isFinite) && Math.abs(point[0])<=90 && Math.abs(point[1])<=180;
export function validateProject(value, eventId) {
  if(!value || value.version!==1 || value.eventId!==String(eventId) || !value.stages || typeof value.stages!=='object' || Array.isArray(value.stages)) throw new Error('This map file belongs to a different event or uses an unsupported format.');
  const result=emptyProject(eventId), entries=Object.entries(value.stages);
  if(value.units!=null){if(!['km','mi'].includes(value.units))throw new Error('Invalid distance units.');result.units=value.units;}
  if(value.eventName!=null){if(typeof value.eventName!=='string'||value.eventName.length>120)throw new Error('Invalid event name.');result.eventName=value.eventName;}
  if(value.eventDate!=null){if(value.eventDate!=='')solarTimes(value.eventDate,0,0);result.eventDate=value.eventDate;}
  if(value.legs!=null){
    if(!Array.isArray(value.legs)||value.legs.length>100)throw new Error('Invalid legs.');
    const ids=new Set();result.legs=value.legs.map(leg=>{
      if(!leg||typeof leg.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(leg.id)||ids.has(leg.id)||typeof leg.name!=='string'||!leg.name.trim()||leg.name.length>120||!/^#[0-9a-f]{6}$/i.test(leg.color))throw new Error('Invalid leg name, identifier or colour.');
      if(leg.startTime!=null&&(typeof leg.startTime!=='string'||(leg.startTime!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(leg.startTime))))throw new Error('Invalid leg start time.');
      ids.add(leg.id);return {id:leg.id,name:leg.name.trim(),color:leg.color,...(leg.startTime!=null?{startTime:leg.startTime}:{})};
    });
  }
  if(value.visibility!=null){
    if(typeof value.visibility!=='object'||Array.isArray(value.visibility)||[...layerNames,'liaison','directions'].some(name=>value.visibility[name]!=null&&typeof value.visibility[name]!=='boolean'))throw new Error('Invalid key visibility settings.');
    result.visibility=Object.fromEntries(layerNames.map(name=>[name,value.visibility[name]!==false]));
    if(value.visibility.liaison!=null)result.visibility.liaison=value.visibility.liaison;
    if(value.visibility.directions!=null)result.visibility.directions=value.visibility.directions;
  }
  if(entries.length>500)throw new Error('The map contains too many stages.');
  for(const [id,stage] of entries) {
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ['__proto__','constructor','prototype'].includes(id))throw new Error('Invalid stage identifier.');
    if(!stage || !Array.isArray(stage.route) || stage.route.length>20000 || stage.route.length===1 || !stage.route.every(validPoint))throw new Error('A route must be empty or contain at least two valid coordinates.');
    const clean=emptyStage(),ids=new Set(),links=new Set();clean.route=stage.route.map(point=>[...point]);clean.visible=stage.visible!==false;
    if(stage.legId!=null){if(!result.legs?.some(leg=>leg.id===stage.legId))throw new Error('Section belongs to an unknown leg.');clean.legId=stage.legId;}
    if(stage.sectionType!=null&&!['stage','liaison'].includes(stage.sectionType))throw new Error('Invalid section type.');
    if(stage.routing!=null&&!['manual','road'].includes(stage.routing))throw new Error('Invalid routing mode.');
    clean.sectionType=stage.sectionType||'stage';clean.routing=stage.routing||'manual';
    const waypoints=stage.waypoints||[];
    if(!Array.isArray(waypoints)||waypoints.length>20000||!waypoints.every(validPoint))throw new Error('Invalid route waypoints.');
    clean.waypoints=waypoints.map(point=>[...point]);
    if(typeof stage.title==='string')clean.title=stage.title.slice(0,120);
    if(stage.linkGroupId!=null){if(typeof stage.linkGroupId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(stage.linkGroupId))throw new Error('Invalid linked stage group.');clean.linkGroupId=stage.linkGroupId;}
    if(stage.targetTime!=null){if(typeof stage.targetTime!=='string'||(stage.targetTime!==''&&!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(stage.targetTime)))throw new Error('Target time must use HH:MM or HH:MM:SS.');clean.targetTime=stage.targetTime.split(':').slice(0,2).join(':');}
    if(stage.targetTimeDistanceKm!=null){if(!Number.isFinite(stage.targetTimeDistanceKm)||stage.targetTimeDistanceKm<0)throw new Error('Invalid target time distance.');clean.targetTimeDistanceKm=stage.targetTimeDistanceKm;}
    if(stage.targetTimeSectionType!=null){if(!['stage','liaison'].includes(stage.targetTimeSectionType))throw new Error('Invalid target time section type.');clean.targetTimeSectionType=stage.targetTimeSectionType;}
    for(const field of ['averageSpeedMph','targetTimeAverageSpeedMph'])if(stage[field]!=null){if(!Number.isFinite(stage[field])||stage[field]<=0)throw new Error('Average speed must be greater than zero.');clean[field]=stage[field];}
    if(typeof stage.identifier==='string')clean.identifier=stage.identifier.slice(0,40);
    for(const layer of layerNames)clean.layers[layer]=stage.layers?.[layer]!==false;
    for(const layer of ['controls','junctions']) {
      if(!Array.isArray(stage[layer]) || stage[layer].length>2000)throw new Error('Invalid marker layer.');
      clean[layer]=stage[layer].map(marker=>{
        if(!marker || typeof marker.id!=='string' || !marker.id || marker.id.length>100 || ids.has(marker.id) || !validPoint(marker.point) || typeof marker.name!=='string' || !marker.name.trim() || marker.name.length>120 || typeof marker.kind!=='string' || marker.kind.length>40 || typeof marker.notes!=='string' || marker.notes.length>2000)throw new Error('Invalid or duplicate map marker.');
        ids.add(marker.id);const locationId=marker.locationId==null?'':String(marker.locationId);
        if(locationId.length>100 || (locationId && links.has(locationId)))throw new Error('A StageMode location can only be linked once per stage.');
        if(locationId)links.add(locationId);
        const result={id:marker.id,name:marker.name.trim(),kind:marker.kind,notes:marker.notes,point:[...marker.point],locationId};
        if(marker.controlName!=null){if(typeof marker.controlName!=='string'||marker.controlName.length>120)throw new Error('Invalid control name.');result.controlName=marker.controlName.trim();}
        if(marker.predictedMarshals!=null){if(!Number.isSafeInteger(marker.predictedMarshals)||marker.predictedMarshals<0)throw new Error('Predicted marshals must be a non-negative integer.');result.predictedMarshals=marker.predictedMarshals;}
        if(marker.controlIdentifier!=null){if(typeof marker.controlIdentifier!=='string'||marker.controlIdentifier.length>40)throw new Error('Invalid control identifier.');result.controlIdentifier=marker.controlIdentifier.trim();}
        if(marker.services!=null){
          if(typeof marker.services!=='object'||Array.isArray(marker.services)||Object.keys(postServices).some(key=>marker.services[key]!=null&&typeof marker.services[key]!=='boolean'))throw new Error('Invalid post services.');
          result.services=Object.fromEntries(Object.keys(postServices).map(key=>[key,marker.services[key]===true]));
        }
        if(marker.number!=null){if(!Number.isInteger(marker.number)||marker.number<1||marker.number>9999)throw new Error('Invalid junction number.');result.number=marker.number;}
        if(marker.suffix!=null){if(!marker.number||typeof marker.suffix!=='string'||!/^[a-z]{1,3}$/.test(marker.suffix))throw new Error('Invalid junction suffix.');result.suffix=marker.suffix;}
        return result;
      });
    }
    result.stages[id]=clean;
  }
  if(value.sectionOrder!=null){
    if(!Array.isArray(value.sectionOrder)||value.sectionOrder.length!==entries.length||new Set(value.sectionOrder).size!==entries.length||value.sectionOrder.some(id=>!Object.hasOwn(result.stages,id)))throw new Error('Invalid section order.');
    result.sectionOrder=[...value.sectionOrder];
  }
  return result;
}
export function routeKilometres(points) {
  const rad=value=>value*Math.PI/180;
  return points.slice(1).reduce((distance,point,index)=>{
    const previous=points[index],a=Math.sin(rad(point[0]-previous[0])/2)**2+Math.cos(rad(previous[0]))*Math.cos(rad(point[0]))*Math.sin(rad(point[1]-previous[1])/2)**2;
    return distance+6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
  },0);
}
export function routeStation(stage,point){
  if(stage.route.length<2)return null;
  const segments=stage.route.slice(1).map((b,index)=>({a:stage.route[index],b,length:routeKilometres([stage.route[index],b])}));
    const scale=Math.cos(point[0]*Math.PI/180);let best=Infinity,result=0,travelled=0;
    for(const {a,b,length}of segments){
      const dx=(b[1]-a[1])*scale,dy=b[0]-a[0],squared=dx*dx+dy*dy;
      const t=squared?Math.max(0,Math.min(1,((point[1]-a[1])*scale*dx+(point[0]-a[0])*dy)/squared)):0;
      const distance=((point[1]-a[1])*scale-t*dx)**2+(point[0]-a[0]-t*dy)**2;
      if(distance<best){best=distance;result=travelled+t*length;}travelled+=length;
    }
    return result;
}
export function markerRouteDistances(stage,marker){
  if(stage.route.length<2)return {fromStart:null,fromPrevious:null};
  const position=point=>routeStation(stage,point);
  const markers=[...stage.controls,...stage.junctions],current=position(marker.point),start=markers.find(item=>item.kind==='Start');
  const previous=markers.filter(item=>item.id!==marker.id).map(item=>position(item.point)).filter(distance=>distance<current-1e-7).sort((a,b)=>b-a)[0];
  return {fromStart:start?current-position(start.point):null,fromPrevious:previous==null?null:current-previous};
}
export function itineraryMarkerDistances(project,sectionId,marker){
  const order=project.sectionOrder||Object.keys(project.stages),entries=[];let accumulated=0,current=null,currentIndex=-1;
  for(const [index,id]of order.entries()){
    const stage=project.stages[id];
    if(id===sectionId){const distance=routeStation(stage,marker.point);if(distance!=null){current=accumulated+distance;currentIndex=index;}}
    for(const post of [...stage.controls,...stage.junctions]){const distance=routeStation(stage,post.point);if(distance!=null)entries.push({id:post.id,sectionId:id,index,kind:post.kind,distance:accumulated+distance});}
    accumulated+=routeKilometres(stage.route);
  }
  if(current==null)return {intermediary:null,total:null,fromPrevious:null};
  const before=entries.filter(post=>post.distance<current-1e-7||(Math.abs(post.distance-current)<1e-7&&post.index<currentIndex));
  const resets=entries.filter(post=>['Start','Time control'].includes(post.kind)&&post.distance<=current+1e-7&&(post.index<=currentIndex));
  const reset=resets.length?Math.max(...resets.map(post=>post.distance)):0,previous=before.length?Math.max(...before.map(post=>post.distance)):null;
  return {intermediary:Math.max(0,current-reset),total:current,fromPrevious:previous==null?null:Math.max(0,current-previous)};
}
export function reverseSection(stage){
  if(stage.route.length<2)throw new Error('Draw a route before reversing its direction.');
  const controlKinds=['Start','Stop','Flying finish','Flying Finish','Arrival','Time control'];
  const positions=[...stage.controls,...stage.junctions].filter(marker=>controlKinds.includes(marker.kind)).map(marker=>({marker,distance:routeStation(stage,marker.point)}));
  stage.route.reverse();stage.waypoints.reverse();
  for(const {marker,distance}of positions){
    let remaining=distance;
    for(let index=1;index<stage.route.length;index++){
      const a=stage.route[index-1],b=stage.route[index],length=routeKilometres([a,b]);
      if(remaining<=length||index===stage.route.length-1){const ratio=length?Math.max(0,Math.min(1,remaining/length)):0;marker.point=[a[0]+ratio*(b[0]-a[0]),a[1]+ratio*(b[1]-a[1])];break;}remaining-=length;
    }
  }
  const groups=new Map();for(const marker of stage.junctions){if(!groups.has(marker.number))groups.set(marker.number,[]);groups.get(marker.number).push(marker);}
  for(const group of groups.values())if(group.some(marker=>marker.suffix)){
    group.sort((a,b)=>routeStation(stage,a.point)-routeStation(stage,b.point));
    group.forEach((marker,index)=>{if(index)marker.suffix=letterSuffix(index);else delete marker.suffix;});
  }
  renumberJunctions(stage);
}
export function firstCarDue(project,sectionId,marker){
  const selected=project.stages[sectionId],leg=project.legs?.find(item=>item.id===selected?.legId);
  if(!leg?.startTime)return null;
  const [hours,minutes]=leg.startTime.split(':').map(Number);let elapsed=0;
  for(const id of project.sectionOrder||Object.keys(project.stages)){
    const stage=project.stages[id];if(stage.legId!==leg.id)continue;
    const distance=id===sectionId?routeStation(stage,marker.point):routeKilometres(stage.route);
    if(distance==null)return null;
    elapsed+=distance/(averageSpeed(stage)*1.609344)*60;
    if(id===sectionId){const total=hours*60+minutes+Math.ceil(elapsed-1e-9),dayOffset=Math.floor(total/1440),clock=((total%1440)+1440)%1440;
      return {time:String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0'),dayOffset};}
  }
  return null;
}
export function reorderedSections(project,sourceId,targetId,after=false){
  const order=[...(project.sectionOrder||Object.keys(project.stages))];
  if(!order.includes(sourceId)||!order.includes(targetId))throw new Error('This section is no longer in the itinerary.');
  if(sourceId===targetId)return order;
  const next=order.filter(id=>id!==sourceId);next.splice(next.indexOf(targetId)+(after?1:0),0,sourceId);return next;
}
export function removeLeg(project,id){
  if(!project.legs?.some(leg=>leg.id===id))throw new Error('Leg no longer exists.');
  if(Object.values(project.stages).some(stage=>stage.legId===id))throw new Error('Only empty legs can be removed. Move their sections first.');
  project.legs=project.legs.filter(leg=>leg.id!==id);
}
export function marshalPoint(location,stage) {
  const linked=[...stage.controls,...stage.junctions].find(marker=>String(marker.locationId)===String(location.locationId));
  if(linked)return linked.point;
  if(location.latitude==null || location.longitude==null || String(location.latitude).trim()==='' || String(location.longitude).trim()==='')return null;
  const point=[Number(location.latitude),Number(location.longitude)];return validPoint(point)?point:null;
}
export class History {
  constructor(project){this.project=structuredClone(project);this.past=[];this.future=[];}
  commit(change){this.past.push(structuredClone(this.project));if(this.past.length>60)this.past.shift();change(this.project);this.future=[];}
  undo(){if(!this.past.length)return;this.future.push(this.project);this.project=this.past.pop();}
  redo(){if(!this.future.length)return;this.past.push(this.project);this.project=this.future.pop();}
}

