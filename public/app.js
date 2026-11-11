import {emptyProject} from './draft.js';
import {demo} from './demo.js';
import {StageEditor} from './editor.js';
import {setupWorkspaceLayout} from './workspace-layout.js';
const $=id=>document.getElementById(id);
let editor, demoMode=false, localMode=false, controlUrl='', userId='', generation=0;
const layout=setupWorkspaceLayout({getEditor:()=>editor});
const notice=message=>{$('notice').textContent=message;$('notice').hidden=!message;};
async function api(path,body) {
  const response=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error?.message||'Unable to load StageMode data.');error.status=response.status;throw error;}
  return result.data;
}
function reset(){generation++;layout.closeMenu();editor?.close();$('welcome').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;$('mode').textContent='Not connected';$('loginForm').reset();}
function workspace(){
  $('welcome').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;
  $('logout').textContent=demoMode||localMode?'Close map':'Sign out';
  $('mode').textContent=demoMode?'DEMO · FICTIONAL DATA':localMode?'LOCAL MAP DRAFT':'Connected to StageMode';
  $('refresh').hidden=demoMode||localMode;
  if(!editor)editor=new StageEditor({notice,controlUrl:()=>controlUrl});
}
async function connected(user){userId=user.userid;demoMode=false;localMode=false;workspace();notice('');const events=await api('/api/events');$('events').replaceChildren(...events.map(event=>new Option(event.name||`Event ${event.eventId}`,event.eventId)));if(events.length)await load();else notice('No events are available for this account.');}
async function load(){
  if(editor&&!editor.prepareSwitch()){if(editor.data)$('events').value=editor.data.event.eventId;return;}
  const run=++generation,eventId=$('events').value;editor?.close();$('refresh').disabled=true;notice('Loading stages and marshal references…');
  try{
    let next;const warnings=[];
    if(demoMode)next=structuredClone(demo);
    else if(localMode)next={event:{eventId:'local',name:'My stage maps'},stages:[{stageId:'local-1',identifier:'SS1',name:'Stage 1'}],allocations:[],details:{}};
    else{
      next=await api(`/api/events/${eventId}`);next.details={};
      for(let i=0;i<next.stages.length;i+=4){if(run!==generation)return;await Promise.all(next.stages.slice(i,i+4).map(async stage=>{try{next.details[stage.stageId]=await api(`/api/events/${eventId}/stages/${stage.stageId}/locations`);}catch(error){if(error.status===401)throw error;warnings.push(`${stage.identifier||stage.name}: ${error.message}`);}}));}
    }
    if(run!==generation)return;
    editor.open(next,{scope:demoMode?'demo':localMode?'local':`${controlUrl}:${userId}`,local:localMode});
    $('updated').textContent=demoMode?'Fictional reference data':localMode?'No StageMode connection':`References updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    if(warnings.length)notice(`Some marshal references are unavailable. ${warnings.join(' ')}`);
  }catch(error){if(run===generation){if(error.status===401){reset();$('loginError').textContent=error.message;}else notice(error.message);}}
  finally{if(run===generation)$('refresh').disabled=false;}
}
$('loginForm').onsubmit=async event=>{event.preventDefault();event.submitter.disabled=true;$('loginError').textContent='';try{const user=await api('/api/login',{userid:event.target.userid.value,password:event.target.password.value});event.target.password.value='';await connected(user);}catch(error){$('loginError').textContent=error.message;notice(error.message);}finally{event.submitter.disabled=false;}};
function standalone(isDemo){generation++;demoMode=isDemo;localMode=!isDemo;workspace();$('events').replaceChildren(new Option(isDemo?demo.event.name:'My stage maps',isDemo?'demo':'local'));load();}
$('demo').onclick=()=>standalone(true);$('startLocal').onclick=()=>standalone(false);
$('logout').onclick=async()=>{if(editor&&!editor.prepareSwitch())return;try{if(!demoMode&&!localMode)await api('/api/logout',{});}catch(error){$('loginError').textContent=error.message;}finally{reset();}};
$('newMap').onclick=()=>{if(!editor?.prepareSwitch())return;layout.closeMenu();$('newMapDialog').showModal();};
$('cancelNewMap').onclick=()=>$('newMapDialog').close();
$('exportBeforeNewMap').onclick=()=>{if(editor?.prepareSwitch())editor.export();};
$('confirmNewMap').onclick=()=>{
  if(!editor?.prepareSwitch())return;
  const blank={...emptyProject('local'),eventName:'Untitled event',units:editor.project?.units||'km'};
  try{localStorage.setItem('stagemode-map-v1:local:local',JSON.stringify(blank));}catch{$('newMapDialog').close();notice('The new map could not be saved. Your current map is still open.');return;}
  $('newMapDialog').close();standalone(false);document.dispatchEvent(new CustomEvent('mapping:deselect'));
};
$('events').onchange=load;$('refresh').onclick=load;
const initial=generation;
api('/api/config').then(config=>{controlUrl=config.controlUrl;return api('/api/me');}).then(user=>{if(generation===initial)return connected(user);}).catch(error=>{if(!$('workspace').hidden&&!demoMode&&!localMode)notice(error.message);});
