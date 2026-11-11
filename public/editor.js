import {emptyStage,emptyProject,validateProject,routeKilometres,marshalPoint,History,layerNames,reorderedSections,removeLeg,directionArrows,junctionLabel,extendPreviousJunction,insertJunction,calloutOffset,renumberJunctions,postServices,markerRouteDistances,itineraryMarkerDistances,serviceBadgeOffsets,syncSectionIdentifiers,solarTimes,ensureRouteEndControls,calculatedTargetTime,targetTimeNeedsUpdate,reverseSection,averageSpeed,firstCarDue,displayDistance,speedForTargetTime,reuseStage,syncLinkedStages,linkMatchingStages} from './draft.js';
import {locationSummary} from './model.js';
import {LiveRoute,splitRoute} from './live-route.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,action)=>{const n=el('button',text);n.type='button';n.onclick=action;return n;};
const controlTypeLabel=kind=>kind==='Junction'?'Post':kind==='Flying finish'?'Flying Finish':kind;
const locationName=item=>item.name.replace(/^Junction (?=[0-9])/,'Post ');
const kinds=['Junction','Control','Time control','Start','Arrival','Flying finish','Stop'];

export class StageEditor {
  constructor({notice,controlUrl}) {
    this.notice=notice;this.controlUrl=controlUrl;this.mode='select';this.selected=null;this.groups=new Map();this.dirty=false;
    this.liveRoute=new LiveRoute({onChange:()=>{if(!this.working)return;this.updateAutomaticTargetTime();if(this.finishAtStop&&this.liveRoute.ready&&!this.liveRoute.pending){this.finish();return;}this.notice(this.liveRoute.error||(this.liveRoute.pending?'Snapping route to roads…':this.liveRoute.ready?(this.liveRoute.mode==='road'?'Road route ready. Add another waypoint or finish the route.':'Manual route ready. Add another waypoint or finish the route.'):''));this.render();}});
    $('mapUnits').onchange=event=>{if(!this.project)return;if(!this.prepareSwitch()){this.syncUnitRadios();return;}this.change(project=>{project.units=event.target.value;});};
    $('eventName').oninput=()=>{if(!this.project)return;const name=$('eventName').value;this.history.commit(project=>{project.eventName=name;});this.dirty=true;this.save();const option=$('events').selectedOptions?.[0];if(option)option.textContent=name||'Untitled event';};
    $('cancelReuseStage').onclick=()=>$('reuseStageDialog').close();
    $('reuseStageForm').onsubmit=event=>{event.preventDefault();if(!this.prepareSwitch())return;const sourceId=this.reuseSourceId,name=$('reuseStageName').value,legId=$('reuseStageLeg').value;try{let newId;this.change(project=>{newId=reuseStage(project,sourceId,{name,legId});this.stageId=newId;this.sectionSelected=true;this.selected={layer:'route',id:newId};});if(this.data.details[sourceId])this.data.details[newId]=structuredClone(this.data.details[sourceId]);$('reuseStageDialog').close();this.notice('Linked stage created. Drag it to the required itinerary position; due times use its leg start time.');}catch(error){this.notice(error.message);}};
    $('routingMode').onchange=()=>this.updateRoute();$('retryRoute').onclick=()=>this.updateRoute();
    if(window.L){
      this.map=L.map('map',{doubleClickZoom:false}).setView([54,-3],6);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>notice('Background map unavailable. Your drawing remains available; check the internet connection.')).addTo(this.map);
      this.map.zoomControl.setPosition('bottomleft');this.map.on('moveend',()=>{if(this.data)this.renderDaylight();});
      this.handles=L.featureGroup().addTo(this.map);this.map.on('click',event=>{if((event.originalEvent?.detail||1)>=2)return;if(this.mode!=='route'){this.mapClick(event.latlng);return;}clearTimeout(this.routeClickTimer);const working=this.working;this.routeClickTimer=setTimeout(()=>{if(this.working===working)this.mapClick(event.latlng);},250);});this.map.on('dblclick',event=>{clearTimeout(this.routeClickTimer);this.endRouteAtStop(event.latlng);});
    }
    for(const mode of ['select','route','junctions'])$(`tool-${mode}`).onclick=()=>this.setMode(mode);
    const closeAddMenu=()=>{$('addPostMenu').hidden=true;$('tool-controls').setAttribute('aria-expanded','false');};
    $('tool-controls').onclick=()=>{if((this.workingSectionType||this.stage?.sectionType)==='liaison'){closeAddMenu();if(!this.working)this.setMode('route');else{this.mode='route';this.selected=null;this.render();}this.notice('Click the map to add waypoints to the liaison route.');return;}if(this.working){this.notice('Save or cancel the route edit before adding markers.');return;}const open=$('addPostMenu').hidden;$('addPostMenu').hidden=!open;$('tool-controls').setAttribute('aria-expanded',String(open));if(open)$('addPostMenu').querySelector('button')?.focus();};
    document.addEventListener('click',event=>{if(!$('addPostDropdown').contains(event.target))closeAddMenu();});
    $('addPostDropdown').onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAddMenu();$('tool-controls').focus();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const items=[...$('addPostMenu').querySelectorAll('button')],index=items.indexOf(document.activeElement);if(items.length)items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}};
    $('tool-select').onclick=()=>this.deselectSection();
    $('finishRoute').onclick=()=>this.finish(null);$('cancelRoute').onclick=()=>this.cancel();
    $('undo').onclick=()=>this.undo();$('redo').onclick=()=>this.redo();$('fit').onclick=()=>this.fit();
    $('saveDraft').onclick=()=>this.save();$('exportMap').onclick=()=>this.export();
    $('importMap').onclick=()=>{if(this.prepareSwitch())$('mapFile').click();};
    $('mapFile').onchange=event=>this.import(event.target.files[0]);
    $('stages').onchange=()=>{if(!this.prepareSwitch()){$('stages').value=this.stageId;return;}this.sectionSelected=true;this.stageId=$('stages').value;this.selected=null;this.mode='select';this.render();this.fit();};
    $('otherStages').onchange=()=>this.render();$('search').oninput=()=>this.renderReferences();
    $('newStage').onclick=()=>this.addStage();$('exportGIS').onclick=()=>this.exportGIS();
    window.addEventListener('beforeunload',event=>{if(this.dirty||this.working){event.preventDefault();event.returnValue='';}});
    window.addEventListener('keydown',event=>{if(event.defaultPrevented||$('reuseStageDialog')?.open||$('newMapDialog')?.open||$('workspaceMenu')?.open||!this.data || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;if(event.key==='Escape'){event.preventDefault();this.cancel();}if(event.key==='Enter'&&this.working){event.preventDefault();this.finish();}});
  }
  syncUnitRadios(){ $('unitsKm').checked=this.project?.units!=='mi';$('unitsMi').checked=this.project?.units==='mi'; }
  distance(km){return displayDistance(km,this.project?.units);}
  speedUnit(){return this.project?.units==='mi'?'mph':'km/h';}
  displaySpeed(mph){return Math.round(mph*(this.project?.units==='mi'?1:1.609344)*10)/10;}
  get project(){return this.history?.project;}
  get stage(){return this.data?this.project?.stages[this.stageId]:null;}
  deselectSection(){
    if(!this.prepareSwitch())return;
    clearTimeout(this.routeClickTimer);this.pendingStartStageId=null;this.sectionSelected=false;this.selected=null;this.inspectedSelection=null;this.mode='select';
    this.render();document.dispatchEvent(new CustomEvent('mapping:deselect'));$('toggleLayers').focus();
  }
  open(data,{scope,local}) {
    this.sectionSelected=false;this.liveRoute.cancel();this.data=data;this.local=local;this.storageKey=`stagemode-map-v1:${scope}:${data.event.eventId}`;this.selected=null;this.mode='select';this.working=null;this.dirty=false;
    let project=emptyProject(data.event.eventId);this.notice('');
    try{const saved=localStorage.getItem(this.storageKey);if(saved){project=validateProject(JSON.parse(saved),data.event.eventId);if(local)data.stages=Object.entries(project.stages).map(([id,stage],index)=>({stageId:id,identifier:stage.identifier||`SS${index+1}`,name:stage.title||`Stage ${index+1}`}));}}
    catch(error){this.notice(`Saved draft could not be read: ${error.message} Export any recovered work before saving a replacement.`);}
    if(local)for(const [id,stage] of Object.entries(project.stages))if(!data.stages.some(item=>String(item.stageId)===id))data.stages.push({stageId:id,identifier:stage.identifier||'Stage',name:stage.title||id});
    for(const stage of data.stages){const id=String(stage.stageId);if(!Object.hasOwn(project.stages,id))project.stages[id]=emptyStage();}if(project.sectionOrder)for(const id of Object.keys(project.stages))if(!project.sectionOrder.includes(id))project.sectionOrder.push(id);
    linkMatchingStages(project);syncSectionIdentifiers(project);this.history=new History(project);$('eventName').value=project.eventName??data.event.name??'';this.syncUnitRadios();if($('events').selectedOptions?.[0])$('events').selectedOptions[0].textContent=$('eventName').value||'Untitled event';this.stageId=String(data.stages[0]?.stageId||'');this.savedText=JSON.stringify(project);
    $('stages').replaceChildren(...data.stages.map(stage=>new Option(`${stage.identifier||''} · ${stage.name}`,stage.stageId)));$('newStage').hidden=!local;$('otherStages').checked=true;$('search').value='';
    $('saveState').textContent='Drafts save in this browser';this.render();setTimeout(()=>{this.map?.invalidateSize();this.fit();this.centerOnDevice();},0);
    if(!this.map)this.notice('Map library unavailable. Check your internet connection and reload before drawing.');
  }
  close(){this.locationRequest=null;this.liveRoute.cancel();this.data=null;this.history=null;this.stageId='';this.working=null;this.selected=null;this.dirty=false;this.groups.forEach(group=>this.map?.removeLayer(group.parent));this.groups.clear();this.handles?.clearLayers();$('layerTree').replaceChildren();$('keyControls').replaceChildren();$('details').replaceChildren();$('referenceList').replaceChildren();for(const id of ['tool-select','tool-route','tool-controls','tool-junctions','undo','redo'])$(id).disabled=true;}
  centerOnDevice(){
    if(!this.map||!this.data||!globalThis.navigator?.geolocation)return;
    const request={};this.locationRequest=request;
    const stop=()=>{if(this.locationRequest===request)this.locationRequest=null;this.map.off('dragstart zoomstart',stop);};
    this.map.on('dragstart zoomstart',stop);
    navigator.geolocation.getCurrentPosition(position=>{
      const current=this.locationRequest===request;stop();if(!current||!this.data)return;
      const {latitude,longitude}=position.coords;
      if(Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180)this.map.setView([latitude,longitude],14);
    },()=>{stop();},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  prepareSwitch(){if(this.working){this.notice('Finish or cancel the route edit before switching stages, refreshing, or closing.');return false;}if(this.dirty&&!this.save())return false;return true;}
  save(){
    if(!this.project)return true;if(this.working){this.notice('Finish the route before saving.');return false;}
    try{const text=JSON.stringify(validateProject(this.project,this.data.event.eventId));localStorage.setItem(this.storageKey,text);this.savedText=text;this.dirty=false;$('saveState').textContent=`Saved in this browser · ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;return true;}
    catch(error){this.dirty=true;$('saveState').textContent='Not saved — export a copy';this.notice(`Draft could not be saved: ${error.message} Use Export map to keep a file copy.`);return false;}
  }
  change(action){this.history.commit(project=>{const before=structuredClone(project);action(project);syncLinkedStages(project,before);if(project.legs?.length){const order=project.sectionOrder||Object.keys(project.stages);project.sectionOrder=[...project.legs.map(leg=>leg.id),null].flatMap(legId=>order.filter(id=>(project.stages[id].legId||null)===legId));}syncSectionIdentifiers(project);});this.dirty=true;this.save();this.render();}
  saveMarkerFields(stageId,layer,id,values){
    const marker=this.project?.stages[stageId]?.[layer]?.find(item=>item.id===id);if(!marker)return;
    if(Object.entries(values).every(([key,value])=>JSON.stringify(marker[key])===JSON.stringify(value)))return;
    this.history.commit(project=>{const before=structuredClone(project);Object.assign(project.stages[stageId][layer].find(item=>item.id===id),values);syncLinkedStages(project,before);});this.dirty=true;this.save();
  }
  setMode(mode){
    this.pendingStartStageId=null;
    if(!this.stage||!this.map)return;
    if(this.working&&mode!=='route'){this.notice('Finish or cancel the route before changing tools.');return;}
    if(mode==='route'&&!this.working){this.creatingSectionRoute=!this.stage.route.length;this.createRouteJunctions=false;this.finishAtStop=false;this.pendingStopPoint=null;this.workingAverageSpeed=averageSpeed(this.stage);this.workingTargetSpeed=this.stage.targetTimeAverageSpeedMph??averageSpeed(this.stage);this.workingTargetTime=this.stage.targetTime||'';this.workingTargetDistance=this.stage.targetTimeDistanceKm??routeKilometres(this.stage.route);this.workingTargetType=this.stage.targetTimeSectionType||this.stage.sectionType;this.workingSectionType=this.stage.sectionType;this.workingSectionName=this.stage.title||this.data.stages.find(stage=>String(stage.stageId)===this.stageId)?.name||'Stage';this.working=structuredClone(this.stage.waypoints.length?this.stage.waypoints:this.stage.route);$('routingMode').value=this.stage.route.length?this.stage.routing:'road';this.liveRoute.seed(this.working,$('routingMode').value,this.stage.route);this.selected=null;}
    this.mode=mode;if(mode!=='route')this.createRouteJunctions=false;
    if(mode!=='select'){this.stage.visible=true;this.stage.layers[mode]=true;if(this.project.visibility)this.project.visibility[mode==='route'&&this.stage.sectionType==='liaison'?'liaison':mode]=true;}
    this.notice('');if(mode==='route')document.dispatchEvent(new CustomEvent('mapping:inspect'));this.render();
  }
  endRouteAtStop(latlng){
    clearTimeout(this.routeClickTimer);if(this.mode!=='route'||!this.working||this.busy)return;
    const point=[Number(latlng.lat.toFixed(7)),Number(latlng.lng.toFixed(7))];
    if(Math.abs(point[0])>90||Math.abs(point[1])>180)return;
    while(this.working.length>1&&this.working.at(-1).every((value,index)=>value===point[index]))this.working.pop();
    if(this.working.length===1&&this.working[0].every((value,index)=>value===point[index])){this.notice('Place the stop beyond the start to finish the route.');return;}
    this.working.push(point);this.pendingStopPoint=point;this.finishAtStop=true;this.updateRoute();
  }
  mapClick(latlng){
    if(this.finishAtStop)return;
    if(!this.stage)return;const point=[Number(latlng.lat.toFixed(7)),Number(latlng.lng.toFixed(7))];
    if(Math.abs(point[0])>90||Math.abs(point[1])>180){this.notice('Draw within the main world map.');return;}
    if(this.pendingStartStageId===this.stageId&&this.mode==='controls'){
      this.pendingStartStageId=null;const id=crypto.randomUUID();
      this.change(project=>project.stages[this.stageId].controls.push({id,name:'Start',kind:'Start',point,notes:'',locationId:''}));
      this.setMode('route');this.working=[point];this.createRouteJunctions=true;this.updateRoute();this.notice('Start placed. Click junctions to build the route, then save the section.');return;
    }
    if(this.mode==='route'){if(this.busy)return;if(this.working.length>=($('routingMode').value==='road'?100:20000)){this.notice('Waypoint limit reached. Split this section or use Manual.');return;}this.working.push(point);this.updateRoute();}
    else if(['controls','junctions'].includes(this.mode)){
      const kind=this.mode==='controls'?$('controlKind').value:'Junction',layer=kind==='Junction'?'junctions':'controls',id=crypto.randomUUID();
      const place=(position)=>{this.selected={layer,id};this.change(project=>{const marker={id,name:kind+' '+(project.stages[this.stageId][layer].length+1),kind,point:position,notes:'',locationId:''};if(layer==='junctions')insertJunction(project.stages[this.stageId],marker);else project.stages[this.stageId][layer].push(marker);});};
      if(!this.map){place(point);return;}
      const history=this.history,stageId=this.stageId;this.notice('Finding the nearest road junction…');
      this.snapPostLocation(point).then(result=>{if(this.history!==history||this.stageId!==stageId||this.mode!=='controls'||this.working)return;place(result.point);this.notice(result.snapped==='junction'?'Post snapped to road junction.':result.snapped==='road'?'Post snapped to road.':'No nearby road junction available; kept the clicked position.');});
    }
  }
  async snapPostLocation(point){
    try{const response=await fetch('/api/snap-post',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({point}),signal:AbortSignal.timeout(10000)});if(!response.ok)return {point};const result=(await response.json()).data;if(!Array.isArray(result?.point)||result.point.length!==2||!result.point.every(Number.isFinite))return {point};return result;}catch{return {point};}
  }
  updateAutomaticTargetTime(){
    if(this.working&&this.liveRoute.ready&&(!this.workingTargetTime||Math.abs(routeKilometres(this.liveRoute.route)-(this.workingTargetDistance??-1))>1e-7||(this.workingSectionType||this.stage?.sectionType)!==this.workingTargetType||(this.workingAverageSpeed??averageSpeed(this.stage))!==this.workingTargetSpeed)){const distance=routeKilometres(this.liveRoute.route),type=this.workingSectionType||this.stage.sectionType;this.workingTargetTime=calculatedTargetTime(distance,type,this.workingAverageSpeed??averageSpeed(this.stage||{sectionType:type}));this.workingTargetDistance=distance;this.workingTargetType=type;this.workingTargetSpeed=this.workingAverageSpeed??averageSpeed(this.stage||{sectionType:type});}
  }
  showReuseStage(){
    if(!this.local||!this.stage||this.stage.sectionType!=='stage'||!this.prepareSwitch())return;
    this.reuseSourceId=this.stageId;const title=this.stage.title||this.data.stages.find(stage=>String(stage.stageId)===this.stageId)?.name||'Stage';
    $('reuseStageName').value=(title+' (linked run)').slice(0,120);$('reuseStageLeg').replaceChildren(new Option('Unassigned',''),...(this.project.legs||[]).map(leg=>new Option(leg.name+(leg.startTime?' · '+leg.startTime:''),leg.id)));$('reuseStageLeg').value=this.stage.legId||'';$('reuseStageDialog').showModal();$('reuseStageName').focus();$('reuseStageName').select();
  }
  reverseDirection(){
    if(!this.prepareSwitch())return;
    if(!this.stage||this.stage.route.length<2){this.notice('Draw a route before reversing its direction.');return;}
    this.selected={layer:'route',id:this.stageId};this.sectionSelected=true;
    this.change(project=>reverseSection(project.stages[this.stageId]));this.notice('Direction reversed, controls swapped and posts renumbered. Undo restores the previous direction.');
  }
  recalculateTargetTime(){
    if(!this.working||!this.liveRoute.ready||this.liveRoute.pending){this.notice('Wait for the route to finish snapping before recalculating.');return;}
    const distance=routeKilometres(this.liveRoute.route),type=this.workingSectionType||this.stage.sectionType;
    this.workingTargetTime=calculatedTargetTime(distance,type,this.workingAverageSpeed??averageSpeed(this.stage||{sectionType:type}));this.workingTargetDistance=distance;this.workingTargetType=type;this.workingTargetSpeed=this.workingAverageSpeed??averageSpeed(this.stage||{sectionType:type});this.render();
  }
  updateRoute(){if(this.working)this.liveRoute.update(this.working,$('routingMode').value);}
  deleteWaypoint(index){
    if(!this.working||this.busy||!Number.isInteger(index)||index<0||index>=this.working.length)return;
    clearTimeout(this.routeClickTimer);this.finishAtStop=false;this.pendingStopPoint=null;
    this.working.splice(index,1);this.selected=null;this.updateRoute();
  }
  finish(splitIndex=null){
    if(!this.working||this.busy)return;
    if(this.working.length===1){this.notice('A route needs at least two points. Add another point or remove the remaining point.');return;}
    if(this.local&&typeof this.workingSectionName==='string'&&!this.workingSectionName.trim()){this.notice('Enter a section name before saving.');return;}
    const points=structuredClone(this.working),mode=$('routingMode').value,id=this.stageId,sectionType=this.workingSectionType,sectionName=this.workingSectionName,createJunctions=this.createRouteJunctions,stopPoint=this.pendingStopPoint,targetTime=this.workingTargetTime,newRoute=this.creatingSectionRoute,speed=this.workingAverageSpeed??averageSpeed(this.stage);
    if(!Number.isFinite(speed)||speed<=0){this.notice('Enter an average speed greater than zero.');return;}
    if(targetTime==='00:00'&&routeKilometres(this.liveRoute.route)>0){this.notice('Enter a target time greater than zero.');return;}
    if(targetTime&&!/^\d{1,3}:[0-5]\d(?::[0-5]\d)?$/.test(targetTime)){this.notice('Enter target time as HH:MM.');return;}
    try{
      const preview=points.length?this.liveRoute.snapshot(points,mode):[];
      const splitting=Number.isInteger(splitIndex)&&splitIndex>0&&splitIndex<points.length-1;
      const first=splitting?points.slice(0,splitIndex+1):points,rest=splitting?points.slice(splitIndex):null;
      const [route,second]=splitting?(mode==='manual'?[first,rest]:splitRoute(preview,points,splitIndex)):[preview,null];
      this.liveRoute.cancel();this.working=null;this.workingSectionType=null;this.workingSectionName=null;this.mode='select';this.selected=null;
      this.change(project=>{
        Object.assign(project.stages[id],{averageSpeedMph:speed,targetTimeAverageSpeedMph:newRoute?speed:(this.workingTargetSpeed??project.stages[id].targetTimeAverageSpeedMph??averageSpeed(project.stages[id])),targetTime:newRoute?calculatedTargetTime(routeKilometres(route),sectionType||project.stages[id].sectionType,speed):(targetTime??project.stages[id].targetTime??''),targetTimeDistanceKm:newRoute?routeKilometres(route):(this.workingTargetDistance??project.stages[id].targetTimeDistanceKm??routeKilometres(project.stages[id].route)),targetTimeSectionType:newRoute?(sectionType||project.stages[id].sectionType):(this.workingTargetType||project.stages[id].targetTimeSectionType||project.stages[id].sectionType),route,waypoints:first,routing:mode,sectionType:sectionType||project.stages[id].sectionType,...(this.local&&typeof sectionName==='string'?{title:sectionName.trim()}: {})});
        if(createJunctions){let number=Math.max(0,...project.stages[id].junctions.map(item=>item.number||0));for(const point of first.slice(1,-1))project.stages[id].junctions.push({id:crypto.randomUUID(),name:'Post '+(++number),kind:'Junction',number,point:[...point],notes:'',locationId:''});}
        if(!splitting&&(newRoute||createJunctions||stopPoint))ensureRouteEndControls(project.stages[id]);
        if(second){
          const nextId='local-'+crypto.randomUUID(),next=emptyStage();
          Object.assign(next,{route:second,waypoints:rest,routing:mode,sectionType:project.stages[id].sectionType==='stage'?'liaison':'stage',title:'Split section',identifier:'NEW',...(project.stages[id].legId?{legId:project.stages[id].legId}:{})});
          project.stages[nextId]=next;
          const order=project.sectionOrder||Object.keys(project.stages).filter(key=>key!==nextId);order.splice(order.indexOf(id)+1,0,nextId);project.sectionOrder=order;
        }
      });
      this.creatingSectionRoute=false;this.createRouteJunctions=false;this.finishAtStop=false;this.pendingStopPoint=null;this.notice(this.dirty?'Route kept in this session but could not be saved. Export a copy.':splitting?'Section split. Existing controls and posts remain in the first section; review their assignments.':'Route saved.');
    }catch(error){this.notice(error.message);}
  }
  cancel(){if(this.busy)return;this.creatingSectionRoute=false;this.finishAtStop=false;this.pendingStopPoint=null;this.pendingStartStageId=null;this.createRouteJunctions=false;this.liveRoute.cancel();this.working=null;this.workingSectionType=null;this.workingSectionName=null;this.mode='select';this.notice('');this.render();}
  undo(){if(this.busy)return;if(this.working){this.finishAtStop=false;this.pendingStopPoint=null;this.working.pop();this.updateRoute();return;}if(!this.history)return;this.history.undo();this.selected=null;this.dirty=true;this.save();this.render();if(!this.dirty)this.notice('Change undone.');}
  redo(){if(this.working||!this.history)return;this.history.redo();this.selected=null;this.dirty=true;this.save();this.render();if(!this.dirty)this.notice('Change redone.');}
  selectRoute(id){
    if(this.working||!this.project?.stages[id]||!this.prepareSwitch())return;
    this.sectionSelected=true;this.stageId=id;$('stages').value=id;this.selected={layer:'route',id};this.mode='select';
    this.inspectedSelection=null;this.render();
  }
  addRouteDirection(route,color,parent){
    const arrows=L.featureGroup();
    const draw=()=>{
      arrows.clearLayers();const zoom=this.map.getZoom(),bounds=this.map.getBounds().pad(.1);
      for(const arrow of directionArrows(route.map(point=>this.map.project(point,zoom)))){
        const coordinates=arrow.map(point=>this.map.unproject(L.point(point.x,point.y),zoom));
        if(!bounds.contains(coordinates[1]))continue;
        L.polyline(coordinates,{color:'#102832',weight:4,opacity:.85,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(arrows);
        L.polyline(coordinates,{color,weight:2,opacity:1,interactive:false,lineCap:'round',lineJoin:'round'}).addTo(arrows);
      }
    };
    arrows.on('add',()=>{draw();this.map.on('zoomend moveend',draw);});
    arrows.on('remove',()=>this.map.off('zoomend moveend',draw));arrows.addTo(parent);
  }
  icon(kind,text='',side=1,services={}) {
    if(this.project?.visibility?.junctions===false)services={};
    if(kind==='junctions'||(kind==='controls'&&(['Start','Flying finish','Stop','Arrival','Time control'].includes(text)||services.radio||services.medic))){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 80 80');svg.setAttribute('aria-hidden','true');
      const shape=(tag,attributes)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,String(value));svg.append(node);return node;};
      const subJunction=kind==='junctions'&&/[a-z]+$/.test(String(text)),radius=kind==='junctions'?(subJunction?11:14):17;
      const offset=typeof side==='object'?side:{x:side>0?20:-20,y:-27},cx=40,cy=40,tipX=cx-offset.x,tipY=cy-offset.y,length=Math.hypot(offset.x,offset.y),ux=-offset.x/length,uy=-offset.y/length;
      shape('path',{d:`M ${cx+ux*(radius-2)-uy*3} ${cy+uy*(radius-2)+ux*3} L ${tipX} ${tipY} L ${cx+ux*(radius-2)+uy*3} ${cy+uy*(radius-2)-ux*3} Z`,fill:'#111'});
      shape('circle',{cx,cy,r:radius,fill:'#fff',stroke:'#111','stroke-width':1.8});
      if(kind==='controls'&&['Arrival','Time control'].includes(text)){
        shape('circle',{cx,cy:cy+1,r:10.5,fill:'none',stroke:'#1976d2','stroke-width':1.8});
        shape('path',{d:`M ${cx} ${cy-10} V ${cy-14} M ${cx-2} ${cy-14} H ${cx+2} M ${cx-7} ${cy-7} L ${cx-10} ${cy-10} M ${cx+7} ${cy-7} L ${cx+10} ${cy-10}`,fill:'none',stroke:'#1976d2','stroke-width':2,'stroke-linecap':'round'});
        for(let index=0;index<8;index++){
          const angle=index*Math.PI/4;shape('path',{d:`M ${cx+Math.sin(angle)*8.5} ${cy+1-Math.cos(angle)*8.5} L ${cx+Math.sin(angle)*10.5} ${cy+1-Math.cos(angle)*10.5}`,stroke:'#1976d2','stroke-width':1});
        }
        shape('path',{d:`M ${cx-5} ${cy-3} L ${cx} ${cy+1} L ${cx+5} ${cy-4}`,fill:'none',stroke:'#1976d2','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round'});
      }else if(kind==='controls'&&['Start','Flying finish'].includes(text)){
        const x=cx-8,y=cy-10;
        shape('path',{d:`M ${x} ${y-1} V ${cy+11}`,fill:'none',stroke:'#111','stroke-width':2});
        shape('rect',{x,y,width:18,height:13,fill:text==='Start'?'#168544':'#fff',stroke:'#111','stroke-width':1});
        if(text==='Flying finish')for(let row=0;row<3;row++)for(let column=0;column<4;column++)if((row+column)%2===0)shape('rect',{x:x+column*4.5,y:y+row*13/3,width:4.5,height:13/3,fill:'#111'});
      }else{
        const label=shape('text',{x:cx,y:cy+1,'text-anchor':'middle','dominant-baseline':'middle',fill:kind==='controls'&&text==='Stop'?'#d32f2f':'#111','font-family':'Arial, sans-serif','font-size':kind==='controls'?10:subJunction?(String(text).length>3?8:10):String(text).length>3?10:14,'font-weight':kind==='controls'?700:500});label.textContent=kind==='controls'?(text==='Stop'?'STOP':'C'):text;
      }
      const badges=[...(services.radio?['radio']:[]),...(services.medic?['medic']:[])];
      for(const [index,service]of badges.entries()){
        const badgeOffset=serviceBadgeOffsets(services,radius)[index],x=cx+badgeOffset.x,y=cy+badgeOffset.y;shape('circle',{cx:x,cy:y,r:15,fill:'#fff',stroke:'#111','stroke-width':2.5});
        if(service==='medic')shape('path',{d:`M ${x-3} ${y-10} H ${x+3} V ${y-3} H ${x+10} V ${y+3} H ${x+3} V ${y+10} H ${x-3} V ${y+3} H ${x-10} V ${y-3} H ${x-3} Z`,fill:'#d32f2f'});
        else shape('path',{d:`M ${x-1} ${y-10} H ${x+6} L ${x+1} ${y-2} H ${x+7} L ${x-5} ${y+11} L ${x-2} ${y+2} H ${x-8} Z`,fill:'#f2c600',stroke:'#a58000','stroke-width':.5});
      }
      const width=80+badges.length*34;svg.setAttribute('viewBox','0 0 '+width+' 80');svg.style.width=width+'px';
      return L.divIcon({className:'junction-callout',html:svg,iconSize:[width,80],iconAnchor:[tipX,tipY],tooltipAnchor:[offset.x,offset.y]});
    }
    return L.divIcon({className:`author-marker ${kind}`,html:el('span',kind==='controls'?'C':text),iconSize:[26,26],iconAnchor:[13,13]});
  }
  calloutPosition(point,key,services={},radius=17){
    if(this.project?.visibility?.junctions===false)services={};
    const zoom=this.map.getZoom();
    if(!this.calloutPaths||this.calloutPaths.zoom!==zoom)this.calloutPaths={zoom,paths:Object.values(this.project.stages).filter(stage=>stage.visible&&stage.layers.route&&this.project.visibility?.[stage.sectionType==='liaison'?'liaison':'route']!==false).map(stage=>stage.route.map(coordinate=>this.map.project(coordinate,zoom)))};
    this.calloutPaths.centers||=new Map();for(const id of this.calloutPaths.centers.keys())if(id.startsWith(key+':badge:'))this.calloutPaths.centers.delete(id);
    const projected=this.map.project(point,zoom),occupied=[...this.calloutPaths.centers].filter(([id])=>id!==key).map(([,center])=>center);
    const offset=calloutOffset(projected,this.calloutPaths.paths,occupied,serviceBadgeOffsets(services,radius));
    const center={x:projected.x+offset.x,y:projected.y+offset.y};this.calloutPaths.centers.set(key,center);for(const [index,badge]of serviceBadgeOffsets(services,radius).entries())this.calloutPaths.centers.set(key+':badge:'+index,{x:center.x+badge.x,y:center.y+badge.y});return offset;
  }
  render({preserveInspector=false}={}){
    this.calloutPaths=null;
    if(!this.data)return;
    if(document.activeElement!==$('eventName'))$('eventName').value=this.project.eventName??this.data.event.name??'';this.syncUnitRadios();
    if(this.local){this.data.stages=(this.project.sectionOrder||Object.keys(this.project.stages)).map(id=>[id,this.project.stages[id]]).map(([id,stage],index)=>({stageId:id,name:stage.title||`Stage ${index+1}`,identifier:stage.identifier||`SS${index+1}`}));if(!this.project.stages[this.stageId])this.stageId=this.data.stages[0]?.stageId||'';$('stages').replaceChildren(...this.data.stages.map(stage=>new Option(`${stage.identifier} · ${stage.name}`,stage.stageId)));$('stages').value=this.stageId;}
    if(!this.local&&this.project.sectionOrder){const order=this.project.sectionOrder;this.data.stages.sort((a,b)=>order.indexOf(String(a.stageId))-order.indexOf(String(b.stageId)));}
    if(!this.local)for(const source of this.data.stages)source.identifier=this.project.stages[String(source.stageId)]?.identifier||source.identifier;
    for(const group of this.groups.values())this.map?.removeLayer(group.parent);this.groups.clear();this.handles?.clearLayers();
    for(const source of this.data.stages){
      const id=String(source.stageId),stage=this.project.stages[id],active=this.sectionSelected&&id===this.stageId;
      if(!this.map)continue;
      const layers=Object.fromEntries(layerNames.map(name=>[name,L.featureGroup()])),parent=L.featureGroup();this.groups.set(id,{parent,layers});
      const editing=active&&this.working;
      const route=editing?this.liveRoute.route:stage.route,sectionType=editing?(this.workingSectionType||stage.sectionType):stage.sectionType;
      if(route.length>1){
        const routeColor=this.project.legs?.find(leg=>leg.id===stage.legId)?.color||(sectionType==='liaison'?'#f0b55a':'#e53935');
        if(active&&(this.selected?.layer==='route'||editing))L.polyline(route,{color:'#fff4a3',weight:12,opacity:.9,interactive:false,className:'selected-route-glow'}).addTo(layers.route);
        L.polyline(route,{color:routeColor,dashArray:editing&&!this.liveRoute.ready?'5 7':sectionType==='liaison'?'9 7':null,weight:active&&this.selected?.layer==='route'?7:5,opacity:editing&&!this.liveRoute.ready?.4:active?1:.6,interactive:false}).addTo(layers.route);
        if(this.project.visibility?.directions!==false)this.addRouteDirection(route,routeColor,layers.route);
        if(this.mode==='select'&&!this.working){
          const hit=L.polyline(route,{weight:18,opacity:0,bubblingMouseEvents:false,className:'route-hit-area'});
          const label=`Route properties: ${source.identifier||''} ${source.name}`.trim();
          hit.on('click',()=>this.selectRoute(id));
          hit.on('add',()=>{const path=hit.getElement();path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',label);L.DomEvent.on(path,'keydown',event=>{if(event.key==='Enter'||event.key===' '){L.DomEvent.stop(event);this.selectRoute(id);}});});
          hit.addTo(layers.route);
        }
      }
      for(const layer of ['controls','junctions'])for(const item of stage[layer]){
        const marker=L.marker(item.point,{draggable:active&&this.mode==='select',title:`${source.identifier||source.name} · ${locationName(item)}`,icon:this.icon(layer==='junctions'&&item.kind!=='Junction'?'controls':layer,layer==='controls'||item.kind!=='Junction'?item.kind:junctionLabel(item),stage.junctions.indexOf(item)%2?-1:1,item.services)});
        const isSelected=active&&this.selected?.layer===layer&&this.selected?.id===item.id;
        const highlight=()=>{marker.getElement()?.classList.toggle('selected-map-item',!!isSelected);if(isSelected)marker.setZIndexOffset(1000);};
        if(layer==='junctions')marker.on('contextmenu',event=>{
          if(this.working)return;const popup=L.popup().setLatLng(event.latlng),menu=el('div',null,'junction-context-menu');
          const extend=button('Extend previous post',()=>{popup.remove();if(!this.prepareSwitch())return;try{this.change(project=>extendPreviousJunction(project.stages[id],item.id));this.notice('Posts renumbered. Undo restores their previous numbers.');}catch(error){this.notice(error.message);}});
          extend.disabled=stage.junctions.indexOf(item)===0||!!item.suffix;const renumber=button('Renumber stage posts',()=>{popup.remove();if(!this.prepareSwitch())return;try{this.change(project=>renumberJunctions(project.stages[id]));this.notice('Stage posts renumbered in route order. Undo restores the previous numbering.');}catch(error){this.notice(error.message);}});renumber.disabled=stage.route.length<2&&stage.waypoints.length<2;menu.append(extend,renumber);popup.setContent(menu).openOn(this.map);
        });
        if(layer==='junctions'||['Start','Flying finish','Stop','Arrival','Time control'].includes(item.kind)){
          const position=()=>{marker.setIcon(this.icon(layer==='junctions'&&item.kind!=='Junction'?'controls':layer,layer==='controls'||item.kind!=='Junction'?item.kind:junctionLabel(item),this.calloutPosition(marker.getLatLng(),id+':'+item.id,item.services,layer==='junctions'&&item.kind==='Junction'?(item.suffix?11:14):17),item.services));highlight();};
          marker.on('add',()=>{position();this.map.on('zoomend',position);});marker.on('remove',()=>this.map.off('zoomend',position));marker.on('dragend',position);
        }
        marker.on('add',highlight);
        marker.bindTooltip(el('span',layer==='junctions'?junctionLabel(item)+' · '+locationName(item):item.name));marker.on('click',()=>{if(this.working)return;this.sectionSelected=true;this.stageId=id;$('stages').value=id;this.selected={layer,id:item.id};this.mode='select';this.render();});
        marker.on('dragend',()=>{const point=marker.getLatLng();this.change(project=>{project.stages[id][layer].find(row=>row.id===item.id).point=[point.lat,point.lng];});});marker.addTo(layers[layer]);
      }
      for(const location of this.data.details[id]?.locations||[]){
        const point=marshalPoint(location,stage);if(!point)continue;
        const summary=locationSummary(location,id,this.data.allocations,this.data.details[id].roles);
        const marker=L.marker(point,{title:`Marshals · ${source.identifier||source.name} · ${location.name}`,icon:this.icon(`marshals ${summary.status}`,String(summary.allocated)),zIndexOffset:200});
        marker.bindTooltip(el('span',`${location.name} · ${summary.allocated} allocated${summary.shortfall?` · ${summary.shortfall} more needed`:''}`));
        marker.on('click',()=>{if(this.working)return;this.sectionSelected=true;this.stageId=id;$('stages').value=id;this.selected={layer:'marshals',id:String(location.locationId)};this.mode='select';this.render();});marker.addTo(layers.marshals);
      }
      for(const name of layerNames)if(stage.layers[name]&&this.project.visibility?.[name==='route'&&sectionType==='liaison'?'liaison':name]!==false)layers[name].addTo(parent);
      if(stage.visible&&(active||$('otherStages').checked))parent.addTo(this.map);
    }
    if(this.map&&this.working&&this.stage.visible&&this.stage.layers.route&&this.project.visibility?.[(this.workingSectionType||this.stage.sectionType)==='liaison'?'liaison':'route']!==false){
      this.working.forEach((point,index)=>{
        const marker=L.marker(point,{draggable:true,title:`Route point ${index+1} — drag to move`,icon:L.divIcon({className:'route-edit-handle',html:el('span'),iconSize:[12,12],iconAnchor:[6,6]})});
        marker.on('dragend',()=>{if(this.busy){this.render();return;}const value=marker.getLatLng();this.working[index]=[value.lat,value.lng];this.updateRoute();});
        marker.on('contextmenu',event=>{
          if(this.busy)return;clearTimeout(this.routeClickTimer);
          const popup=L.popup().setLatLng(event.latlng),menu=el('div',null,'junction-context-menu');
          menu.append(button('Delete waypoint',()=>{popup.remove();this.deleteWaypoint(index);}));popup.setContent(menu).openOn(this.map);
        });
        marker.on('click',()=>{this.selected={layer:'vertex',id:index};this.inspector();});marker.addTo(this.handles);
      });
    }
    this.renderLayers();this.renderKey();this.renderReferences();if(!preserveInspector)this.inspector();else if(['controls','junctions'].includes(this.selected?.layer)){const item=this.stage[this.selected.layer].find(marker=>marker.id===this.selected.id);if(item)this.markerDistances($('details'),item);}this.tools();
  }
  tools(){
    const has=!!this.stage;$('mapTools').hidden=!has||!this.sectionSelected;const paneSaveDisabled=()=>{const save=$('details').querySelector('.save-section');if(save)save.disabled=$('finishRoute').disabled;};
    for(const mode of ['select','route','controls','junctions']){const n=$(`tool-${mode}`);n.classList.toggle('active',mode!=='select'&&this.mode===mode);if(mode==='select')n.removeAttribute('aria-pressed');else n.setAttribute('aria-pressed',String(this.mode===mode));n.disabled=!has||!this.map;}
    const routeLabel=this.stage?.route.length?'Edit route':'Draw route';$('tool-route').setAttribute('aria-label',routeLabel);$('tool-route').title=routeLabel;$('tool-route').querySelector('use')?.setAttribute('href',this.stage?.route.length?'#icon-edit':'#icon-route');
    $('workspace').classList.toggle('route-editing',!!this.working||this.mode==='controls');$('toolHint').hidden=this.mode==='select';
    $('finishRoute').hidden=!this.working;$('cancelRoute').hidden=!this.working;$('undo').disabled=this.working?!this.working.length:!this.history?.past.length;$('redo').disabled=!!this.working||!this.history?.future.length;
    const controlOptions=this.stage?.sectionType==='liaison'?['Time control','Passage control']:kinds,previousControl=$('controlKind').value;$('controlKind').replaceChildren(...controlOptions.map(kind=>new Option(controlTypeLabel(kind),kind)));$('controlKind').value=controlOptions.includes(previousControl)?previousControl:controlOptions[0];
    const addPicker=$('tool-controls'),addMenu=$('addPostMenu'),liaison=(this.workingSectionType||this.stage?.sectionType)==='liaison';
    if(liaison){addPicker.textContent='Add waypoint';addPicker.setAttribute('aria-label','Add waypoint');addPicker.removeAttribute('aria-haspopup');addPicker.removeAttribute('aria-expanded');addMenu.hidden=true;addMenu.replaceChildren();}
    else {addPicker.setAttribute('aria-label','Add Post');addPicker.setAttribute('aria-haspopup','menu');addPicker.setAttribute('aria-expanded',String(!addMenu.hidden));addPicker.replaceChildren(document.createTextNode(this.mode==='controls'?'Add '+controlTypeLabel($('controlKind').value)+' ':'Add Post '),el('span','▾'));addMenu.replaceChildren(...controlOptions.map(kind=>{
      const item=button(controlTypeLabel(kind),()=>{addMenu.hidden=true;addPicker.setAttribute('aria-expanded','false');$('controlKind').value=kind;this.setMode('controls');addPicker.focus();this.notice('Click the map to add '+controlTypeLabel(kind)+'. Keep clicking to add more.');});item.setAttribute('role','menuitemradio');item.setAttribute('aria-checked',String(this.mode==='controls'&&$('controlKind').value===kind));return item;
    }));
}
    $('controlKind').hidden=true;$('routingMode').hidden=!this.working;$('routingMode').disabled=!!this.busy;$('finishRoute').disabled=!!this.busy||(!this.liveRoute.ready&&this.working?.length!==0)||this.liveRoute.pending||(this.local&&typeof this.workingSectionName==='string'&&!this.workingSectionName.trim());paneSaveDisabled();$('retryRoute').hidden=!this.working||!this.liveRoute.error;$('cancelRoute').disabled=!!this.busy;$('undo').disabled=!!this.busy||$('undo').disabled;
    $('toolHint').textContent=this.mode==='route'?'Road snapping updates as you add or drag waypoints. Finish saves the preview. Select an interior waypoint to split a local section. Manual draws straight lines.':this.mode==='controls'?'Click the map to place a control placeholder.':this.mode==='junctions'?'Click the map to place a post.':'Draw a route, then add controls and posts. Select a marker to edit it; drag to move it.';
    $('map').classList.toggle('drawing',this.mode!=='select');
    const route=this.working?this.liveRoute.route:this.stage?.route||[];
    $('routeLength').textContent=this.distance(routeKilometres(route)).split(' ')[0];$('distanceUnit').textContent=this.project.units==='mi'?'mi':'km';const all=Object.values(this.project.stages);$('rallyTotals').textContent='Rally: '+this.distance(all.filter(row=>row.sectionType==='stage').reduce((sum,row)=>sum+routeKilometres(row.route),0))+' stages · '+this.distance(all.filter(row=>row.sectionType==='liaison').reduce((sum,row)=>sum+routeKilometres(row.route),0))+' liaison';$('controlCount').textContent=this.stage?.controls.length||0;$('junctionCount').textContent=this.stage?.junctions.length||0;
    const allocations=this.data.allocations.filter(item=>String(item.stageId)===this.stageId&&item.personId&&item.invitationStatus!=='Invited');$('marshalCount').textContent=new Set(allocations.map(item=>String(item.personId))).size;
  }
  moveSection(sourceId,targetId,after=false){
    if(!this.prepareSwitch())return;
    try{
      const next=reorderedSections(this.project,sourceId,targetId,after),current=this.project.sectionOrder||Object.keys(this.project.stages);
      if(JSON.stringify(next)===JSON.stringify(current)&&this.project.stages[sourceId].legId===this.project.stages[targetId].legId)return;
      this.change(project=>{project.sectionOrder=next;const legId=project.stages[targetId].legId;if(legId)project.stages[sourceId].legId=legId;else delete project.stages[sourceId].legId;});this.notice('Itinerary reordered. Undo restores the previous order.');
    }catch(error){this.notice(error.message);}
  }
  moveSectionToLeg(sourceId,legId){
    if(!this.prepareSwitch())return;
    if(!this.project.stages[sourceId]||(legId&&!this.project.legs?.some(leg=>leg.id===legId))){this.notice('This section or leg no longer exists.');return;}
    if((this.project.stages[sourceId].legId||'')===legId)return;
    this.change(project=>{if(legId)project.stages[sourceId].legId=legId;else delete project.stages[sourceId].legId;
      const order=(project.sectionOrder||Object.keys(project.stages)).filter(id=>id!==sourceId),members=order.filter(id=>(project.stages[id].legId||'')===legId);
      order.splice(members.length?order.indexOf(members.at(-1))+1:order.length,0,sourceId);project.sectionOrder=order;
    });this.notice('Section moved. Undo restores its previous leg.');
  }
  renderLayers(){
    const tree=$('layerTree');tree.replaceChildren();
    const clear=()=>tree.querySelectorAll('.dragging,.drop-before,.drop-after,.leg-drop').forEach(row=>row.classList.remove('dragging','drop-before','drop-after','leg-drop'));
    const dateLabel=el('label','Event date','itinerary-event-date'),eventDate=el('input');eventDate.type='date';eventDate.value=this.project.eventDate||'';dateLabel.append(eventDate);tree.append(dateLabel);eventDate.onchange=()=>{if(!this.prepareSwitch()){eventDate.value=this.project.eventDate||'';return;}this.change(project=>{project.eventDate=eventDate.value;});};
    const addLeg=button('+ Add leg',()=>{if(!this.prepareSwitch())return;this.change(project=>{project.legs||=[];project.legs.push({id:'leg-'+crypto.randomUUID(),name:'Leg '+(project.legs.length+1),color:['#36d6b0','#f0b55a','#a88beb','#63b8f5'][project.legs.length%4]});});});addLeg.className='add-leg';const actions=el('div',null,'itinerary-add-actions'),addLiaison=button('+ Add liaison',()=>this.addStage('liaison'));addLiaison.hidden=!this.local;const addStage=button('+ Add stage',()=>this.addStage());addStage.hidden=!this.local;actions.append(addLeg,addStage,addLiaison);tree.append(actions);
    const containers=new Map();
    for(const leg of [...(this.project.legs||[]),{id:'',name:'Unassigned sections'}]){
      if(!leg.id&&!(this.project.legs||[]).length){containers.set('',tree);continue;}
      const group=el('section',null,'leg-group'),heading=el('div',null,'leg-heading');group.dataset.legId=leg.id;
      this.collapsedLegs||=new Set();
      const contents=el('div',null,'leg-sections');contents.id='leg-sections-'+(leg.id||'unassigned');contents.hidden=this.collapsedLegs.has(leg.id);
      const toggle=button(contents.hidden?'▸':'▾',()=>{contents.hidden=!contents.hidden;if(contents.hidden)this.collapsedLegs.add(leg.id);else this.collapsedLegs.delete(leg.id);toggle.textContent=contents.hidden?'▸':'▾';toggle.setAttribute('aria-expanded',String(!contents.hidden));});toggle.className='leg-toggle';toggle.setAttribute('aria-label','Toggle sections in '+leg.name);toggle.setAttribute('aria-controls',contents.id);toggle.setAttribute('aria-expanded',String(!contents.hidden));heading.append(toggle);
      group.ondragover=event=>{if(!this.draggedSectionId||event.target.closest('.itinerary-row'))return;event.preventDefault();clear();group.classList.add('leg-drop');event.dataTransfer.dropEffect='move';};
      group.ondragleave=event=>{if(!group.contains(event.relatedTarget))group.classList.remove('leg-drop');};
      group.ondrop=event=>{if(event.target.closest('.itinerary-row'))return;event.preventDefault();event.stopPropagation();const sourceId=this.draggedSectionId;clear();this.draggedSectionId=null;if(sourceId)this.moveSectionToLeg(sourceId,leg.id);};
      if(leg.id){
        const name=el('input');name.value=leg.name;name.maxLength=120;name.setAttribute('aria-label','Leg name '+leg.name);name.disabled=!!this.working;
        name.onchange=()=>{if(!name.value.trim()){name.value=leg.name;return;}if(this.prepareSwitch())this.change(project=>{project.legs.find(item=>item.id===leg.id).name=name.value.trim();});};
        const color=el('input');color.type='color';color.value=leg.color;color.setAttribute('aria-label','Route colour for '+leg.name);color.disabled=!!this.working;color.onchange=()=>{if(this.prepareSwitch())this.change(project=>{project.legs.find(item=>item.id===leg.id).color=color.value;});};
        const remove=button('×',()=>{if(!this.prepareSwitch())return;try{this.change(project=>removeLeg(project,leg.id));}catch(error){this.notice(error.message);}});remove.setAttribute('aria-label','Remove '+leg.name);remove.disabled=!!this.working||Object.values(this.project.stages).some(stage=>stage.legId===leg.id);remove.title=remove.disabled?'Only empty legs can be removed':'Remove empty leg';heading.append(color,name,remove);
        const startLabel=el('label','Leg start time','leg-start-time'),startTime=el('input');startTime.type='time';startTime.step=60;startTime.value=leg.startTime||'';startTime.disabled=!!this.working;startTime.setAttribute('aria-label','Start time for '+leg.name);startLabel.append(startTime);group.append(startLabel);startTime.onchange=()=>{if(this.prepareSwitch())this.change(project=>{project.legs.find(item=>item.id===leg.id).startTime=startTime.value;});};
      }else heading.append(el('span',leg.name));
      group.prepend(heading);group.append(contents);tree.append(group);containers.set(leg.id,contents);
    }
    for(const [index,source]of this.data.stages.entries()){
      const id=String(source.stageId),stage=this.project.stages[id],row=el('section',null,'itinerary-row'+(this.sectionSelected&&id===this.stageId?' selected':''));row.dataset.sectionId=id;row.draggable=!this.working;
      const handle=button('',()=>{});handle.className='section-drag-handle icon-button';handle.disabled=!!this.working;handle.title='Drag to reorder; use Up or Down arrow keys';handle.setAttribute('aria-label','Reorder '+(source.identifier||'')+' '+source.name);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#icon-grip');svg.append(use);handle.append(svg);
      handle.onkeydown=event=>{
        if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const direction=event.key==='ArrowUp'?-1:1,target=this.data.stages[index+direction];
        if(target){this.moveSection(id,String(target.stageId),direction>0);tree.querySelector('[data-section-id="'+CSS.escape(id)+'"] .section-drag-handle')?.focus();}
      };
      const select=button('',()=>{if(!this.prepareSwitch())return;this.sectionSelected=true;this.stageId=id;$('stages').value=id;this.selected={layer:'route',id};this.mode='select';this.inspectedSelection=null;this.render();this.fit();});select.className='itinerary-select';select.setAttribute('aria-current',this.sectionSelected&&id===this.stageId?'true':'false');
      const caption=el('span',source.name,'itinerary-name'),meta=el('span',null,'itinerary-meta');if(stage.linkGroupId)meta.append(el('span','Linked stage','linked-stage-tag'));meta.append(el('span',stage.sectionType==='liaison'?'Liaison':'Special stage','section-tag '+stage.sectionType),el('span',this.distance(routeKilometres(stage.route))));
      select.append(el('span',String(index+1).padStart(2,'0')+' · '+(source.identifier||''),'itinerary-order'),caption,meta);
      const visible=el('input');visible.type='checkbox';visible.checked=stage.visible;visible.setAttribute('aria-label','Show section '+(source.identifier||source.name));visible.onchange=()=>{if(!this.prepareSwitch()){visible.checked=stage.visible;return;}this.change(project=>project.stages[id].visible=visible.checked);};
      const body=el('div',null,'itinerary-body');body.append(select);row.append(handle,body,visible);
      row.ondragstart=event=>{if(this.working){event.preventDefault();return;}this.draggedSectionId=id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);row.classList.add('dragging');};
      row.ondragover=event=>{if(!this.draggedSectionId||this.draggedSectionId===id)return;event.preventDefault();const after=event.clientY>row.getBoundingClientRect().top+row.offsetHeight/2;row.classList.toggle('drop-after',after);row.classList.toggle('drop-before',!after);event.dataTransfer.dropEffect='move';};
      row.ondragleave=()=>row.classList.remove('drop-before','drop-after');
      row.ondrop=event=>{event.preventDefault();event.stopPropagation();const sourceId=this.draggedSectionId||event.dataTransfer.getData('text/plain'),after=event.clientY>row.getBoundingClientRect().top+row.offsetHeight/2;clear();this.draggedSectionId=null;if(sourceId)this.moveSection(sourceId,id,after);};
      row.ondragend=()=>{clear();this.draggedSectionId=null;};
      // Pointer capture supports touch and mouse handles without moving the map.
      let drag=null;
      handle.onpointerdown=event=>{if(this.working||event.button!==0)return;event.preventDefault();drag={x:event.clientX,y:event.clientY,target:null};handle.setPointerCapture(event.pointerId);};
      handle.onpointermove=event=>{
        if(!drag||Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
        const hit=document.elementFromPoint(event.clientX,event.clientY),target=hit?.closest('.itinerary-row'),legTarget=hit?.closest('.leg-group');clear();row.classList.add('dragging');
        if(target&&tree.contains(target)&&target.dataset.sectionId!==id){const after=event.clientY>target.getBoundingClientRect().top+target.offsetHeight/2;target.classList.add(after?'drop-after':'drop-before');drag.target={id:target.dataset.sectionId,after};}else if(legTarget&&tree.contains(legTarget)&&!target){legTarget.classList.add('leg-drop');drag.target={legId:legTarget.dataset.legId};}else drag.target=null;
      };
      handle.onpointerup=event=>{const target=drag?.target;drag=null;if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);clear();if(target){if('legId'in target)this.moveSectionToLeg(id,target.legId);else this.moveSection(id,target.id,target.after);}};
      handle.onpointercancel=()=>{drag=null;clear();};
      (containers.get(stage.legId||'')||tree).append(row);
    }
    const daylight=el('div',null,'itinerary-daylight');daylight.id='itineraryDaylight';daylight.setAttribute('aria-live','polite');tree.append(daylight);this.renderDaylight();
  }
  renderDaylight(){
    const pane=$('itineraryDaylight');if(!pane||!this.project)return;pane.replaceChildren();if(!this.project.eventDate){pane.hidden=true;return;}pane.hidden=false;
    let point=null;for(const id of this.project.sectionOrder||Object.keys(this.project.stages)){const stage=this.project.stages[id];point=stage.controls.find(item=>item.kind==='Start')?.point||stage.junctions.find(item=>item.kind==='Start')?.point||stage.route[0]||stage.waypoints[0];if(point)break;}
    const source=point?'First section start':'Map centre';if(!point&&this.map){const center=this.map.getCenter();point=[center.lat,center.lng];}if(!point){pane.append(el('p','Add a section location to calculate sunrise and sunset.'));return;}
    const times=solarTimes(this.project.eventDate,...point),zone=Intl.DateTimeFormat().resolvedOptions().timeZone,format=value=>value?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(Math.round(value.getTime()/60000)*60000)):'—';
    const list=el('dl',null,'daylight-times');for(const [label,value]of [['Sunrise',times.sunrise],['Sunset',times.sunset]])list.append(el('dt',label),el('dd',format(value)));pane.append(list,el('small',source+' · '+zone));pane.title='Approximate sunrise and sunset at '+point.map(value=>value.toFixed(4)).join(', ');if(times.state!=='normal')pane.append(el('p',times.state));
  }
  renderKey(){
    const pane=$('keyControls');pane.replaceChildren();
    const labels={route:'Stages',liaison:'Liaison',controls:'Controls',junctions:'Posts',marshals:'Marshals'};
    for(const name of Object.keys(labels)){
      const routeLayer=name==='route'||name==='liaison',layer=routeLayer?'route':name;
      const stages=Object.values(this.project.stages).filter(stage=>!routeLayer||(stage.sectionType==='liaison')===(name==='liaison'));
      const label=el('label',null,'key-switch'),check=el('input'),text=el('span',labels[name]);check.type='checkbox';
      const enabled=stages.filter(stage=>stage.layers[layer]&&this.project.visibility?.[name]!==false).length;
      check.checked=this.project.visibility?.[name]!==false&&(!stages.length||enabled===stages.length);check.indeterminate=enabled>0&&enabled<stages.length;check.setAttribute('aria-label','Show '+labels[name].toLowerCase());
      check.onchange=()=>{if(!this.prepareSwitch()){this.renderKey();return;}this.change(project=>{project.visibility={...Object.fromEntries(Object.keys(labels).map(key=>[key,true])),...project.visibility,[name]:check.checked};for(const stage of stages)stage.layers[layer]=check.checked;});};
      label.append(check,el('i',null,'layer-swatch '+name),text);pane.append(label);
    }
    const directionLabel=el('label',null,'key-switch'),directions=el('input');directions.type='checkbox';directions.checked=this.project.visibility?.directions!==false;directions.setAttribute('aria-label','Show direction arrows');
    directions.onchange=()=>this.change(project=>{project.visibility={...project.visibility,directions:directions.checked};});
    directionLabel.append(directions,el('span','↗','direction-key-icon'),el('span','Direction arrows'));pane.append(directionLabel);
    const lines=el('div',null,'key-route-types');lines.append(el('span','Special stage','stage-line'),el('span','Liaison','liaison-line'));pane.append(lines);
  }
  renderReferences(){
    const list=$('referenceList');list.replaceChildren();if(!this.stage)return;
    const query=$('search').value.toLowerCase().trim(),locations=this.data.details[this.stageId]?.locations||[];
    for(const location of locations){const allocations=this.data.allocations.filter(row=>String(row.stageId)===this.stageId&&String(row.locationId)===String(location.locationId));if(![location.name,...allocations.flatMap(row=>[row.personName,row.roleName,row.callSign])].join(' ').toLowerCase().includes(query))continue;
      const item=button(location.name,()=>{if(this.working)return;this.selected={layer:'marshals',id:String(location.locationId)};this.inspector();const point=marshalPoint(location,this.stage);if(point)this.map?.setView(point,Math.max(this.map.getZoom(),14));});item.append(el('small',marshalPoint(location,this.stage)?'View marshal details':'No coordinates — link a placeholder'));list.append(item);
    }
    if(!list.children.length)list.append(el('p',locations.length?'No matching locations or marshals.':'No StageMode locations available for this stage.','empty'));
  }
  showWhat3words(target,point){
    this.wordsLookups||=new Map();const key=point.join(',');target.textContent='Loading…';
    if(!this.wordsLookups.has(key)){
      const request=fetch('/api/what3words',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({point}),signal:AbortSignal.timeout(10000)}).then(async response=>{if(!response.ok)throw new Error();return (await response.json()).data;}).catch(()=>{this.wordsLookups.delete(key);return null;});
      if(this.wordsLookups.size>=512)this.wordsLookups.delete(this.wordsLookups.keys().next().value);this.wordsLookups.set(key,request);
    }
    this.wordsLookups.get(key).then(result=>{if(!target.isConnected)return;target.replaceChildren();if(result?.words){const link=el('a','///'+result.words);link.href='https://what3words.com/'+encodeURIComponent(result.words);link.target='_blank';link.rel='noopener';target.append(link);}else{target.textContent=result?.configured===false?'Not connected':'Unavailable';target.title=result?.configured===false?'Configure a what3words API key on the mapping server.':'Select the marker again to retry.';}});
  }
  markerDistances(pane,item){
    const distances=itineraryMarkerDistances(this.project,this.stageId,item),properties=el('dl',null,'route-properties marker-distances');
    for(const [label,key]of [['Distance from previous','fromPrevious'],['Intermediary distance','intermediary'],['Total distance','total']])properties.append(el('dt',label),el('dd',distances[key]==null?'—':this.distance(distances[key])));
    for(const [label,value]of [['Longitude',item.point[1]],['Latitude',item.point[0]]])properties.append(el('dt',label),el('dd',value.toFixed(6)));
    if(['Time control','Start','Stop','Flying finish','Flying Finish'].includes(item.kind)){const due=firstCarDue(this.project,this.stageId,item);properties.append(el('dt','First car due'),el('dd',due?due.time+(due.dayOffset?' (+'+due.dayOffset+' day'+(due.dayOffset===1?'':'s')+')':''):'—'));}
    const words=el('dd',null,'marker-what3words');properties.append(el('dt','what3words'),words);this.showWhat3words(words,item.point);
    const existing=pane.querySelector('.marker-distances');if(existing)existing.replaceWith(properties);else pane.append(properties);
  }
  inspector(){
    const selection=this.selected?this.stageId+':'+this.selected.layer+':'+this.selected.id:'';
    if(selection&&selection!==this.inspectedSelection)document.dispatchEvent(new CustomEvent('mapping:inspect'));
    this.inspectedSelection=selection;
    const pane=$('details');pane.replaceChildren();pane.classList.toggle('selected-details',!!this.sectionSelected&&!!this.selected);pane.classList.remove('section-editing');
    if(!this.stage){pane.append(el('h2','No stage selected'));return;}
    if(this.selected?.layer==='vertex'&&this.working){const index=this.selected.id;if(!this.working[index]){this.selected=null;return this.inspector();}pane.append(el('h2',`Route point ${index+1}`),el('p',this.working[index].map(value=>value.toFixed(6)).join(', ')),button('Remove point',()=>this.deleteWaypoint(index)),el('p','Click on the map to extend the route from its last point.'));if(this.local&&index>0&&index<this.working.length-1){const split=button('Split section here',()=>this.finish(index));split.disabled=!this.liveRoute.ready||this.liveRoute.pending;pane.append(split);}return;}
    if(this.selected?.layer==='marshals'){const location=(this.data.details[this.stageId]?.locations||[]).find(row=>String(row.locationId)===this.selected.id);if(location){this.staffing(pane,location);return;}}
    const layer=this.selected?.layer,item=['controls','junctions'].includes(layer)?this.stage[layer].find(row=>row.id===this.selected.id):null;
    if(!item){
      pane.classList.toggle('section-editing',!!this.working);
      const source=this.data.stages.find(stage=>String(stage.stageId)===this.stageId),title=source?.name||'Stage';
      if(this.working&&this.local){
        const label=el('label','Section name'),name=el('input');name.value=this.workingSectionName??title;name.required=true;name.maxLength=120;name.className='section-name-input';label.append(name);pane.append(label);
        name.oninput=()=>{this.workingSectionName=name.value;this.tools();};
      }else{
        const heading=el('div',null,'section-title'),edit=button('',()=>this.setMode('route'));edit.className='section-edit-pencil icon-button';edit.setAttribute('aria-label','Edit section');edit.title='Edit section';
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#icon-edit');svg.append(use);edit.append(svg);heading.append(el('h2',title),edit);pane.append(heading);
      }
      const properties=el('dl',null,'route-properties'),typeValue=el('dd');
      properties.append(el('dt','Section Type'),typeValue);
      if(this.working){
        const type=el('select');type.setAttribute('aria-label','Section Type');type.append(new Option('Special stage','stage'),new Option('Liaison','liaison'));type.value=this.workingSectionType||this.stage.sectionType;type.onchange=()=>{this.workingSectionType=type.value;this.updateAutomaticTargetTime();this.render();};typeValue.append(type);
      }else typeValue.textContent=this.stage.sectionType==='liaison'?'Liaison':'Special stage';
      if(this.stage.linkGroupId){const others=Object.entries(this.project.stages).filter(([id,stage])=>id!==this.stageId&&stage.linkGroupId===this.stage.linkGroupId).map(([id,stage])=>stage.title||stage.identifier||id);if(others.length)properties.append(el('dt','Linked with'),el('dd',others.join(', ')));}
      const route=this.working?this.liveRoute.route:this.stage.route,junctions=this.working|| (this.stage.waypoints.length?this.stage.waypoints:this.stage.route);
      if(!this.working)properties.append(el('dt','Length','section-compact-label'),el('dd',this.distance(routeKilometres(route)),'section-compact-value'));
      if(!this.working&&this.stage.sectionType!=='liaison')properties.append(el('dt','Posts','section-compact-label'),el('dd',String(junctions.length),'section-compact-value'));
      const targetValue=el('dd'),targetType=this.workingSectionType||this.stage.sectionType,targetDistance=routeKilometres(route),basisDistance=this.working?(this.workingTargetDistance??routeKilometres(this.stage.route)):(this.stage.targetTimeDistanceKm??targetDistance),basisType=this.working?(this.workingTargetType||this.stage.sectionType):(this.stage.targetTimeSectionType||this.stage.sectionType);targetValue.classList.toggle('target-time-stale',targetTimeNeedsUpdate(targetDistance,targetType,basisDistance,basisType)||(this.working?(this.workingAverageSpeed??averageSpeed(this.stage))!==(this.workingTargetSpeed??averageSpeed(this.stage)):averageSpeed(this.stage)!==(this.stage.targetTimeAverageSpeedMph??averageSpeed(this.stage))));properties.append(el('dt','Target time'),targetValue);
      if(this.working){
        const target=el('input');target.setAttribute('aria-label','Target time (HH:MM)');target.placeholder='00:00';target.maxLength=6;target.pattern='[0-9]{1,3}:[0-5][0-9]';target.value=this.workingTargetTime||'';targetValue.append(target);
        target.oninput=()=>{
          target.setCustomValidity('');this.workingTargetTime=target.value;if(!target.value||!target.checkValidity())return;
          try{this.workingAverageSpeed=speedForTargetTime(routeKilometres(this.liveRoute.route),target.value);this.workingTargetDistance=routeKilometres(this.liveRoute.route);this.workingTargetType=targetType;this.workingTargetSpeed=this.workingAverageSpeed;const speed=properties.querySelector('.section-average-speed');if(speed)speed.value=this.displaySpeed(this.workingAverageSpeed);targetValue.classList.remove('target-time-stale');}catch(error){target.setCustomValidity(error.message);}
        };target.onchange=()=>target.reportValidity();
      }else targetValue.textContent=this.stage.targetTime||'—';
      const speedValue=el('dd',null,'section-speed-value');properties.append(el('dt','Average speed'),speedValue);
      if(this.working){const speedInput=el('input');speedInput.type='number';speedInput.className='section-average-speed';speedInput.min='.1';speedInput.step='.1';speedInput.value=this.displaySpeed(this.workingAverageSpeed??averageSpeed(this.stage));speedInput.setAttribute('aria-label','Average speed ('+this.speedUnit()+')');speedValue.append(speedInput,el('span',' '+this.speedUnit()));speedInput.oninput=()=>{this.workingAverageSpeed=Number(speedInput.value)/(this.project.units==='mi'?1:1.609344);if(speedInput.checkValidity()&&this.workingAverageSpeed>0){this.updateAutomaticTargetTime();const target=targetValue.querySelector('input');if(target){target.value=this.workingTargetTime;target.setCustomValidity('');}targetValue.classList.remove('target-time-stale');}};speedInput.onchange=()=>speedInput.reportValidity();}else speedValue.textContent=this.displaySpeed(averageSpeed(this.stage))+' '+this.speedUnit();
      pane.append(properties);
      if(this.working){
        const actions=el('div',null,'section-edit-actions'),save=button('Save',()=>this.finish()),cancel=button('Cancel',()=>this.cancel());save.className='primary save-section';actions.append(save,cancel);pane.append(actions);
        if(this.local){const remove=button('Delete section',()=>this.deleteStage());remove.className='danger delete-section';actions.append(remove);}
       }else{
        const reverse=button('Reverse direction',()=>this.reverseDirection());reverse.className='reverse-section';reverse.disabled=this.stage.route.length<2;pane.append(reverse);
        if(this.local&&this.stage.sectionType==='stage'){const reuse=button('Create linked stage',()=>this.showReuseStage());reuse.className='reuse-stage';pane.append(reuse);}
      }
      this.detailGroups||=new Map();
      for(const [name,title]of [['junctions','Posts'],['controls','Controls'],['marshals','Marshals'],['furniture','Furniture'],['rescue','Rescue, Recovery & Medical']]){
        if(this.stage.sectionType==='liaison'&&['junctions','rescue'].includes(name))continue;
        const group=el('details',null,'section-detail-group'),summary=el('summary',title),content=el('div',null,'section-detail-items'),key=this.stageId+':'+name;
        group.open=this.detailGroups.get(key)??name==='junctions';group.ontoggle=()=>this.detailGroups.set(key,group.open);
        if(name==='junctions'||name==='controls')for(const marker of this.stage[name])content.append(button(name==='junctions'?'Post '+junctionLabel(marker):marker.name,()=>{this.sectionSelected=true;this.selected={layer:name,id:marker.id};this.render();this.map?.panTo(marker.point);}));
        if(name==='marshals')for(const location of this.data.details[this.stageId]?.locations||[])content.append(button(location.name,()=>{this.selected={layer:'marshals',id:String(location.locationId)};this.inspector();const point=marshalPoint(location,this.stage);if(point)this.map?.panTo(point);}));
        if(!content.children.length)content.append(el('p','None added','empty'));
        group.append(summary,content);pane.append(group);
      }
      return;
    }
    if(layer==='junctions'){
      pane.append(el('h2',locationName(item)));
      const properties=el('dl',null,'route-properties');
      const location=(this.data.details[this.stageId]?.locations||[]).find(row=>String(row.locationId)===String(item.locationId));
      for(const [label,value]of [['Post number',junctionLabel(item)],['Type',item.kind==='Junction'?'Post':item.kind],['StageMode location',location?.name||(item.locationId?'Unavailable location ('+item.locationId+')':'None')]])properties.append(el('dt',label),el('dd',value));
      pane.append(properties);this.markerDistances(pane,item);
      const form=el('form'),field=(label,input)=>{const wrapper=el('label',label);wrapper.append(input);form.append(wrapper);};
      const type=el('select');type.append(...(this.stage.sectionType==='liaison'?['Time control','Passage control']:['Arrival','Start','Junction','Flying Finish','Stop','Control','Time control']).map(value=>new Option(controlTypeLabel(value),value)));type.value=item.kind==='Flying finish'?'Flying Finish':item.kind;if(!type.value)type.value=this.stage.sectionType==='liaison'?'Time control':'Junction';field('Post type',type);
      const controlName=el('input');controlName.maxLength=120;controlName.value=item.controlName||'';field('Control name',controlName);
      const predictedMarshals=el('input');predictedMarshals.type='number';predictedMarshals.min=0;predictedMarshals.step=1;predictedMarshals.value=item.predictedMarshals||0;field('Predicted marshals',predictedMarshals);
      const controlIdentifier=el('input');controlIdentifier.maxLength=40;controlIdentifier.value=item.controlIdentifier||'';const identifierLabel=el('label','Control identifier');identifierLabel.append(controlIdentifier);form.append(identifierLabel);
      const updateIdentifier=()=>{identifierLabel.hidden=!['Time control','Start','Stop'].includes(type.value);};updateIdentifier();
      const information=el('textarea');information.maxLength=2000;information.value=item.notes||'';field('Information',information);
      const services=el('fieldset',null,'post-services'),serviceInputs={};services.append(el('legend','Services'));
      for(const [key,title]of Object.entries(postServices)){const label=el('label',null,'post-service'),checkbox=el('input');checkbox.type='checkbox';checkbox.setAttribute('role','switch');checkbox.checked=item.services?.[key]===true;serviceInputs[key]=checkbox;label.append(checkbox,el('span',title));services.append(label);}form.append(services);
      const stageId=this.stageId,savePost=()=>{if(!predictedMarshals.checkValidity()||!Number.isSafeInteger(Number(predictedMarshals.value)))return;this.saveMarkerFields(stageId,'junctions',item.id,{kind:type.value==='Flying Finish'?'Flying finish':type.value,controlName:controlName.value.trim(),predictedMarshals:Number(predictedMarshals.value),controlIdentifier:controlIdentifier.value.trim(),notes:information.value,services:Object.fromEntries(Object.entries(serviceInputs).map(([key,input])=>[key,input.checked]))});};
      form.oninput=()=>{updateIdentifier();savePost();};form.onchange=()=>{updateIdentifier();savePost();this.render({preserveInspector:true});};form.onsubmit=event=>{event.preventDefault();savePost();};
      pane.append(form);if(location)this.staffing(pane,location);return;
    }
    pane.append(el('h2',item.kind));this.markerDistances(pane,item);const form=el('form');
    const field=(text,input)=>{const label=el('label',text);label.append(input);form.append(label);return input;};
    const name=el('input');name.value=item.name;name.required=true;name.maxLength=120;field('Name',name);
    const predictedMarshals=el('input');predictedMarshals.type='number';predictedMarshals.min=0;predictedMarshals.step=1;predictedMarshals.value=item.predictedMarshals||0;field('Predicted marshals',predictedMarshals);
    const number=el('input');if(layer==='junctions'){number.type='text';number.pattern='[1-9][0-9]{0,3}[a-z]{0,3}';number.required=true;number.value=junctionLabel(item);field('Post number',number);}
    const type=el('select');type.append(...(this.stage.sectionType==='liaison'?['Time control','Passage control']:layer==='controls'?kinds:['Junction']).map(kind=>new Option(controlTypeLabel(kind),kind)));type.value=item.kind;if(!type.value)type.value=this.stage.sectionType==='liaison'?'Time control':kinds[0];field('Type',type);
    const controlIdentifier=el('input');controlIdentifier.maxLength=40;controlIdentifier.value=item.controlIdentifier||'';const identifierLabel=el('label','Control identifier');identifierLabel.append(controlIdentifier);form.append(identifierLabel);const updateIdentifier=()=>{identifierLabel.hidden=!['Time control','Start','Stop'].includes(type.value);};updateIdentifier();
    const link=el('select');link.append(new Option('No StageMode link',''));const linked=new Set([...this.stage.controls,...this.stage.junctions].filter(row=>row.id!==item.id).map(row=>String(row.locationId)));
    for(const location of this.data.details[this.stageId]?.locations||[])if(!linked.has(String(location.locationId)))link.append(new Option(location.name,location.locationId));
    if(item.locationId&&![...link.options].some(option=>option.value===String(item.locationId)))link.append(new Option(`Unavailable location (${item.locationId})`,item.locationId));link.value=item.locationId;field('StageMode location',link);
    const notes=el('textarea');notes.value=item.notes;notes.maxLength=2000;field('Notes',notes);
    const services=el('fieldset',null,'post-services'),serviceInputs={};services.append(el('legend','Services'));
    for(const [key,title]of Object.entries(postServices)){const label=el('label',null,'post-service'),checkbox=el('input');checkbox.type='checkbox';checkbox.setAttribute('role','switch');checkbox.checked=item.services?.[key]===true;serviceInputs[key]=checkbox;label.append(checkbox,el('span',title));services.append(label);}form.append(services);
    const stageId=this.stageId,saveControl=()=>{
      name.setCustomValidity(name.value.trim()?'':'Enter a name.');if(!form.checkValidity()||!Number.isSafeInteger(Number(predictedMarshals.value)))return;
      this.saveMarkerFields(stageId,layer,item.id,{name:name.value.trim(),kind:type.value,predictedMarshals:Number(predictedMarshals.value),controlIdentifier:controlIdentifier.value.trim(),locationId:link.value,notes:notes.value,services:Object.fromEntries(Object.entries(serviceInputs).map(([key,input])=>[key,input.checked]))});
    };
    form.oninput=()=>{updateIdentifier();saveControl();};form.onchange=()=>{updateIdentifier();saveControl();this.render({preserveInspector:true});};form.onsubmit=event=>{event.preventDefault();saveControl();};pane.append(form,button('Delete placeholder',()=>{const id=item.id;this.selected=null;this.change(project=>{project.stages[this.stageId][layer]=project.stages[this.stageId][layer].filter(row=>row.id!==id);});}));
    pane.append(el('p','Drag this marker to move it. Hide the Marshals layer if its badge covers the marker. Changes here stay in the map draft.'));
    const location=(this.data.details[this.stageId]?.locations||[]).find(row=>String(row.locationId)===String(item.locationId));if(location)this.staffing(pane,location);
  }
  staffing(pane,location){
    const detail=this.data.details[this.stageId],summary=locationSummary(location,this.stageId,this.data.allocations,detail?.roles);
    pane.append(el('h2',location.name),el('p',`${summary.allocated} allocated · ${summary.shortfall?`${summary.shortfall} more needed`:summary.status==='covered'?'Requirements met':'No requirements specified'}`));
    for(const requirement of summary.requirements){pane.append(el('h3',`${requirement.name}: ${requirement.people.length} / ${requirement.required}`));for(const person of requirement.people)pane.append(el('p',[person.personName,person.callSign,person.alreadySignedOn?'Signed on':'Not signed on'].filter(Boolean).join(' · ')));}
    if(summary.pending)pane.append(el('p',`${summary.pending} pending invitation(s), excluded from coverage.`));
    const point=marshalPoint(location,this.stage);if(point)this.markerDistances(pane,[...this.stage.controls,...this.stage.junctions].find(item=>String(item.locationId)===String(location.locationId))||{id:'marshal-'+location.locationId,point});pane.append(el('p',point?`Map position: ${point.map(value=>value.toFixed(6)).join(', ')}`:'No coordinates: link this location to a control or junction placeholder.'));
    if(location.comment)pane.append(el('p',location.comment));
    if(this.data.event.eventId!=='demo'&&!this.local){const link=el('a','Open StageMode marshal planning ↗');link.href=`${this.controlUrl()}/event/marshals.html?eventId=${encodeURIComponent(this.data.event.eventId)}`;link.target='_blank';link.rel='noopener';pane.append(link);}
  }
  fit(){if(!this.map||!this.stage)return;const group=this.groups.get(this.stageId);if(group){const bounds=group.parent.getBounds();if(bounds.isValid()){this.map.fitBounds(bounds,{padding:[45,45],maxZoom:16});return;}}const points=this.data.details[this.stageId]?.locations.map(location=>marshalPoint(location,this.stage)).filter(Boolean)||[];if(points.length)this.map.fitBounds(points,{padding:[45,45],maxZoom:16});}
  export(){if(!this.project)return;if(this.working){this.notice('Finish or cancel the route before exporting.');return;}const project=validateProject(this.project,this.data.event.eventId),blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=`stagemode-map-${this.data.event.eventId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  exportGIS(){
    if(!this.project||!this.prepareSwitch())return;
    const project=validateProject(this.project,this.data.event.eventId),features=[];
    for(const [index,id]of (project.sectionOrder||Object.keys(project.stages)).entries()){
      const stage=project.stages[id],source=this.data.stages.find(row=>String(row.stageId)===id),properties={sectionId:id,linkGroupId:stage.linkGroupId||null,sectionOrder:index+1,legId:stage.legId||null,legName:project.legs?.find(leg=>leg.id===stage.legId)?.name||null,routeColor:project.legs?.find(leg=>leg.id===stage.legId)?.color||null,sectionType:stage.sectionType,name:stage.title||source?.name||id,identifier:stage.identifier||source?.identifier||'',distanceKm:routeKilometres(stage.route),targetTime:stage.targetTime||'',averageSpeedMph:averageSpeed(stage),legStartTime:project.legs?.find(leg=>leg.id===stage.legId)?.startTime||null,routing:stage.routing};
      if(stage.route.length)features.push({type:'Feature',properties:{...properties,featureType:'route'},geometry:{type:'LineString',coordinates:stage.route.map(([lat,lon])=>[lon,lat])}});
      for(const layer of ['controls','junctions'])for(const marker of stage[layer])features.push({type:'Feature',properties:{...properties,featureType:layer==='controls'?'control':'junction',markerId:marker.id,name:marker.name,kind:marker.kind,controlName:marker.controlName||'',predictedMarshals:marker.predictedMarshals||0,controlIdentifier:marker.controlIdentifier||'',information:marker.notes,services:marker.services||{},number:marker.number??null,junctionLabel:layer==='junctions'?junctionLabel(marker):null,suffix:marker.suffix||null,locationId:marker.locationId,notes:marker.notes},geometry:{type:'Point',coordinates:[marker.point[1],marker.point[0]]}});
    }
    const blob=new Blob([JSON.stringify({type:'FeatureCollection',schema:'stagemode-rally-gis',version:1,eventId:project.eventId,eventDate:project.eventDate||null,eventName:project.eventName??this.data.event.name,units:project.units||'km',features},null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='stagemode-rally-'+project.eventId+'.geojson';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async import(file){
    $('mapFile').value='';if(!file||!this.data)return;const eventId=this.data.event.eventId,key=this.storageKey;
    try{if(file.size>10*1024*1024)throw new Error('Map files must be smaller than 10 MB.');const project=validateProject(JSON.parse(await file.text()),eventId);if(!this.data||this.storageKey!==key)return;
      const allowed=new Set(this.data.stages.map(stage=>String(stage.stageId)));if(!this.local&&Object.keys(project.stages).some(id=>!allowed.has(id)))throw new Error('This file contains stages not available in the current event.');
      this.change(current=>{for(const [id,stage] of Object.entries(project.stages))current.stages[id]=stage;if(project.eventName!=null)current.eventName=project.eventName;if(project.units!=null)current.units=project.units;if(project.eventDate!=null)current.eventDate=project.eventDate;if(project.visibility)current.visibility=project.visibility;if(project.legs)current.legs=[...project.legs,...(current.legs||[]).filter(leg=>!project.legs.some(item=>item.id===leg.id))];current.sectionOrder=[...(project.sectionOrder||Object.keys(project.stages)),...Object.keys(current.stages).filter(id=>!Object.hasOwn(project.stages,id))];});this.notice('Map imported. Undo restores the previous draft.');this.fit();
    }catch(error){this.notice(`Map was not imported: ${error.message}`);}
  }
  deleteStage(){
    if(!this.local||!this.stage||this.busy||(!this.working&&!this.prepareSwitch()))return;
    const id=this.stageId,order=this.project.sectionOrder||Object.keys(this.project.stages),index=order.indexOf(id);
    const name=this.data.stages.find(stage=>String(stage.stageId)===id)?.name||'Stage';
    this.liveRoute.cancel();this.working=null;this.workingSectionType=null;this.workingSectionName=null;this.selected=null;this.mode='select';this.stageId=order[index+1]||order[index-1]||'';
    this.change(project=>{delete project.stages[id];if(project.sectionOrder)project.sectionOrder=project.sectionOrder.filter(key=>key!==id);});
    if(!this.dirty)this.notice(`${name} deleted from this map, including its route, controls and posts. Undo restores it.`);this.fit();
  }
  addStage(sectionType='stage'){
    if(!this.local||!this.prepareSwitch())return;
    const prefix=sectionType==='liaison'?'L':'SS',label=sectionType==='liaison'?'Liaison':'Stage';
    const index=Math.max(0,...this.data.stages.filter(stage=>(stage.identifier||'').startsWith(prefix)).map(stage=>Number(stage.identifier.slice(prefix.length))||0))+1,id='local-'+crypto.randomUUID(),identifier=prefix+index,name=label+' '+index;
    this.data.stages.push({stageId:id,identifier,name});this.sectionSelected=true;this.stageId=id;$('stages').append(new Option(identifier+' · '+name,id));$('stages').value=id;
    this.change(project=>{const stage=emptyStage();Object.assign(stage,{identifier,title:name,sectionType});project.stages[id]=stage;if(project.sectionOrder)project.sectionOrder.push(id);});
    if(sectionType==='stage'){this.setMode('controls');$('controlKind').value='Start';this.pendingStartStageId=id;this.notice('Click the map to place the stage start. Then add posts and double-click to place Flying Finish.');}else{this.setMode('route');this.notice('Click to draw the liaison. Double-click to finish with a Time control.');}
  }
}

