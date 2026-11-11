export function setupWorkspaceLayout({getEditor}) {
  const $=id=>document.getElementById(id),menu=$('workspaceMenu'),trigger=$('openMenu');
  const compact=()=>window.matchMedia('(max-width: 900px)').matches;
  let preferences={};
  try{preferences=JSON.parse(localStorage.getItem('stagemode-map-panels')||'{}');}catch{}
  if(!preferences||typeof preferences!=='object'||Array.isArray(preferences))preferences={};
  const panels={layers:{target:'layersPanel',toggle:'toggleLayers',close:'closeLayers'},details:{target:'inspectorPanel',close:'closeDetails'},key:{target:'keyPanel',toggle:'toggleKey',close:'closeKey'}};
  function panel(name,open,{focus=false,persist=true}={}){
    const definition=panels[name],target=$(definition.target),toggle=definition.toggle?$(definition.toggle):null;
    if(open&&compact())for(const [other,config]of Object.entries(panels))if(other!==name){
      $(config.target).hidden=true;if(config.toggle)$(config.toggle).setAttribute('aria-expanded','false');if(persist)preferences[other]=false;
    }
    target.hidden=!open;toggle?.setAttribute('aria-expanded',String(open));
    $('workspace').classList.toggle('key-open',!$('keyPanel').hidden);
    if(focus)(toggle||$('openMenu')).focus();
    if(persist){preferences[name]=open;try{localStorage.setItem('stagemode-map-panels',JSON.stringify(preferences));}catch{}}
    requestAnimationFrame(()=>getEditor()?.map?.invalidateSize({pan:false}));
  }
  for(const [name,definition]of Object.entries(panels)){
    const toggle=definition.toggle?$(definition.toggle):null;
    if(toggle)toggle.onclick=()=>panel(name,toggle.getAttribute('aria-expanded')!=='true');
    $(definition.close).onclick=()=>panel(name,false,{focus:true});
    const defaultOpen=name==='layers'&&!compact();
    panel(name,typeof preferences[name]==='boolean'?preferences[name]:defaultOpen,{persist:false});
  }
  trigger.onclick=()=>{menu.showModal();trigger.setAttribute('aria-expanded','true');};
  $('closeMenu').onclick=()=>menu.close();
  menu.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});
  menu.addEventListener('click',event=>{
    const rect=menu.getBoundingClientRect();
    if(event.target===menu&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))menu.close();
  });
  for(const id of ['importMap','exportGIS','exportMap','saveDraft','refresh','logout'])$(id).addEventListener('click',()=>menu.close());
  document.addEventListener('mapping:inspect',()=>panel('details',true,{persist:false}));
  document.addEventListener('mapping:deselect',()=>panel('details',false,{persist:false}));
  return {closeMenu:()=>menu.close()};
}
