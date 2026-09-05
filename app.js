import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const APP_VERSION = 'V1.29';
const DEFAULT_COMMUNITY_ID = 'hualong-chao-plus';
const CATALOG_KEY = 'cctv3d-site-catalog-v1-24';
const WORKING_KEY = 'cctv3d-working-v1-24';
const STORE_KEY = 'cctv3d-project-store-v1-24';
const PREV_STORE_KEYS = ['cctv3d-project-store-v1-23','cctv3d-project-store-v1-22','cctv3d-project-store-v1-21','cctv3d-project-store-v1-20','cctv3d-project-store-v1-19','cctv3d-project-store-v1-18','cctv3d-project-store-v1-17','cctv3d-project-store-v1-16','cctv3d-project-store-v1-15','cctv3d-project-store-v1-14','cctv3d-project-store-v1-13','cctv3d-project-store-v1-12','cctv3d-project-store-v1-11','cctv3d-project-store-v1-10','cctv3d-project-store-v1-9','cctv3d-project-store-v1-8','cctv3d-project-store-v1-7','cctv3d-project-store-v1-6'];
const GOOGLE_DRIVE_PROJECT_URL = 'https://drive.google.com/drive/folders/1FWduBvqlTmr1oTipmqR3sywO2VUCFq9i?usp=drive_link';
const GOOGLE_SHEET_PROJECT_URL = 'https://docs.google.com/spreadsheets/d/1-jy-MWBXMyx92xZ-RTnwqpB-j7cMnlOIB2i1lh2eUZg/edit?usp=sharing';
const GOOGLE_SHEET_ID = '1-jy-MWBXMyx92xZ-RTnwqpB-j7cMnlOIB2i1lh2eUZg';
const API_CONFIG_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('工作表1')}&range=B1`;
const API_CACHE_KEY = 'cctv3d-api-url-cache';
const PX_TO_UNIT = 0.04; // 所有圖面 X/Z 使用同一縮放係數，不改變圖紙長寬比例

const CAMERA_COLOR_PRESETS = {
  red:    { label:'原建置', body:0xdc2626, cone:0xef4444, line:0xf87171 },
  blue:   { label:'藍',     body:0x2563eb, cone:0x3b82f6, line:0x60a5fa },
  orange: { label:'故障',   body:0xea580c, cone:0xf97316, line:0xfb923c },
  yellow: { label:'增設',   body:0xca8a04, cone:0xeab308, line:0xfacc15 },
  green:  { label:'綠',     body:0x16a34a, cone:0x22c55e, line:0x4ade80 },
  purple: { label:'紫',     body:0x7c3aed, cone:0x8b5cf6, line:0xa78bfa },
  gray:   { label:'灰',     body:0x4b5563, cone:0x6b7280, line:0x9ca3af }
};
const LENS_PRESETS = {
  '2.8': { fov:102, range:14 },
  '3.6': { fov:84, range:17 },
  '4':   { fov:76, range:18 },
  '6':   { fov:53, range:25 },
  '8':   { fov:40, range:32 }
};

const $ = id => document.getElementById(id);
const els = {
  viewer:$('viewer'), floorTitle:$('floorTitle'), floorChip:$('floorChip'), statusText:$('statusText'),
  cameraCount:$('cameraCount'), moduleCount:$('moduleCount'), selectedFov:$('selectedFov'), selectedType:$('selectedType'),
  versionBadge:$('versionBadge'), footerVersionInline:$('footerVersionInline'), addHint:$('addHint'),
  noCamera:$('noCamera'), cameraForm:$('cameraForm'), noModule:$('noModule'), moduleForm:$('moduleForm'),
  itemList:$('itemList'), listFilter:$('listFilter'), cameraLegend:$('cameraLegend'),
  projectFolder:$('projectFolder'), projectName:$('projectName'), projectList:$('projectList'), savedCount:$('savedCount'),
  localProjectFolder:$('localProjectFolder'), localProjectList:$('localProjectList'), localSavedCount:$('localSavedCount'),
  projectStorageModal:$('projectStorageModal'),
  communitySelect:$('communitySelect'), floorSelect:$('floorSelect'), floorPlanInfo:$('floorPlanInfo'),
  scaleBadge:$('scaleBadge'), calibrationMeters:$('calibrationMeters'), calibrationWorld:$('calibrationWorld'), calibrationStatus:$('calibrationStatus'),
  cloudStatusBadge:$('cloudStatusBadge'), apiStatusText:$('apiStatusText'),
  startupStatusCard:$('startupStatusCard'), startupStatusBody:$('startupStatusBody'), startupStatusClose:$('startupStatusClose'),
  errorModal:$('errorModal'), errorModalTitle:$('errorModalTitle'), errorModalBody:$('errorModalBody'), errorModalClose:$('errorModalClose'), errorModalOk:$('errorModalOk'), errorModalCopy:$('errorModalCopy')
};
const floorTabsNav = document.querySelector('.floor-tabs');


let lastErrorText = '';
let errorModalOpen = false;

const startupFlow = {
  local:{name:'本機資料',status:'waiting',detail:'等待載入…'},
  plan:{name:'樓層圖面',status:'waiting',detail:'等待載入…'},
  api:{name:'工作表1!B1 API',status:'waiting',detail:'等待讀取…'},
  ping:{name:'Apps Script',status:'waiting',detail:'等待測試…'},
  cloud:{name:'雲端專案',status:'waiting',detail:'等待讀取…'}
};
let startupHideTimer=null;

function modalIcon(status){
  return status==='done'?'✓':status==='error'?'!':status==='loading'?'●':'○';
}

function renderStartupCard(){
  if(!els.startupStatusCard || !els.startupStatusBody) return;
  const rows=Object.values(startupFlow).map(s =>
    `<div class="startup-mini-row ${s.status}">
      <div class="status-icon">${modalIcon(s.status)}</div>
      <div class="status-name">${esc(s.name)}</div>
      <div class="status-detail" title="${esc(s.detail)}">${esc(s.detail)}</div>
    </div>`
  ).join('');
  els.startupStatusBody.innerHTML=rows;
  els.startupStatusCard.classList.remove('hidden');

  const states=Object.values(startupFlow).map(s=>s.status);
  const hasError=states.includes('error');
  const allDone=states.every(s=>s.status==='done');
  els.startupStatusCard.classList.toggle('has-error',hasError);
  els.startupStatusCard.classList.toggle('all-done',allDone);

  clearTimeout(startupHideTimer);
  if(allDone&&!hasError){
    startupHideTimer=setTimeout(()=>els.startupStatusCard.classList.add('hidden'),3500);
  }
}

function setStartupStep(key,status,detail){
  if(!startupFlow[key]) return;
  startupFlow[key].status=status;
  startupFlow[key].detail=detail||'';
  renderStartupCard();
}

function showStartupCard(){
  renderStartupCard();
}
if(els.startupStatusClose){
  els.startupStatusClose.onclick=()=>{
    clearTimeout(startupHideTimer);
    els.startupStatusCard.classList.add('hidden');
  };
}

function closeErrorModal(){
  errorModalOpen=false;
  els.errorModal.classList.add('hidden');
  document.body.classList.remove('has-critical-error');
}

function showErrorModal(title,error,context=''){
  const message=error instanceof Error?error.message:String(error||'未知錯誤');
  const stack=error instanceof Error&&error.stack?error.stack:'';

  lastErrorText=`${title}
${message}${context?`\n\n位置：${context}`:''}${stack?`\n\n${stack}`:''}`;

  errorModalOpen=true;
  els.errorModalTitle.textContent=title||'系統錯誤';
  els.errorModalBody.innerHTML=
    `<div class="error-box">
      <div class="error-title">發生錯誤</div>
      <div class="error-message">${esc(message)}</div>
      ${context?`<div class="error-meta">位置：${esc(context)}</div>`:''}
     </div>`;
  els.errorModalCopy.textContent='複製錯誤資訊';
  els.errorModal.classList.remove('hidden');
  document.body.classList.add('has-critical-error');
}


els.errorModalClose.onclick=closeErrorModal;
els.errorModalOk.onclick=closeErrorModal;
els.errorModal.onclick=e=>{
  // 錯誤視窗不允許點背景誤關，必須按「確定」或 X。
  if(e.target===els.errorModal) return;
};
els.errorModalCopy.onclick=async()=>{
  try{
    await navigator.clipboard.writeText(lastErrorText);
    els.errorModalCopy.textContent='已複製';
    setTimeout(()=>els.errorModalCopy.textContent='複製錯誤資訊',1200);
  }catch{
    prompt('請複製錯誤資訊：',lastErrorText);
  }
};

window.addEventListener('error',e=>{
  showErrorModal(
    '網頁執行錯誤',
    e.error||e.message,
    `${e.filename||'未知檔案'}:${e.lineno||0}:${e.colno||0}`
  );
});

window.addEventListener('unhandledrejection',e=>{
  showErrorModal(
    '未處理的系統錯誤',
    e.reason||'Promise 執行失敗',
    '非同步處理'
  );
});

const camInputs = {
  name:$('camName'), lens:$('camLens'), lensFov:$('camLensFov'), color:$('camColor'), colorLabel:$('camColorLabel'), fixed:$('camFixed'),
  fov:$('camFov'), fovOut:$('camFovOut'), range:$('camRange'), rangeOut:$('camRangeOut'), yaw:$('camYaw'), yawOut:$('camYawOut'), note:$('camNote')
};
const modInputs = {
  name:$('modName'), type:$('modType'), length:$('modLength'), width:$('modWidth'), height:$('modHeight'), thickness:$('modThickness'), angle:$('modAngle'), angleOut:$('modAngleOut'), fixed:$('modFixed'), occludes:$('modOccludes'),
  widthWrap:$('modWidthWrap'), thicknessWrap:$('modThicknessWrap'), occludeWrap:$('modOccludeWrap')
};

els.versionBadge.textContent = APP_VERSION;
els.footerVersionInline.textContent = APP_VERSION;
Object.entries(CAMERA_COLOR_PRESETS).forEach(([key, info]) => {
  const opt = document.createElement('option'); opt.value = key; opt.textContent = `${info.label}（${key}）`; camInputs.color.appendChild(opt);
});
function renderCameraLegend(){
  const counts = Object.fromEntries(Object.keys(CAMERA_COLOR_PRESETS).map(k => [k, 0]));
  currentCameras().forEach(cam => { counts[cam.colorKey] = (counts[cam.colorKey] || 0) + 1; });
  els.cameraLegend.innerHTML = Object.entries(CAMERA_COLOR_PRESETS).map(([key,info]) => {
    const count = counts[key] || 0;
    return `<span class="legend-chip"><span class="legend-dot" style="background:#${info.body.toString(16).padStart(6,'0')}"></span>${info.label} <strong>${count}</strong></span>`;
  }).join('');
}

function defaultCatalog(){
  return { communities:[{ id:DEFAULT_COMMUNITY_ID, name:'樺龍潮+ 社區', floors:[
    { id:'B1', name:'B1 地下一層', sourceType:'builtin', texture:'assets/b1-plan.png', widthPx:2530, heightPx:1980 },
    { id:'B2', name:'B2 地下二層', sourceType:'builtin', texture:'assets/b2-plan.png', widthPx:2530, heightPx:1980 }
  ]}] };
}
function loadCatalog(){
  try{
    const parsed = JSON.parse(localStorage.getItem(CATALOG_KEY) || localStorage.getItem('cctv3d-site-catalog-v1-23') || localStorage.getItem('cctv3d-site-catalog-v1-22') || localStorage.getItem('cctv3d-site-catalog-v1-21') || localStorage.getItem('cctv3d-site-catalog-v1-20') || localStorage.getItem('cctv3d-site-catalog-v1-19') || localStorage.getItem('cctv3d-site-catalog-v1-18') || localStorage.getItem('cctv3d-site-catalog-v1-17') || localStorage.getItem('cctv3d-site-catalog-v1-16') || localStorage.getItem('cctv3d-site-catalog-v1-15') || localStorage.getItem('cctv3d-site-catalog-v1-14') || localStorage.getItem('cctv3d-site-catalog-v1-13') || localStorage.getItem('cctv3d-site-catalog-v1-12') || localStorage.getItem('cctv3d-site-catalog-v1-11') || localStorage.getItem('cctv3d-site-catalog-v1-10') || localStorage.getItem('cctv3d-site-catalog-v1-9') || 'null');
    if(parsed?.communities?.length) return parsed;
  }catch{}
  const d = defaultCatalog(); localStorage.setItem(CATALOG_KEY, JSON.stringify(d)); return d;
}
function saveCatalog(){ localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); }
let catalog = loadCatalog();

function currentCommunity(){ return catalog.communities.find(c => c.id === state.communityId) || catalog.communities[0]; }
function currentFloorMeta(){ const c = currentCommunity(); return c?.floors.find(f => f.id === state.floor) || c?.floors[0] || null; }
function currentKey(){ return `${state.communityId}::${state.floor}`; }
function ensureDataSlot(obj, key=currentKey()){ if(!obj[key]) obj[key] = []; return obj[key]; }
function currentCameras(){ return ensureDataSlot(state.cameras); }
function currentModules(){ return ensureDataSlot(state.modules); }
function getCalibration(){ return state.calibrations[currentKey()] || null; }
function unitsPerMeter(){ return getCalibration()?.unitsPerMeter || 1; }
function metersToWorld(m){ return Number(m) * unitsPerMeter(); }
function worldToMeters(u){ return Number(u) / unitsPerMeter(); }
function floorWorldSize(){ const f = currentFloorMeta(); return { width:(f?.widthPx || 2530)*PX_TO_UNIT, depth:(f?.heightPx || 1980)*PX_TO_UNIT }; }

function migrateFlatData(raw){
  const result = {};
  if(!raw) return result;
  Object.entries(raw).forEach(([k,v]) => {
    if(k === 'B1' || k === 'B2') result[`${DEFAULT_COMMUNITY_ID}::${k}`] = v;
    else result[k] = v;
  });
  return result;
}
function loadWorking(){
  const base = { communityId:DEFAULT_COMMUNITY_ID, floor:'B1', showPlan:true, listFilter:'camera', cameras:{}, modules:{}, calibrations:{}, selected:{kind:'camera',id:null} };
  try{
    const raw = JSON.parse(localStorage.getItem(WORKING_KEY) || localStorage.getItem('cctv3d-working-v1-23') || localStorage.getItem('cctv3d-working-v1-22') || localStorage.getItem('cctv3d-working-v1-21') || localStorage.getItem('cctv3d-working-v1-20') || localStorage.getItem('cctv3d-working-v1-19') || localStorage.getItem('cctv3d-working-v1-18') || localStorage.getItem('cctv3d-working-v1-17') || localStorage.getItem('cctv3d-working-v1-16') || localStorage.getItem('cctv3d-working-v1-15') || localStorage.getItem('cctv3d-working-v1-14') || localStorage.getItem('cctv3d-working-v1-13') || localStorage.getItem('cctv3d-working-v1-12') || localStorage.getItem('cctv3d-working-v1-11') || localStorage.getItem('cctv3d-working-v1-10') || localStorage.getItem('cctv3d-working-v1-9') || 'null');
    if(raw) return { ...base, ...raw, cameras:migrateFlatData(raw.cameras), modules:migrateFlatData(raw.modules), calibrations:raw.calibrations || {} };
    const prev = JSON.parse(localStorage.getItem('cctv3d-working-v1-8') || localStorage.getItem('cctv3d-working-v1-7') || 'null');
    if(prev){
      base.floor = prev.floor || 'B1'; base.showPlan = prev.showPlan !== false; base.listFilter = prev.listFilter || 'camera';
      base.cameras = migrateFlatData(prev.cameras); base.modules = migrateFlatData(prev.modules); base.selected = prev.selected || base.selected;
    }
  }catch{}
  return base;
}
const state = loadWorking();
if(!catalog.communities.some(c => c.id === state.communityId)) state.communityId = catalog.communities[0].id;
if(!currentCommunity()?.floors.some(f => f.id === state.floor)) state.floor = currentCommunity()?.floors[0]?.id || 'B1';
function saveWorking(){
  localStorage.setItem(WORKING_KEY, JSON.stringify({ communityId:state.communityId, floor:state.floor, showPlan:state.showPlan, listFilter:state.listFilter, cameras:state.cameras, modules:state.modules, calibrations:state.calibrations, selected:state.selected }));
}

const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1118); scene.fog = new THREE.Fog(0x0b1118, 120, 230);
const camera = new THREE.PerspectiveCamera(45,1,.1,500); camera.position.set(0,72,86);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace = THREE.SRGBColorSpace; els.viewer.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping=true; controls.dampingFactor=.07; controls.maxPolarAngle=Math.PI/2.03; controls.minDistance=25; controls.maxDistance=220;
scene.add(new THREE.HemisphereLight(0xccecff,0x1a2734,1.85)); const dl = new THREE.DirectionalLight(0xffffff,1.4); dl.position.set(20,60,30); scene.add(dl);
const floorRoot = new THREE.Group(), moduleRoot = new THREE.Group(), cameraRoot = new THREE.Group(), draftRoot = new THREE.Group(); scene.add(floorRoot,moduleRoot,cameraRoot,draftRoot);
const textureLoader = new THREE.TextureLoader(); let floorPlane = null;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); const dragPlane = new THREE.Plane(new THREE.Vector3(0,1,0),0);
let dragState = null; let draftWall = {points:[],mousePoint:null}; let calibrationDraft = {points:[]};

function clearGroup(group){ while(group.children.length){ const o=group.children[0]; group.remove(o); o.traverse?.(n=>{n.geometry?.dispose?.(); if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose?.());}); } }
function esc(s=''){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function deepCopy(o){ return JSON.parse(JSON.stringify(o)); }
function colorToHex(n){ return `#${n.toString(16).padStart(6,'0')}`; }
function lightHex(hex,amt=.2){ const c=new THREE.Color(hex); c.lerp(new THREE.Color(0xffffff),amt); return c.getHex(); }
function selCamera(){ return state.selected.kind==='camera' ? currentCameras().find(x=>x.id===state.selected.id)||null : null; }
function selModule(){ return state.selected.kind==='module' ? currentModules().find(x=>x.id===state.selected.id)||null : null; }
function setSelected(kind,id){ state.selected={kind,id}; saveWorking(); refreshUI(); renderObjects(); }
function clearSelection(){ state.selected={kind:state.listFilter==='camera'?'camera':'module',id:null}; saveWorking(); refreshUI(); renderObjects(); }

function getTextureSource(meta){ return meta?.texture || ''; }
function buildFloor(){
  clearGroup(floorRoot); const meta=currentFloorMeta(); if(!meta) return;
  const {width,depth}=floorWorldSize();
  setStartupStep('plan','loading',`正在載入：${meta.name||meta.id||'樓層圖面'}`);
  const tex=textureLoader.load(getTextureSource(meta),()=>{renderer.render(scene,camera);setStartupStep('plan','done',`${meta.name||meta.id||'圖面'} 載入完成`);},undefined,(err)=>{setStartupStep('plan','error',`${meta.name||meta.id||'圖面'} 載入失敗`);showErrorModal('樓層圖面載入失敗',err||'無法讀取圖面',getTextureSource(meta));}); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  floorPlane=new THREE.Mesh(new THREE.PlaneGeometry(width,depth),new THREE.MeshStandardMaterial({map:tex,roughness:.92,metalness:0,transparent:true,opacity:state.showPlan?1:.12})); floorPlane.rotation.x=-Math.PI/2; floorPlane.userData.kind='floor'; floorRoot.add(floorPlane);
}
function isWallModule(m){ return m?.type === 'wall' || m?.type === 'wallpath'; }
function isVehicleModule(m){ return m?.type === 'car' || m?.type === 'motorcycle'; }
function moduleTypeLabel(m){
  if(!m) return '—';
  if(m.type === 'wallpath') return m.closed ? '連續封閉牆體' : '連續牆體';
  if(m.type === 'wall') return '牆體';
  if(m.type === 'column') return '柱子';
  if(m.type === 'car') return '汽車';
  if(m.type === 'motorcycle') return '機車';
  return m.type || '模組';
}
function segmentRect(a,b,thicknessWorld){
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len*(thicknessWorld/2),nz=dx/len*(thicknessWorld/2);
  return [{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}];
}
function getModuleCorners(m){
  const hl=metersToWorld(m.length)/2, hd=metersToWorld(isWallModule(m)?m.thickness:m.width)/2, ang=-THREE.MathUtils.degToRad(m.angle||0),axis=new THREE.Vector3(0,1,0);
  return [new THREE.Vector3(-hl,0,-hd),new THREE.Vector3(hl,0,-hd),new THREE.Vector3(hl,0,hd),new THREE.Vector3(-hl,0,hd)].map(v=>{v.applyAxisAngle(axis,ang); return {x:m.x+v.x,z:m.z+v.z};});
}
function obstacleSegments(){
  const segs=[];
  currentModules().forEach(m=>{
    if(isVehicleModule(m) && m.occludes === false) return;
    if(m.type==='wallpath' && Array.isArray(m.points) && m.points.length>=2){
      const count=m.closed?m.points.length:m.points.length-1;
      for(let i=0;i<count;i++){
        const a=m.points[i],b=m.points[(i+1)%m.points.length],rect=segmentRect(a,b,metersToWorld(m.thickness||.2));
        for(let j=0;j<4;j++) segs.push([rect[j],rect[(j+1)%4]]);
      }
    }else{
      const p=getModuleCorners(m); for(let i=0;i<4;i++)segs.push([p[i],p[(i+1)%4]]);
    }
  });
  const {width,depth}=floorWorldSize(),hw=width/2,hd=depth/2,b=[{x:-hw,z:-hd},{x:hw,z:-hd},{x:hw,z:hd},{x:-hw,z:hd}]; for(let i=0;i<4;i++)segs.push([b[i],b[(i+1)%4]]); return segs;
}
function raySeg(origin,dir,a,b){ const sx=b.x-a.x,sz=b.z-a.z,det=dir.x*sz-dir.z*sx; if(Math.abs(det)<1e-8)return null; const ox=a.x-origin.x,oz=a.z-origin.z,t=(ox*sz-oz*sx)/det,u=(ox*dir.z-oz*dir.x)/det; return t>=0&&u>=0&&u<=1?t:null; }
function occludedDistances(cam){
  const theta=THREE.MathUtils.degToRad(cam.fov),yaw=THREE.MathUtils.degToRad(cam.yaw),segments=obstacleSegments(),samples=Math.max(96,Math.round(cam.fov*2)),origin={x:cam.x,z:cam.z},range=metersToWorld(cam.range),out=[];
  for(let i=0;i<=samples;i++){ const a=-theta/2+theta*(i/samples); const v=new THREE.Vector3(Math.cos(a),0,-Math.sin(a)).applyAxisAngle(new THREE.Vector3(0,1,0),-yaw); let nearest=range; for(const [p1,p2] of segments){const d=raySeg(origin,{x:v.x,z:v.z},p1,p2); if(d!==null&&d>.08&&d<nearest)nearest=d;} out.push({a,d:nearest}); }
  return out;
}
function addSpecialMarker(group,cameraData){
  if(cameraData.colorKey!=='yellow') return;
  const height = metersToWorld(7);
  const starColor = CAMERA_COLOR_PRESETS.yellow.body;
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03,0.03,Math.max(height-1.2,0.6),8),
    new THREE.MeshStandardMaterial({color:0xf8fafc, roughness:.4, metalness:.18})
  );
  line.position.set(0, Math.max((height-1.2)/2,0.3), 0); line.userData = group.userData; group.add(line);

  const starShape = new THREE.Shape();
  const outer = 0.85, inner = 0.38;
  for(let i=0;i<10;i++){
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI/2 + i * Math.PI/5;
    const x = Math.cos(a)*r, y = Math.sin(a)*r;
    if(i===0) starShape.moveTo(x,y); else starShape.lineTo(x,y);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape,{depth:0.28, bevelEnabled:true, bevelSegments:1, bevelSize:0.06, bevelThickness:0.04});
  starGeo.center();
  const star = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({color:0xfacc15, emissive:0x7c5b02, emissiveIntensity:0.95, roughness:.28, metalness:.14}));
  star.position.set(0, height, 0); star.rotation.y = THREE.MathUtils.degToRad(18); star.userData = { ...group.userData, blinkType:'invincible-star', baseY:height, baseScale:1 };
  group.add(star);

  const eyeGeo = new THREE.BoxGeometry(0.10,0.18,0.05);
  const eyeMat = new THREE.MeshStandardMaterial({color:0x111827, roughness:.5, metalness:0});
  const eye1 = new THREE.Mesh(eyeGeo, eyeMat); eye1.position.set(-0.18, height+0.05, 0.18); eye1.userData = group.userData; group.add(eye1);
  const eye2 = new THREE.Mesh(eyeGeo, eyeMat); eye2.position.set(0.18, height+0.05, 0.18); eye2.userData = group.userData; group.add(eye2);
}

function createMaterial(opts={}){
  return new THREE.MeshStandardMaterial({ roughness:.42, metalness:.22, ...opts });
}
function addWheel(group, radius, width, x, y, z){
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), createMaterial({ color:0x111827, roughness:.86, metalness:.08 }));
  tire.rotation.z = Math.PI / 2; tire.position.set(x, y, z); tire.userData = group.userData; group.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius*.55, radius*.55, width*1.03, 12), createMaterial({ color:0xcbd5e1, roughness:.35, metalness:.58 }));
  rim.rotation.z = Math.PI / 2; rim.position.set(x, y, z); rim.userData = group.userData; group.add(rim);
}
function addVehicleShadow(group, len, wid){
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(len*.92, wid*.82), new THREE.MeshBasicMaterial({ color:0x020617, transparent:true, opacity:.18, depthWrite:false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; shadow.userData = group.userData; group.add(shadow);
}
function buildSportsCarGroup(group, m, sel){
  const L = metersToWorld(m.length || 4.6), W = metersToWorld(m.width || 1.9), H = metersToWorld(m.height || 1.35);
  const bodyColor = sel ? 0xfde68a : 0xf8fafc;
  addVehicleShadow(group, L, W);

  const lower = new THREE.Mesh(new THREE.BoxGeometry(L*.94, H*.24, W*.92), createMaterial({ color:bodyColor, emissive: sel ? 0x3b2f06 : 0x220404 }));
  lower.position.y = H*.18; lower.userData = group.userData; group.add(lower);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(L*.20, H*.16, W*.82), createMaterial({ color:bodyColor }));
  nose.position.set(L*.37, H*.20, 0); nose.rotation.z = -THREE.MathUtils.degToRad(9); nose.userData = group.userData; group.add(nose);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(L*.23, H*.08, W*.74), createMaterial({ color:lightHex(bodyColor,.08) }));
  hood.position.set(L*.17, H*.28, 0); hood.rotation.z = -THREE.MathUtils.degToRad(5); hood.userData = group.userData; group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L*.34, H*.22, W*.68), createMaterial({ color:0x0f172a, transparent:true, opacity:.88, roughness:.22, metalness:.38 }));
  cabin.position.set(-L*.02, H*.39, 0); cabin.rotation.z = -THREE.MathUtils.degToRad(7); cabin.userData = group.userData; group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(L*.18, H*.08, W*.52), createMaterial({ color:0x111827, roughness:.25, metalness:.32 }));
  roof.position.set(-L*.04, H*.51, 0); roof.userData = group.userData; group.add(roof);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(L*.26, H*.18, W*.80), createMaterial({ color:bodyColor }));
  rear.position.set(-L*.30, H*.28, 0); rear.rotation.z = THREE.MathUtils.degToRad(4); rear.userData = group.userData; group.add(rear);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(L*.12, H*.05, W*.76), createMaterial({ color:0x0f172a, roughness:.65, metalness:.12 }));
  diffuser.position.set(-L*.44, H*.10, 0); diffuser.userData = group.userData; group.add(diffuser);

  const spoilerPost1 = new THREE.Mesh(new THREE.BoxGeometry(L*.02, H*.08, W*.03), createMaterial({ color:0x111827 }));
  spoilerPost1.position.set(-L*.37, H*.40, W*.20); spoilerPost1.userData = group.userData; group.add(spoilerPost1);
  const spoilerPost2 = spoilerPost1.clone(); spoilerPost2.position.z = -W*.20; spoilerPost2.userData = group.userData; group.add(spoilerPost2);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(L*.13, H*.03, W*.50), createMaterial({ color:0x0f172a }));
  spoiler.position.set(-L*.37, H*.45, 0); spoiler.userData = group.userData; group.add(spoiler);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(L*.08, H*.03, W*.78), createMaterial({ color:0x111827 }));
  splitter.position.set(L*.46, H*.08, 0); splitter.userData = group.userData; group.add(splitter);

  const lightGeo = new THREE.BoxGeometry(L*.03, H*.04, W*.12);
  const head1 = new THREE.Mesh(lightGeo, createMaterial({ color:0xfef3c7, emissive:0x8a6f1a, roughness:.25 }));
  head1.position.set(L*.47, H*.18, W*.25); head1.userData = group.userData; group.add(head1);
  const head2 = head1.clone(); head2.position.z = -W*.25; head2.userData = group.userData; group.add(head2);
  const tail1 = new THREE.Mesh(lightGeo, createMaterial({ color:0xf87171, emissive:0x7f1d1d, roughness:.25 }));
  tail1.position.set(-L*.48, H*.16, W*.23); tail1.userData = group.userData; group.add(tail1);
  const tail2 = tail1.clone(); tail2.position.z = -W*.23; tail2.userData = group.userData; group.add(tail2);

  const wheelR = metersToWorld(.34), wheelW = metersToWorld(.24);
  [[ L*.24, wheelR,  W*.36],[ L*.24, wheelR, -W*.36],[-L*.23, wheelR,  W*.36],[-L*.23, wheelR, -W*.36]].forEach(pos => addWheel(group, wheelR, wheelW, ...pos));
}
function buildSportMotorcycleGroup(group, m, sel){
  const L = metersToWorld(m.length || 2.0), W = metersToWorld(m.width || .8), H = metersToWorld(m.height || 1.1);
  const bodyColor = sel ? 0xfde68a : 0x2563eb;
  addVehicleShadow(group, L, W);

  const wheelR = metersToWorld(.28), wheelW = metersToWorld(.12);
  addWheel(group, wheelR, wheelW, L*.34, wheelR, 0);
  addWheel(group, wheelR, wheelW, -L*.30, wheelR, 0);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(L*.44, H*.08, W*.20), createMaterial({ color:0x111827, roughness:.55, metalness:.24 }));
  frame.position.set(0, H*.38, 0); frame.rotation.z = -THREE.MathUtils.degToRad(16); frame.userData = group.userData; group.add(frame);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(L*.22, H*.16, W*.34), createMaterial({ color:bodyColor, emissive: sel ? 0x3b2f06 : 0x071b44 }));
  tank.position.set(L*.02, H*.47, 0); tank.rotation.z = -THREE.MathUtils.degToRad(12); tank.userData = group.userData; group.add(tank);

  const fairing = new THREE.Mesh(new THREE.BoxGeometry(L*.18, H*.20, W*.30), createMaterial({ color:bodyColor }));
  fairing.position.set(L*.22, H*.48, 0); fairing.rotation.z = -THREE.MathUtils.degToRad(24); fairing.userData = group.userData; group.add(fairing);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(L*.16, H*.08, W*.28), createMaterial({ color:0x0f172a }));
  seat.position.set(-L*.10, H*.53, 0); seat.rotation.z = THREE.MathUtils.degToRad(10); seat.userData = group.userData; group.add(seat);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(L*.13, H*.11, W*.22), createMaterial({ color:bodyColor }));
  tail.position.set(-L*.22, H*.57, 0); tail.rotation.z = THREE.MathUtils.degToRad(18); tail.userData = group.userData; group.add(tail);

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(L*.08, H*.15, W*.18), createMaterial({ color:0xbfe3ff, transparent:true, opacity:.70, roughness:.12, metalness:.38 }));
  windscreen.position.set(L*.29, H*.60, 0); windscreen.rotation.z = -THREE.MathUtils.degToRad(32); windscreen.userData = group.userData; group.add(windscreen);

  const fork1 = new THREE.Mesh(new THREE.BoxGeometry(L*.03, H*.34, W*.03), createMaterial({ color:0xcbd5e1, roughness:.35, metalness:.62 }));
  fork1.position.set(L*.26, H*.34, W*.05); fork1.rotation.z = -THREE.MathUtils.degToRad(24); fork1.userData = group.userData; group.add(fork1);
  const fork2 = fork1.clone(); fork2.position.z = -W*.05; fork2.userData = group.userData; group.add(fork2);

  const swing = new THREE.Mesh(new THREE.BoxGeometry(L*.22, H*.05, W*.04), createMaterial({ color:0xcbd5e1, roughness:.35, metalness:.55 }));
  swing.position.set(-L*.17, H*.28, 0); swing.rotation.z = THREE.MathUtils.degToRad(17); swing.userData = group.userData; group.add(swing);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(L*.10, H*.03, W*.44), createMaterial({ color:0x111827, roughness:.55, metalness:.22 }));
  handle.position.set(L*.24, H*.61, 0); handle.rotation.x = THREE.MathUtils.degToRad(7); handle.rotation.z = -THREE.MathUtils.degToRad(10); handle.userData = group.userData; group.add(handle);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(H*.03, H*.03, L*.18, 12), createMaterial({ color:0x94a3b8, roughness:.3, metalness:.72 }));
  exhaust.rotation.z = Math.PI / 2; exhaust.position.set(-L*.03, H*.35, -W*.16); exhaust.userData = group.userData; group.add(exhaust);
}

function makeCameraMesh(c){
  const selected=state.selected.kind==='camera'&&state.selected.id===c.id,p=CAMERA_COLOR_PRESETS[c.colorKey]||CAMERA_COLOR_PRESETS.red,g=new THREE.Group(); g.userData={kind:'camera',id:c.id}; const bc=selected?lightHex(p.body,.22):p.body;
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.8,.9),new THREE.MeshStandardMaterial({color:bc,metalness:.25,roughness:.45,emissive:selected?0x334155:0})); body.position.y=2.6; body.userData=g.userData; g.add(body);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.35,18),new THREE.MeshStandardMaterial({color:0x0f172a,metalness:.6,roughness:.25})); lens.rotation.z=Math.PI/2; lens.position.set(.95,2.6,0); lens.userData=g.userData; g.add(lens);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,12),new THREE.MeshStandardMaterial({color:bc})); pole.position.y=1.45; pole.userData=g.userData; g.add(pole);
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,.12,18),new THREE.MeshStandardMaterial({color:selected?0xffffff:p.body})); ring.position.y=.06; ring.userData=g.userData; g.add(ring);

  // V1.14：顯示鏡頭實際可見範圍的單色光影，並依牆柱 / 車機車遮擋裁切缺角。
  const dist=occludedDistances(c);
  const shape=new THREE.Shape();
  shape.moveTo(0,0);
  dist.forEach(({a,d})=>shape.lineTo(Math.cos(a)*d,Math.sin(a)*d));
  shape.lineTo(0,0);
  const fill=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:p.cone,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
  fill.rotation.x=-Math.PI/2; fill.position.y=.075; fill.renderOrder=2; fill.userData=g.userData; g.add(fill);
  const core=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:p.line,transparent:true,opacity:.06,side:THREE.DoubleSide,depthWrite:false}));
  core.rotation.x=-Math.PI/2; core.position.y=.082; core.scale.set(.92,1,.92); core.renderOrder=3; core.userData=g.userData; g.add(core);
  const contourPts=[new THREE.Vector3(0,.11,0),...dist.map(({a,d})=>new THREE.Vector3(Math.cos(a)*d,.11,-Math.sin(a)*d)),new THREE.Vector3(0,.11,0)];
  const contour=new THREE.Line(new THREE.BufferGeometry().setFromPoints(contourPts),new THREE.LineBasicMaterial({color:p.line,transparent:true,opacity:.95})); contour.userData=g.userData; contour.renderOrder=4; g.add(contour);
  const sideData=[dist[0],dist[dist.length-1]],sidePts=[]; sideData.forEach(({a,d})=>sidePts.push(new THREE.Vector3(0,.11,0),new THREE.Vector3(Math.cos(a)*d,.11,-Math.sin(a)*d)));
  const sides=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sidePts),new THREE.LineBasicMaterial({color:p.line,transparent:true,opacity:.88})); sides.userData=g.userData; sides.renderOrder=4; g.add(sides);
  addSpecialMarker(g,c);
  g.position.set(c.x,0,c.z); g.rotation.y=-THREE.MathUtils.degToRad(c.yaw); return g;
}
function pathOffsetPairs(points,half,closed){
  const left=[],right=[],n=points.length;
  const norm=(a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;return{x:-dz/len,z:dx/len,dx:dx/len,dz:dz/len};};
  for(let i=0;i<n;i++){
    let offset;
    if(!closed && i===0){ const q=norm(points[0],points[1]); offset={x:q.x*half,z:q.z*half}; }
    else if(!closed && i===n-1){ const q=norm(points[n-2],points[n-1]); offset={x:q.x*half,z:q.z*half}; }
    else{
      const prev=norm(points[(i-1+n)%n],points[i]),next=norm(points[i],points[(i+1)%n]);
      let mx=prev.x+next.x,mz=prev.z+next.z,ml=Math.hypot(mx,mz);
      if(ml<1e-5){offset={x:next.x*half,z:next.z*half};}
      else{mx/=ml;mz/=ml;let denom=mx*next.x+mz*next.z;if(Math.abs(denom)<.2)denom=denom<0?-.2:.2;let scale=half/denom;const limit=half*4;scale=Math.max(-limit,Math.min(limit,scale));offset={x:mx*scale,z:mz*scale};}
    }
    left.push({x:points[i].x+offset.x,z:points[i].z+offset.z}); right.push({x:points[i].x-offset.x,z:points[i].z-offset.z});
  }
  return{left,right};
}
function buildContinuousWallGeometry(m){
  const points=m.points||[],closed=!!m.closed,half=metersToWorld(m.thickness||.2)/2,height=metersToWorld(m.height||3);
  if(points.length<2)return new THREE.BoxGeometry(.1,.1,.1);
  const {left,right}=pathOffsetPairs(points,half,closed),verts=[],indices=[];
  for(let i=0;i<points.length;i++){
    verts.push(left[i].x,0,left[i].z,left[i].x,height,left[i].z,right[i].x,0,right[i].z,right[i].x,height,right[i].z);
  }
  const segCount=closed?points.length:points.length-1;
  const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
  for(let i=0;i<segCount;i++){
    const j=(i+1)%points.length,ib=i*4,jb=j*4;
    quad(ib+1,jb+1,jb+3,ib+3); // top
    quad(ib,ib+1,jb+1,jb);     // left face
    quad(ib+2,jb+2,jb+3,ib+3); // right face
    quad(ib,jb,jb+2,ib+2);     // bottom
  }
  if(!closed){quad(0,2,3,1);const b=(points.length-1)*4;quad(b,b+1,b+3,b+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function makeModuleMesh(m){
  const sel=state.selected.kind==='module'&&state.selected.id===m.id,isWall=isWallModule(m),height=metersToWorld(m.height||3),g=new THREE.Group(); g.userData={kind:'module',id:m.id};

  if(m.type==='car' || m.type==='motorcycle'){
    if(m.type==='car') buildSportsCarGroup(g, m, sel);
    else buildSportMotorcycleGroup(g, m, sel);
    g.position.set(m.x,0,m.z); g.rotation.y=-THREE.MathUtils.degToRad(m.angle||0); return g;
  }

  let geo;
  if(m.type==='wallpath') geo=buildContinuousWallGeometry(m);
  else geo=new THREE.BoxGeometry(metersToWorld(m.length),height,metersToWorld(isWall?m.thickness:m.width));
  const mat=new THREE.MeshStandardMaterial({color:sel?(isWall?0x93c5fd:0xc4b5fd):(isWall?0x6487a7:0x7c73c9),transparent:true,opacity:(m.type==='wallpath' ? .96 : .9),roughness:.65,emissive:sel?(isWall?0x0b2e55:0x281f56):0,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat); if(m.type!=='wallpath')mesh.position.y=height/2; mesh.userData=g.userData; g.add(mesh);
  if(m.type!=='wallpath'){
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo,25),new THREE.LineBasicMaterial({color:sel?0xffffff:0xdbeafe,transparent:true,opacity:.48}));
    edge.position.copy(mesh.position); edge.userData=g.userData; g.add(edge);
    g.position.set(m.x,0,m.z);g.rotation.y=-THREE.MathUtils.degToRad(m.angle||0);
  }
  return g;
}
function renderDrafts(){
  clearGroup(draftRoot);
  if(draftWall.points.length){ const pts=[...draftWall.points]; if(draftWall.mousePoint)pts.push(draftWall.mousePoint); if(pts.length>=2)draftRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p.x,.15,p.z))),new THREE.LineBasicMaterial({color:0xf59e0b}))); draftWall.points.forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.22,12,12),new THREE.MeshStandardMaterial({color:0xf59e0b}));m.position.set(p.x,.15,p.z);draftRoot.add(m);}); }
  if(calibrationDraft.points.length){ calibrationDraft.points.forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.28,14,14),new THREE.MeshStandardMaterial({color:0x22d3ee}));m.position.set(p.x,.2,p.z);draftRoot.add(m);}); if(calibrationDraft.points.length===2){draftRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(calibrationDraft.points.map(p=>new THREE.Vector3(p.x,.2,p.z))),new THREE.LineBasicMaterial({color:0x22d3ee})));} }
}
function renderObjects(){ clearGroup(cameraRoot);clearGroup(moduleRoot);currentCameras().forEach(c=>cameraRoot.add(makeCameraMesh(c)));currentModules().forEach(m=>moduleRoot.add(makeModuleMesh(m)));renderDrafts(); }

function refreshSiteUI(){
  els.communitySelect.innerHTML=catalog.communities.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join(''); els.communitySelect.value=state.communityId;
  const c=currentCommunity(); els.floorSelect.innerHTML=(c?.floors||[]).map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join(''); els.floorSelect.value=state.floor;
  renderFloorTabs(); const f=currentFloorMeta(); els.floorTitle.textContent=f?.name||'未選擇樓層'; els.floorChip.textContent=f?.id||'—'; els.floorPlanInfo.textContent=`${c?.name||'—'} / ${f?.name||'—'}${f?.sourceType==='builtin'?'｜內建圖面':'｜自訂圖面'}`;
  const cal=getCalibration(); if(cal){els.scaleBadge.textContent='已校正';els.calibrationMeters.value=cal.meters;els.calibrationWorld.value=`${cal.worldDistance.toFixed(2)} 單位`;els.calibrationStatus.textContent=`已校正：${cal.meters} m = 圖上 ${cal.worldDistance.toFixed(2)} 單位｜1 m = ${cal.unitsPerMeter.toFixed(4)} 圖上單位`;}else{els.scaleBadge.textContent='未校正';els.calibrationWorld.value='';els.calibrationStatus.textContent='尚未校正。先在圖紙上選兩個有已知實際距離的點位。';}
}
function renderFloorTabs(){ const c=currentCommunity(); floorTabsNav.innerHTML=(c?.floors||[]).map(f=>`<button class="floor-tab ${f.id===state.floor?'active':''}" data-floor="${esc(f.id)}">${esc(f.name)}</button>`).join(''); floorTabsNav.querySelectorAll('.floor-tab').forEach(btn=>btn.onclick=()=>switchFloor(btn.dataset.floor)); }
function refreshUI(){
  refreshSiteUI();
  els.statusText.textContent=`${currentCommunity()?.name||''} / ${currentFloorMeta()?.name||''}｜版本 ${APP_VERSION}`;
  els.listFilter.value=state.listFilter;
  els.cameraCount.textContent=currentCameras().length;
  els.moduleCount.textContent=currentModules().length;
  renderCameraLegend();
  const c=selCamera(),m=selModule();
  els.selectedFov.textContent=c?`${c.fov}°`:'—';
  els.selectedType.textContent=c?'鏡頭':m?moduleTypeLabel(m):'—';
  updateCameraEditor();
  updateModuleEditor();
  updateItemList();
  $('planToggleBtn').classList.toggle('active',state.showPlan);
  $('planToggleBtn').textContent=`平面底圖：${state.showPlan?'開':'關'}`;
}
function updateCameraEditor(){ const c=selCamera(); if(!c){els.noCamera.classList.remove('hidden');els.cameraForm.classList.add('hidden');return;} els.noCamera.classList.add('hidden');els.cameraForm.classList.remove('hidden');camInputs.name.value=c.name;camInputs.lens.value=String(c.lens);camInputs.lensFov.value=`${LENS_PRESETS[String(c.lens)]?.fov??c.fov}°`;camInputs.color.value=c.colorKey;camInputs.colorLabel.value=c.colorLabel;camInputs.fixed.checked=!!c.fixed;camInputs.fov.value=c.fov;camInputs.fovOut.value=`${c.fov}°`;camInputs.range.value=c.range;camInputs.rangeOut.value=`${c.range}m`;camInputs.yaw.value=c.yaw;camInputs.yawOut.value=`${c.yaw}°`;camInputs.note.value=c.note||''; }
function wallPathTotalMeters(m){ if(m.type!=='wallpath'||!Array.isArray(m.points)||m.points.length<2)return Number(m.length||0); let total=0;const count=m.closed?m.points.length:m.points.length-1;for(let i=0;i<count;i++){const a=m.points[i],b=m.points[(i+1)%m.points.length];total+=Math.hypot(b.x-a.x,b.z-a.z);}return +worldToMeters(total).toFixed(3); }
function updateModuleEditor(){ const m=selModule(); if(!m){els.noModule.classList.remove('hidden');els.moduleForm.classList.add('hidden');return;} const wall=isWallModule(m),path=m.type==='wallpath',vehicle=isVehicleModule(m); els.noModule.classList.add('hidden');els.moduleForm.classList.remove('hidden');modInputs.name.value=m.name;modInputs.type.value=moduleTypeLabel(m);modInputs.length.value=path?wallPathTotalMeters(m):m.length;modInputs.length.disabled=path;modInputs.width.value=m.width??.8;modInputs.height.value=m.height;modInputs.thickness.value=m.thickness??.2;modInputs.angle.value=m.angle||0;modInputs.angleOut.value=path?'連續路徑':`${m.angle||0}°`;modInputs.angle.disabled=path;modInputs.fixed.checked=!!m.fixed; modInputs.occludes.checked = m.occludes !== false; modInputs.occludeWrap.classList.toggle('hidden', !vehicle); modInputs.widthWrap.classList.toggle('hidden',wall);modInputs.thicknessWrap.classList.toggle('hidden',!wall); }
function updateItemList(){
  let items=[];
  if(state.listFilter==='camera'||state.listFilter==='all') items.push(...currentCameras().map(d=>({kind:'camera',d})));
  if(state.listFilter==='wall'||state.listFilter==='all') items.push(...currentModules().filter(d=>isWallModule(d)).map(d=>({kind:'module',d})));
  if(state.listFilter==='column'||state.listFilter==='all') items.push(...currentModules().filter(d=>d.type==='column').map(d=>({kind:'module',d})));
  if(state.listFilter==='car'||state.listFilter==='all') items.push(...currentModules().filter(d=>d.type==='car').map(d=>({kind:'module',d})));
  if(state.listFilter==='motorcycle'||state.listFilter==='all') items.push(...currentModules().filter(d=>d.type==='motorcycle').map(d=>({kind:'module',d})));
  if(!items.length){ els.itemList.innerHTML='<div class="empty-list">目前篩選類別沒有資料</div>'; return; }
  els.itemList.innerHTML=items.map(({kind,d})=>{
    if(kind==='camera'){
      const p=CAMERA_COLOR_PRESETS[d.colorKey]||CAMERA_COLOR_PRESETS.red, sel=state.selected.kind==='camera'&&state.selected.id===d.id?'selected':'';
      return `<div class="item ${sel}" data-kind="camera" data-id="${esc(d.id)}"><div><strong>${esc(d.name)}</strong><small>${esc(d.colorLabel)}・${d.fixed?'固定':'可移動'}・FOV ${d.fov}°</small></div><span class="pill" style="background:${colorToHex(p.body)}">${esc(d.colorLabel)}</span></div>`;
    }
    const sel=state.selected.kind==='module'&&state.selected.id===d.id?'selected':'';
    const wall=isWallModule(d);
    const cls=wall?'wall':(d.type==='column'?'column':'project');
    const tag=wall?'WALL':(d.type==='column'?'COLUMN':(d.type==='car'?'CAR':'MOTO'));
    return `<div class="item ${sel}" data-kind="module" data-id="${esc(d.id)}"><div><strong>${esc(d.name)}</strong><small>${moduleTypeLabel(d)}・${d.fixed?'固定':'可移動'}${isVehicleModule(d)?`・${d.occludes===false?'不遮擋視角':'遮擋視角'}`:''}</small></div><span class="pill ${cls}">${tag}</span></div>`;
  }).join('');
  els.itemList.querySelectorAll('.item').forEach(el=>el.onclick=()=>setSelected(el.dataset.kind,el.dataset.id));
}


function mutateCamera(fn){const c=selCamera();if(!c)return;fn(c);saveWorking();renderObjects();refreshUI();}
function mutateModule(fn){const m=selModule();if(!m)return;fn(m);saveWorking();renderObjects();refreshUI();}
camInputs.name.oninput=()=>mutateCamera(c=>c.name=camInputs.name.value); camInputs.lens.onchange=()=>mutateCamera(c=>{c.lens=camInputs.lens.value;const p=LENS_PRESETS[c.lens];c.fov=p.fov;c.range=p.range;}); camInputs.color.onchange=()=>mutateCamera(c=>{const old=CAMERA_COLOR_PRESETS[c.colorKey]?.label;if(!c.colorLabel||c.colorLabel===old)c.colorLabel=CAMERA_COLOR_PRESETS[camInputs.color.value]?.label||c.colorLabel;c.colorKey=camInputs.color.value;}); camInputs.colorLabel.oninput=()=>mutateCamera(c=>c.colorLabel=camInputs.colorLabel.value||CAMERA_COLOR_PRESETS[c.colorKey].label); camInputs.fixed.onchange=()=>mutateCamera(c=>c.fixed=camInputs.fixed.checked); camInputs.fov.oninput=()=>mutateCamera(c=>c.fov=+camInputs.fov.value); camInputs.range.oninput=()=>mutateCamera(c=>c.range=+camInputs.range.value); camInputs.yaw.oninput=()=>mutateCamera(c=>c.yaw=+camInputs.yaw.value); camInputs.note.oninput=()=>mutateCamera(c=>c.note=camInputs.note.value);
$('deleteCamBtn').onclick=()=>{const c=selCamera();if(!c)return;state.cameras[currentKey()]=currentCameras().filter(x=>x.id!==c.id);clearSelection();saveWorking();renderObjects();refreshUI();};
modInputs.name.oninput=()=>mutateModule(m=>m.name=modInputs.name.value);modInputs.length.oninput=()=>mutateModule(m=>{if(m.type!=='wallpath')m.length=Math.max(.2,+modInputs.length.value||.2);});modInputs.width.oninput=()=>mutateModule(m=>m.width=Math.max(.2,+modInputs.width.value||.2));modInputs.height.oninput=()=>mutateModule(m=>m.height=Math.max(.2,+modInputs.height.value||.2));modInputs.thickness.oninput=()=>mutateModule(m=>m.thickness=Math.max(.05,+modInputs.thickness.value||.05));modInputs.angle.oninput=()=>mutateModule(m=>{if(m.type!=='wallpath')m.angle=+modInputs.angle.value;});modInputs.fixed.onchange=()=>mutateModule(m=>m.fixed=modInputs.fixed.checked);
modInputs.occludes.onchange=()=>mutateModule(m=>{ if(isVehicleModule(m)) m.occludes = modInputs.occludes.checked; });
$('deleteModuleBtn').onclick=()=>{const m=selModule();if(!m)return;state.modules[currentKey()]=currentModules().filter(x=>x.id!==m.id);clearSelection();saveWorking();renderObjects();refreshUI();}; $('clearModuleBtn').onclick=()=>{if(currentModules().length&&confirm(`確定清除 ${currentFloorMeta()?.name||''} 全部模組？`)){state.modules[currentKey()]=[];clearSelection();saveWorking();renderObjects();refreshUI();}};

function setAddMode(mode){ state.addMode=state.addMode===mode?null:mode; if(mode!=='wall')draftWall={points:[],mousePoint:null}; controls.enabled=!state.addMode&&!dragState; const txt={camera:'請在圖面點一下新增鏡頭',column:'請在圖面點一下新增柱子',car:'請在圖面點一下新增汽車',motorcycle:'請在圖面點一下新增機車',wall:'連續牆體：依序點選路徑；點回第一點自動封閉完成，Enter 結束開放牆，Esc 取消',calibrate:'實尺校正：請依序點選兩個已知距離的點'}; els.addHint.classList.toggle('hidden',!state.addMode);els.addHint.textContent=txt[state.addMode]||''; $('addCameraBtn').classList.toggle('active',state.addMode==='camera');$('addWallBtn').classList.toggle('active',state.addMode==='wall');$('drawerAddWallBtn').classList.toggle('active',state.addMode==='wall');$('addColumnBtn').classList.toggle('active',state.addMode==='column');$('drawerAddColumnBtn').classList.toggle('active',state.addMode==='column'); $('addCarBtn').classList.toggle('active',state.addMode==='car');$('drawerAddCarBtn').classList.toggle('active',state.addMode==='car'); $('addMotorBtn').classList.toggle('active',state.addMode==='motorcycle');$('drawerAddMotorBtn').classList.toggle('active',state.addMode==='motorcycle'); renderDrafts(); }
$('addCameraBtn').onclick=()=>setAddMode('camera');$('addWallBtn').onclick=()=>setAddMode('wall');$('drawerAddWallBtn').onclick=()=>setAddMode('wall');$('addColumnBtn').onclick=()=>setAddMode('column');$('drawerAddColumnBtn').onclick=()=>setAddMode('column');$('addCarBtn').onclick=()=>setAddMode('car');$('drawerAddCarBtn').onclick=()=>setAddMode('car');$('addMotorBtn').onclick=()=>setAddMode('motorcycle');$('drawerAddMotorBtn').onclick=()=>setAddMode('motorcycle');

function eventWorld(evt){const r=renderer.domElement.getBoundingClientRect();pointer.x=((evt.clientX-r.left)/r.width)*2-1;pointer.y=-((evt.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObject(floorPlane,false)[0];if(hit)return{x:+hit.point.x.toFixed(3),z:+hit.point.z.toFixed(3)};const p=new THREE.Vector3();if(raycaster.ray.intersectPlane(dragPlane,p))return{x:+p.x.toFixed(3),z:+p.z.toFixed(3)};return null;}
function hitEntity(evt){const r=renderer.domElement.getBoundingClientRect();pointer.x=((evt.clientX-r.left)/r.width)*2-1;pointer.y=-((evt.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...cameraRoot.children,...moduleRoot.children],true);if(!hits.length)return null;let o=hits[0].object;while(o){if(o.userData?.kind&&o.userData?.id)return o.userData;o=o.parent;}return null;}
function screenDistanceToWorldPoint(evt,p){const rect=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3(p.x,0,p.z).project(camera),sx=rect.left+(v.x+1)*rect.width/2,sy=rect.top+(1-v.y)*rect.height/2;return Math.hypot(evt.clientX-sx,evt.clientY-sy);}
renderer.domElement.addEventListener('pointerdown',evt=>{
  const w=eventWorld(evt);
  if(state.addMode==='camera'){if(!w)return;const p=LENS_PRESETS['4'],n=currentCameras().length+1,c={id:uid('cam'),name:`CAM-${currentFloorMeta()?.id||'F'}-${String(n).padStart(2,'0')}`,x:w.x,z:w.z,lens:'4',fov:p.fov,range:p.range,yaw:0,note:'',colorKey:'red',colorLabel:'原建置',fixed:false};currentCameras().push(c);state.selected={kind:'camera',id:c.id};saveWorking();setAddMode(null);renderObjects();refreshUI();return;}
  if(state.addMode==='column'){if(!w)return;const n=currentModules().filter(x=>x.type==='column').length+1,m={id:uid('col'),type:'column',name:`COL-${currentFloorMeta()?.id||'F'}-${String(n).padStart(2,'0')}`,x:w.x,z:w.z,length:.8,width:.8,height:3,thickness:.8,angle:0,fixed:false};currentModules().push(m);state.selected={kind:'module',id:m.id};saveWorking();setAddMode(null);renderObjects();refreshUI();return;}
  if(state.addMode==='car'){if(!w)return;const n=currentModules().filter(x=>x.type==='car').length+1,m={id:uid('car'),type:'car',name:`CAR-${currentFloorMeta()?.id||'F'}-${String(n).padStart(2,'0')}`,x:w.x,z:w.z,length:4.6,width:1.9,height:1.4,thickness:1.9,angle:0,fixed:false,occludes:true};currentModules().push(m);state.selected={kind:'module',id:m.id};saveWorking();setAddMode(null);renderObjects();refreshUI();return;}
  if(state.addMode==='motorcycle'){if(!w)return;const n=currentModules().filter(x=>x.type==='motorcycle').length+1,m={id:uid('moto'),type:'motorcycle',name:`MOTO-${currentFloorMeta()?.id||'F'}-${String(n).padStart(2,'0')}`,x:w.x,z:w.z,length:2.0,width:0.8,height:1.1,thickness:0.8,angle:0,fixed:false,occludes:true};currentModules().push(m);state.selected={kind:'module',id:m.id};saveWorking();setAddMode(null);renderObjects();refreshUI();return;}
  if(state.addMode==='wall'){
    if(!w)return;
    if(draftWall.points.length>=3 && screenDistanceToWorldPoint(evt,draftWall.points[0])<=20){ finalizeWall(true); return; }
    draftWall.points.push(w);draftWall.mousePoint=w;renderDrafts();return;
  }
  if(state.addMode==='calibrate'){if(!w)return;calibrationDraft.points.push(w);if(calibrationDraft.points.length===2){const [a,b]=calibrationDraft.points,d=Math.hypot(b.x-a.x,b.z-a.z);els.calibrationWorld.value=`${d.toFixed(3)} 單位`;els.calibrationStatus.textContent=`已取得兩點。圖上距離 ${d.toFixed(3)}，請輸入實際公尺數後按「套用實尺比例」。`;setAddMode(null);}renderDrafts();return;}
  const h=hitEntity(evt);if(h){state.selected={kind:h.kind,id:h.id};const item=h.kind==='camera'?selCamera():selModule();saveWorking();refreshUI();renderObjects();if(item&&!item.fixed&&w){dragState={kind:h.kind,id:h.id,last:w};controls.enabled=false;}return;}clearSelection();
});
renderer.domElement.addEventListener('pointermove',evt=>{
  const w=eventWorld(evt);if(state.addMode==='wall'&&draftWall.points.length){draftWall.mousePoint=w;renderDrafts();return;}if(!dragState||!w)return;
  const t=dragState.kind==='camera'?currentCameras().find(x=>x.id===dragState.id):currentModules().find(x=>x.id===dragState.id);if(!t||t.fixed)return;
  if(t.type==='wallpath'&&Array.isArray(t.points)){
    const dx=w.x-dragState.last.x,dz=w.z-dragState.last.z;t.points=t.points.map(p=>({x:+(p.x+dx).toFixed(3),z:+(p.z+dz).toFixed(3)}));dragState.last=w;
  }else{t.x=w.x;t.z=w.z;dragState.last=w;}
  saveWorking();renderObjects();refreshUI();
});
['pointerup','pointerleave','pointercancel'].forEach(ev=>renderer.domElement.addEventListener(ev,()=>{if(dragState){dragState=null;controls.enabled=!state.addMode;}}));
window.addEventListener('keydown',evt=>{if(state.addMode!=='wall')return;if(evt.key==='Escape'){draftWall={points:[],mousePoint:null};setAddMode(null);return;}if(evt.key==='Enter')finalizeWall(false);});
function finalizeWall(closed=false){
  if(draftWall.points.length<2){alert('牆體至少需要兩個點位。');return;}
  const points=draftWall.points.map(p=>({x:+p.x.toFixed(3),z:+p.z.toFixed(3)}));
  if(closed && points.length<3){alert('封閉牆體至少需要三個點位。');return;}
  const base=currentModules().filter(x=>isWallModule(x)).length+1;
  let totalWorld=0,count=closed?points.length:points.length-1;for(let i=0;i<count;i++){const a=points[i],b=points[(i+1)%points.length];totalWorld+=Math.hypot(b.x-a.x,b.z-a.z);}
  const m={id:uid('wallpath'),type:'wallpath',name:`WALL-${currentFloorMeta()?.id||'F'}-${String(base).padStart(2,'0')}`,points,closed,height:3,thickness:.2,width:.2,length:+worldToMeters(totalWorld).toFixed(3),angle:0,fixed:false};
  currentModules().push(m);state.selected={kind:'module',id:m.id};draftWall={points:[],mousePoint:null};saveWorking();setAddMode(null);renderObjects();refreshUI();
}

// 社區資料夾 / 樓層圖面
els.communitySelect.onchange=()=>{state.communityId=els.communitySelect.value;state.floor=currentCommunity()?.floors[0]?.id||'';state.selected={kind:'camera',id:null};saveWorking();buildFloor();renderObjects();refreshUI();resetView();};
els.floorSelect.onchange=()=>switchFloor(els.floorSelect.value);
$('addCommunityBtn').onclick=()=>{const name=prompt('輸入社區 / 案場資料夾名稱：');if(!name?.trim())return;const id=uid('site');catalog.communities.push({id,name:name.trim(),floors:[]});saveCatalog();state.communityId=id;state.floor='';refreshUI();$('addFloorBtn').click();};
$('deleteCommunityBtn').onclick=()=>{const c=currentCommunity();if(!c)return;if(c.id===DEFAULT_COMMUNITY_ID){alert('目前「樺龍潮+ 社區」為內建案場，不建議刪除。可新增其他社區資料夾。');return;}if(!confirm(`確定刪除「${c.name}」及其樓層圖面分類？`))return;catalog.communities=catalog.communities.filter(x=>x.id!==c.id);saveCatalog();state.communityId=catalog.communities[0].id;state.floor=currentCommunity()?.floors[0]?.id||'';saveWorking();buildFloor();renderObjects();refreshUI();};
$('addFloorBtn').onclick=()=>{if(!currentCommunity()){alert('請先建立社區資料夾。');return;}$('floorFileInput').click();};
$('floorFileInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const name=prompt('輸入樓層名稱：',file.name.replace(/\.[^.]+$/,''));if(!name?.trim())return;els.statusText.textContent='正在處理圖面…';const plan=await fileToPlanTexture(file);const floor={id:uid('floor'),name:name.trim(),sourceType:'uploaded',texture:plan.dataUrl,widthPx:plan.widthPx,heightPx:plan.heightPx,originalFile:file.name};currentCommunity().floors.push(floor);saveCatalog();state.floor=floor.id;saveWorking();buildFloor();renderObjects();refreshUI();resetView();els.statusText.textContent=`已新增圖面：${floor.name}`;}catch(err){console.warn(err);alert('圖面加入失敗。PDF 會讀取第一頁；圖片支援 PNG/JPG/WebP。');}finally{e.target.value='';}};
$('deleteFloorBtn').onclick=()=>{const c=currentCommunity(),f=currentFloorMeta();if(!c||!f)return;if(f.sourceType==='builtin'){alert('樺龍潮+ 社區目前的 B1 / B2 為內建圖面，不直接刪除。');return;}if(!confirm(`確定刪除圖面「${f.name}」？`))return;const key=currentKey();c.floors=c.floors.filter(x=>x.id!==f.id);delete state.cameras[key];delete state.modules[key];delete state.calibrations[key];state.floor=c.floors[0]?.id||'';saveCatalog();saveWorking();buildFloor();renderObjects();refreshUI();};
async function fileToPlanTexture(file){
  if(file.type.startsWith('image/')) return await imageFileToData(file);
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
    const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';const bytes=new Uint8Array(await file.arrayBuffer()),pdf=await pdfjs.getDocument({data:bytes}).promise,page=await pdf.getPage(1),vp0=page.getViewport({scale:1}),scale=Math.min(2,1800/vp0.width),vp=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;return{dataUrl:canvas.toDataURL('image/jpeg',.88),widthPx:canvas.width,heightPx:canvas.height};
  }
  throw new Error('unsupported');
}
function imageFileToData(file){return new Promise((resolve,reject)=>{const img=new Image(),fr=new FileReader();fr.onload=()=>img.src=fr.result;fr.onerror=reject;img.onload=()=>{const max=1800,scale=Math.min(1,max/img.width),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve({dataUrl:canvas.toDataURL('image/jpeg',.9),widthPx:canvas.width,heightPx:canvas.height});};img.onerror=reject;fr.readAsDataURL(file);});}
function switchFloor(id){state.floor=id;state.selected={kind:'camera',id:null};calibrationDraft={points:[]};draftWall={points:[],mousePoint:null};saveWorking();buildFloor();renderObjects();refreshUI();resetView();}

// 兩點實尺校正
$('startCalibrationBtn').onclick=()=>{calibrationDraft={points:[]};els.calibrationWorld.value='';els.calibrationStatus.textContent='請在圖紙上依序點兩個已知實際距離的點。';setAddMode('calibrate');};
$('applyCalibrationBtn').onclick=()=>{if(calibrationDraft.points.length!==2){alert('請先點選兩個校正點。');return;}const meters=+els.calibrationMeters.value;if(!(meters>0)){alert('請輸入正確的實際距離（公尺）。');return;}const [a,b]=calibrationDraft.points,worldDistance=Math.hypot(b.x-a.x,b.z-a.z);state.calibrations[currentKey()]={meters,worldDistance,unitsPerMeter:worldDistance/meters,pointA:a,pointB:b,updatedAt:Date.now()};saveWorking();renderObjects();refreshUI();};
$('resetCalibrationBtn').onclick=()=>{if(!confirm('重設此樓層的實尺比例？'))return;delete state.calibrations[currentKey()];calibrationDraft={points:[]};els.calibrationMeters.value='';saveWorking();renderObjects();refreshUI();};

els.listFilter.onchange=()=>{state.listFilter=els.listFilter.value;saveWorking();refreshUI();};$('planToggleBtn').onclick=()=>{state.showPlan=!state.showPlan;if(floorPlane)floorPlane.material.opacity=state.showPlan?1:.12;saveWorking();refreshUI();};$('view3dBtn').onclick=()=>{camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update();};$('topViewBtn').onclick=()=>{camera.position.set(0,130,.01);controls.target.set(0,0,0);controls.update();};$('resetViewBtn').onclick=resetView;function resetView(){camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update();}

// 專案儲存 / 資料夾 / Google Sheets 雲端資料庫
function getStore(){
  try{
    const raw=localStorage.getItem(STORE_KEY)||PREV_STORE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);
    return JSON.parse(raw)||{folders:[{id:'root',name:'我的專案'}],projects:[]};
  }catch{return{folders:[{id:'root',name:'我的專案'}],projects:[]};}
}
function setStore(s){localStorage.setItem(STORE_KEY,JSON.stringify(s));}
function ensureStore(){
  const s=getStore();
  if(!s.folders?.length)s.folders=[{id:'root',name:'我的專案'}];
  s.folders=s.folders.map(f=>({id:f.id,name:f.name}));
  s.projects=(s.projects||[]).map(p=>({...p,locked:!!p.locked}));
  if(!s.projects)s.projects=[];
  setStore(s);return s;
}
function folderById(id){return ensureStore().folders.find(f=>f.id===id)||null;}
function selectedFolderName(selectEl=els.localProjectFolder){const f=folderById(selectEl?.value);return f?.name||'我的專案';}
function renderFolderSelect(selectEl,preferredId=''){
  const s=ensureStore();
  const cur=preferredId&&s.folders.some(f=>f.id===preferredId)?preferredId:(selectEl.value&&s.folders.some(f=>f.id===selectEl.value)?selectEl.value:s.folders[0].id);
  selectEl.innerHTML=s.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  selectEl.value=cur;
}
function renderFolderOptions(){renderFolderSelect(els.localProjectFolder);updateFolderStateUI();}
function selectedCloudFolder(){return cloudFolders.find(f=>f.folderId===els.projectFolder?.value)||cloudFolders[0]||{folderId:'root',name:'我的專案'};}
function renderCloudFolderOptions(){
  if(!cloudFolders.length)cloudFolders=[{folderId:'root',name:'我的專案'}];
  const cur=cloudFolders.some(f=>f.folderId===els.projectFolder.value)?els.projectFolder.value:cloudFolders[0].folderId;
  els.projectFolder.innerHTML=cloudFolders.map(f=>`<option value="${esc(f.folderId)}">${esc(f.name)}</option>`).join('');
  els.projectFolder.value=cur;updateFolderStateUI();
}
function updateFolderStateUI(){}
function addFolderFor(selectEl){
  const name=prompt('輸入新資料夾名稱：');if(!name?.trim())return;
  const clean=name.trim(),s=ensureStore();
  if(s.folders.some(f=>f.name===clean)){alert('已有相同名稱的資料夾。');return;}
  const f={id:uid('folder'),name:clean};s.folders.push(f);setStore(s);renderFolderOptions();selectEl.value=f.id;updateFolderStateUI();renderLocalProjects();
}
function deleteFolderFor(selectEl){
  const s=ensureStore(),id=selectEl.value,f=s.folders.find(x=>x.id===id);if(!f)return;
  if(id==='root'){alert('「我的專案」為預設資料夾，不能刪除。');return;}
  const localCount=s.projects.filter(p=>p.folderId===id).length;
  if(localCount){alert(`資料夾「${f.name}」內仍有 ${localCount} 筆本地專案，請先刪除專案後再刪除資料夾。`);return;}
  if(!confirm(`確定刪除本地資料夾「${f.name}」？`))return;
  s.folders=s.folders.filter(x=>x.id!==id);setStore(s);renderFolderOptions();renderLocalProjects();
}


let cloudProjects=[];
let cloudFolders=[];
let activeApiUrl='';
let cloudConnected=false;
function setCloudStatus(ok,text){cloudConnected=!!ok;els.cloudStatusBadge.textContent=ok?'雲端已連線':'雲端未連線';els.apiStatusText.textContent=text||'';}
function parseCsvSingleCell(text){let s=String(text||'').trim();if(s.startsWith('"')&&s.endsWith('"'))s=s.slice(1,-1).replace(/""/g,'"');return s.trim();}
async function getApiUrlFromSheet(force=false){
  if(!force&&activeApiUrl)return activeApiUrl;
  try{
    setStartupStep('api','loading','正在讀取 Google Sheets 工作表1!B1…');
    const res=await fetch(API_CONFIG_CSV_URL,{cache:'no-store'});
    if(!res.ok)throw new Error(`B1 讀取失敗 HTTP ${res.status}`);
    const url=parseCsvSingleCell(await res.text());
    if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(url))throw new Error('工作表1!B1 不是有效的 Apps Script /exec 網址');
    activeApiUrl=url;localStorage.setItem(API_CACHE_KEY,url);setStartupStep('api','done','已取得目前有效 /exec 網址');return url;
  }catch(err){
    const cached=localStorage.getItem(API_CACHE_KEY)||'';
    if(cached){activeApiUrl=cached;els.apiStatusText.textContent=`工作表1!B1 暫時無法讀取，使用上次成功端點｜${err.message}`;setStartupStep('api','done','B1 暫時無法讀取，改用上次成功端點');return cached;}
    setStartupStep('api','error',err.message);throw err;
  }
}
async function apiGet(action,params={}){const base=await getApiUrlFromSheet();const u=new URL(base);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u.toString(),{cache:'no-store'});if(!r.ok)throw new Error(`API HTTP ${r.status}`);return await r.json();}
async function apiPost(body){const base=await getApiUrlFromSheet();const r=await fetch(base,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`API HTTP ${r.status}`);return await r.json();}

function renderLocalProjects(){
  const s=ensureStore(),fid=els.localProjectFolder?.value||s.folders[0].id,list=s.projects.filter(p=>p.folderId===fid).sort((a,b)=>b.updatedAt-a.updatedAt);
  els.localSavedCount.textContent=`${list.length} 筆`;
  els.localProjectList.innerHTML=list.length?list.map(p=>`<div class="item"><div><strong>${p.locked?'🔒 ':''}${esc(p.name)}</strong><small>${new Date(p.updatedAt).toLocaleString()}・${esc(p.version||'')}・${p.locked?'已鎖定':'未鎖定'}</small></div><div class="project-actions"><button data-act="load" data-id="${esc(p.id)}">開啟</button><button data-act="lock" data-id="${esc(p.id)}">${p.locked?'🔓 解鎖':'🔒 鎖定'}</button><button class="danger" data-act="delete" data-id="${esc(p.id)}" ${p.locked?'disabled':''}>刪除</button></div></div>`).join(''):'<div class="empty-list">此資料夾尚無本地專案</div>';
  els.localProjectList.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();if(b.dataset.act==='load')loadProjectLocal(b.dataset.id);else if(b.dataset.act==='lock')toggleProjectLockLocal(b.dataset.id);else deleteProjectLocal(b.dataset.id);});
}
function renderCloudProjects(){
  const folder=selectedCloudFolder();
  const list=cloudProjects.filter(p=>(p.folder||'我的專案')===folder.name).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  els.savedCount.textContent=`${list.length} 筆`;
  els.projectList.innerHTML=list.length?list.map(p=>`<div class="item"><div><strong>${p.locked?'🔒 ':''}${esc(p.projectName)}</strong><small>${esc(p.community||'')}・${esc(p.floor||'')}・${esc(p.folder||'我的專案')}・${esc(p.version||'')}・${p.locked?'已鎖定':'未鎖定'}</small></div><div class="project-actions"><button data-act="load" data-id="${esc(p.projectId)}">開啟</button><button data-act="lock" data-id="${esc(p.projectId)}">${p.locked?'🔓 解鎖':'🔒 鎖定'}</button><button class="danger" data-act="delete" data-id="${esc(p.projectId)}" ${p.locked?'disabled':''}>刪除</button></div></div>`).join(''):'<div class="empty-list">此資料夾尚無雲端專案</div>';
  els.projectList.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();if(b.dataset.act==='load')loadProjectCloud(b.dataset.id);else if(b.dataset.act==='lock')toggleProjectLockCloud(b.dataset.id);else deleteProjectCloud(b.dataset.id);});
}
async function refreshCloudProjects(forceApi=false){
  try{
    if(forceApi){activeApiUrl='';localStorage.removeItem(API_CACHE_KEY);}
    setCloudStatus(false,'API 來源：工作表1!B1｜連線中…');
    setStartupStep('ping','loading','正在測試 Apps Script API…');

    const ping=await apiGet('ping');
    if(!ping?.ok) throw new Error(ping?.message||'API ping 失敗');

    const apiVersion=String(ping.apiVersion||'舊版');
    setStartupStep('ping','done',`Apps Script API 連線正常｜API ${apiVersion}`);

    setStartupStep('cloud','loading','正在讀取 Google Sheets 雲端專案清單…');
    const data=await apiGet('listProjects');
    if(!data?.ok) throw new Error(data?.message||'讀取專案清單失敗');
    cloudProjects=Array.isArray(data.projects)?data.projects:[];

    let folderMode='normal';
    try{
      const folderData=await apiGet('listFolders');
      if(folderData?.ok){
        cloudFolders=Array.isArray(folderData.folders)?folderData.folders:[];
      }else{
        const msg=String(folderData?.message||'');
        if(msg.includes('未知 action')&&msg.includes('listFolders')){
          folderMode='legacy';
          cloudFolders=[{folderId:'root',name:'我的專案',updatedAt:''}];
        }else{
          throw new Error(folderData?.message||'讀取雲端資料夾失敗');
        }
      }
    }catch(folderErr){
      const msg=String(folderErr?.message||folderErr);
      if(msg.includes('未知 action')&&msg.includes('listFolders')){
        folderMode='legacy';
        cloudFolders=[{folderId:'root',name:'我的專案',updatedAt:''}];
      }else{
        throw folderErr;
      }
    }

    renderCloudFolderOptions();

    if(folderMode==='legacy'){
      setCloudStatus(true,`雲端基本連線正常｜${cloudProjects.length} 個專案｜Apps Script API 需更新`);
      setStartupStep('cloud','done',`已載入 ${cloudProjects.length} 個雲端專案｜目前使用舊 API 相容模式`);
      renderCloudProjects();
      // 不把整個網站判定為失敗；只有資料夾新增/刪除功能暫時不可用。
      const nf=$('newFolderBtn');
      if(nf) nf.disabled=true;
      return;
    }

    const nf=$('newFolderBtn');
    if(nf) nf.disabled=false;
    setCloudStatus(true,`API 來源：工作表1!B1｜連線正常｜${cloudProjects.length} 個雲端專案`);
    setStartupStep('cloud','done',`已載入 ${cloudProjects.length} 個雲端專案 / ${cloudFolders.length} 個資料夾`);
    renderCloudProjects();
  }catch(err){
    console.warn(err);
    setStartupStep('ping','error',err.message);
    setStartupStep('cloud','error','雲端專案清單未載入');
    setCloudStatus(false,`API 來源：工作表1!B1｜${err.message}`);
    els.projectList.innerHTML='<div class="empty-list">雲端連線失敗，請確認工作表1!B1、分享權限與 Apps Script 部署權限。</div>';
    els.savedCount.textContent='0 筆';
    showErrorModal('Google Sheets 雲端連線失敗',err,'工作表1!B1 / Apps Script API');
  }
}
function renderStore(){renderFolderOptions();renderCloudFolderOptions();renderLocalProjects();renderCloudProjects();}

// 專案儲存浮動視窗
function openProjectStorage(){els.projectStorageModal.classList.remove('hidden');renderStore();}
function closeProjectStorage(){els.projectStorageModal.classList.add('hidden');}
$('openProjectStorageBtn').onclick=openProjectStorage;$('closeProjectStorageBtn').onclick=closeProjectStorage;$('closeProjectStorageBottomBtn').onclick=closeProjectStorage;
els.projectStorageModal.addEventListener('click',e=>{if(e.target===els.projectStorageModal)closeProjectStorage();});
function switchStorageTab(tab){
  $('localStorageTab').classList.toggle('active',tab==='local');$('cloudStorageTab').classList.toggle('active',tab==='cloud');
  $('localStoragePanel').classList.toggle('hidden',tab!=='local');$('cloudStoragePanel').classList.toggle('hidden',tab!=='cloud');
  if(tab==='local')renderLocalProjects();else renderCloudProjects();
}
$('localStorageTab').onclick=()=>switchStorageTab('local');$('cloudStorageTab').onclick=()=>switchStorageTab('cloud');
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!els.projectStorageModal.classList.contains('hidden'))closeProjectStorage();});

els.localProjectFolder.onchange=()=>{updateFolderStateUI();renderLocalProjects();};
els.projectFolder.onchange=()=>{updateFolderStateUI();renderCloudProjects();};
$('localNewFolderBtn').onclick=()=>addFolderFor(els.localProjectFolder);

$('newFolderBtn').onclick=async()=>{const name=prompt('輸入新的雲端資料夾名稱：');if(!name?.trim())return;try{const r=await apiPost({action:'saveFolder',name:name.trim()});if(!r?.ok)throw new Error(r?.message||'新增資料夾失敗');await refreshCloudProjects();if(r.folder?.folderId)els.projectFolder.value=r.folder.folderId;renderCloudProjects();}catch(err){showErrorModal('新增雲端資料夾失敗',err,'Google Sheets 資料夾');}};


function saveProjectLocal(){
  const name=els.projectName.value.trim();if(!name){alert('請先輸入專案名稱。');return;}
  const s=ensureStore(),fid=els.localProjectFolder.value,payload=buildProjectPayload();let p=s.projects.find(x=>x.folderId===fid&&x.name===name);
  if(p){p.data=payload;p.updatedAt=Date.now();p.version=APP_VERSION;}else{s.projects.push({id:uid('local-project'),folderId:fid,name,data:payload,updatedAt:Date.now(),version:APP_VERSION,locked:false});}
  setStore(s);renderLocalProjects();els.statusText.textContent=`本地儲存完成：${name}｜${APP_VERSION}`;
}
function loadProjectLocal(id){
  const s=ensureStore(),p=s.projects.find(x=>x.id===id);if(!p)return;if(!confirm(`讀取本地專案「${p.name}」？目前未儲存的變更會被取代。`))return;
  els.projectName.value=p.name;applyPayload(p.data||{});els.statusText.textContent=`已開啟本地專案：${p.name}｜${p.version||APP_VERSION}`;closeProjectStorage();
}
function deleteProjectLocal(id){
  const s=ensureStore(),p=s.projects.find(x=>x.id===id);if(!p)return;if(p.locked){alert(`專案「${p.name}」已鎖定，請先解除鎖定後再刪除。`);return;}if(!confirm(`確定刪除本地專案「${p.name}」？`))return;s.projects=s.projects.filter(x=>x.id!==id);setStore(s);renderLocalProjects();
}
function toggleProjectLockLocal(id){
  const s=ensureStore(),p=s.projects.find(x=>x.id===id);if(!p)return;p.locked=!p.locked;setStore(s);renderLocalProjects();els.statusText.textContent=`本地專案「${p.name}」${p.locked?'已鎖定':'已解除鎖定'}`;
}
$('saveLocalProjectBtn').onclick=saveProjectLocal;
function buildProjectPayload(){return{communityId:state.communityId,floor:state.floor,showPlan:state.showPlan,listFilter:state.listFilter,cameras:deepCopy(state.cameras),modules:deepCopy(state.modules),calibrations:deepCopy(state.calibrations),catalog:deepCopy(catalog)};}
$('saveProjectBtn').onclick=async()=>{
  const name=els.projectName.value.trim();if(!name){alert('請先輸入專案名稱。');return;}
  const community=currentCommunity()?.name||'',floor=currentFloorMeta()?.name||state.floor,folder=selectedCloudFolder().name,payload=buildProjectPayload();
  const existing=cloudProjects.find(p=>p.projectName===name&&p.community===community&&p.floor===floor&&(p.folder||'我的專案')===folder);
  try{
    els.statusText.textContent=`正在儲存到 Google Sheets：${name}…`;
    const result=await apiPost({action:'saveProject',projectId:existing?.projectId||'',community,floor,folder,projectName:name,version:APP_VERSION,data:payload});
    if(!result?.ok)throw new Error(result?.message||'雲端儲存失敗');
    // 同步保留瀏覽器本機備份
    const s=ensureStore();let localFolder=s.folders.find(f=>f.name===folder);if(!localFolder){localFolder={id:uid('folder'),name:folder};s.folders.push(localFolder);}const folderId=localFolder.id;let lp=s.projects.find(x=>x.folderId===folderId&&x.name===name);if(lp){lp.data=payload;lp.updatedAt=Date.now();lp.version=APP_VERSION;}else{s.projects.push({id:result.projectId||uid('project'),folderId,name,data:payload,updatedAt:Date.now(),version:APP_VERSION,locked:!!existing?.locked});}setStore(s);
    els.statusText.textContent=`雲端儲存完成：${name}｜${APP_VERSION}`;await refreshCloudProjects();
  }catch(err){console.warn(err);showErrorModal('雲端儲存失敗',err,'儲存到 Google Sheets');els.statusText.textContent='雲端儲存失敗';}
};
function applyPayload(p){if(p.catalog?.communities?.length){catalog=p.catalog;saveCatalog();}state.communityId=p.communityId||catalog.communities[0].id;state.floor=p.floor||currentCommunity()?.floors[0]?.id||'';state.showPlan=p.showPlan!==false;state.listFilter=p.listFilter||'camera';state.cameras=migrateFlatData(p.cameras);state.modules=migrateFlatData(p.modules);state.calibrations=p.calibrations||{};state.selected={kind:'camera',id:null};saveWorking();buildFloor();renderObjects();refreshUI();resetView();}
async function loadProjectCloud(id){
  const meta=cloudProjects.find(x=>x.projectId===id);if(!meta)return;if(!confirm(`讀取「${meta.projectName}」？目前未儲存的變更會被取代。`))return;
  try{const r=await apiGet('getProject',{projectId:id});if(!r?.ok||!r.project)throw new Error(r?.message||'讀取失敗');els.projectName.value=r.project.projectName||'';applyPayload(r.project.data||{});els.statusText.textContent=`已從雲端開啟：${r.project.projectName}｜${r.project.version||APP_VERSION}`;closeProjectStorage();}catch(err){showErrorModal('雲端讀取失敗',err,'讀取 Google Sheets 專案');}
}
async function deleteProjectCloud(id){
  const meta=cloudProjects.find(x=>x.projectId===id);if(!meta)return;if(meta.locked){alert(`雲端專案「${meta.projectName}」已鎖定，請先解除鎖定後再刪除。`);return;}if(!confirm(`確定從 Google Sheets 刪除專案「${meta.projectName}」？`))return;try{const r=await apiPost({action:'deleteProject',projectId:id});if(!r?.ok)throw new Error(r?.message||'刪除失敗');els.statusText.textContent=`雲端專案已刪除：${meta.projectName}`;await refreshCloudProjects();}catch(err){showErrorModal('雲端刪除失敗',err,'刪除 Google Sheets 專案');}
}
async function toggleProjectLockCloud(id){
  const meta=cloudProjects.find(x=>x.projectId===id);if(!meta)return;try{const r=await apiPost({action:'setProjectLock',projectId:id,locked:!meta.locked});if(!r?.ok)throw new Error(r?.message||'專案鎖定設定失敗');await refreshCloudProjects();els.statusText.textContent=`雲端專案「${meta.projectName}」${r.locked?'已鎖定':'已解除鎖定'}`;}catch(err){showErrorModal('雲端專案鎖定失敗',err,'Google Sheets 專案');}
}

let animationStarted = false;

function resize(){
  const w = Math.max(1, els.viewer.clientWidth);
  const h = Math.max(1, els.viewer.clientHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);

function animate(){
  if(animationStarted) return;
  animationStarted = true;

  const frame = () => {
    requestAnimationFrame(frame);

    const now = performance.now() * 0.004;
    scene.traverse(obj => {
      if(obj.userData?.blinkType === 'invincible-star'){
        const pulse = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(now * 2.4));
        obj.scale.setScalar(pulse);
        obj.rotation.z = Math.sin(now * 0.9) * 0.12;
        if(obj.material){
          obj.material.emissiveIntensity =
            0.7 + 0.7 * (0.5 + 0.5 * Math.sin(now * 5.2));
        }
      }
    });

    controls.update();
    renderer.render(scene, camera);
  };

  frame();
}

async function startup(){
  showStartupCard();
  try{
    setStartupStep('local','loading','正在讀取瀏覽器本機專案與設定…');
    const localCamCount=Object.values(state.cameras||{}).reduce((n,x)=>n+(Array.isArray(x)?x.length:0),0);
    const localModCount=Object.values(state.modules||{}).reduce((n,x)=>n+(Array.isArray(x)?x.length:0),0);
    setStartupStep('local','done',`社區 ${catalog.communities?.length||0} 個｜本機鏡頭 ${localCamCount} 支｜模組 ${localModCount} 個`);
    buildFloor();renderObjects();refreshUI();renderStore();resize();animate();
    await refreshCloudProjects();
  }catch(err){setStartupStep('cloud','error',err instanceof Error?err.message:String(err));showErrorModal('網站啟動失敗',err,'startup');}
}
startup();
