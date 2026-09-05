import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const APP_VERSION = 'V1.6';
const CAMERA_COLOR_PRESETS = {
  red:    { label: '原建置', body: 0xdc2626, cone: 0xef4444, line: 0xf87171 },
  blue:   { label: '增設',   body: 0x2563eb, cone: 0x3b82f6, line: 0x60a5fa },
  orange: { label: '故障',   body: 0xea580c, cone: 0xf97316, line: 0xfb923c },
  yellow: { label: '黃',     body: 0xca8a04, cone: 0xeab308, line: 0xfacc15 },
  green:  { label: '綠',     body: 0x16a34a, cone: 0x22c55e, line: 0x4ade80 },
  purple: { label: '紫',     body: 0x7c3aed, cone: 0x8b5cf6, line: 0xa78bfa },
  gray:   { label: '灰',     body: 0x4b5563, cone: 0x6b7280, line: 0x9ca3af }
};

// 常見 1/2.8"~1/3" 監視器的近似水平視角，實際依廠牌/感光元件而異。
const LENS_PRESETS = {
  '2.8': { fov: 102, range: 14 },
  '3.6': { fov: 84,  range: 17 },
  '4':   { fov: 76,  range: 18 },
  '6':   { fov: 53,  range: 25 },
  '8':   { fov: 40,  range: 32 }
};

const $ = id => document.getElementById(id);
const viewer = $('viewer');
const floorTabs = [...document.querySelectorAll('.floor-tab')];
const floorTitle = $('floorTitle');
const floorChip = $('floorChip');
const cameraCount = $('cameraCount');
const moduleCount = $('moduleCount');
const cameraList = $('cameraList');
const moduleList = $('moduleList');
const cameraLegend = $('cameraLegend');
const noCamera = $('noCamera');
const noModule = $('noModule');
const cameraForm = $('cameraForm');
const moduleForm = $('moduleForm');
const addHint = $('addHint');
const selectedFov = $('selectedFov');
const selectedModuleType = $('selectedModuleType');
const statusText = $('statusText');
const projectFolder = $('projectFolder');
const projectName = $('projectName');
const projectList = $('projectList');
const savedCount = $('savedCount');
const exportProjectBtn = $('exportProjectBtn');
const importProjectBtn = $('importProjectBtn');
const importProjectFile = $('importProjectFile');

$('versionBadge').textContent = APP_VERSION;
$('footerVersionInline').textContent = APP_VERSION;

const camInputs = {
  name: $('camName'), lens: $('camLens'), lensFov: $('camLensFov'), color: $('camColor'), colorLabel: $('camColorLabel'),
  fixed: $('camFixed'), moveBtn: $('moveCamBtn'), fov: $('camFov'), fovOut: $('camFovOut'), range: $('camRange'), rangeOut: $('camRangeOut'),
  yaw: $('camYaw'), yawOut: $('camYawOut'), note: $('camNote')
};
const modInputs = {
  name: $('modName'), type: $('modType'), length: $('modLength'), width: $('modWidth'), height: $('modHeight'), thickness: $('modThickness'),
  angle: $('modAngle'), angleOut: $('modAngleOut'), widthWrap: $('modWidthWrap'), thicknessWrap: $('modThicknessWrap')
};

Object.entries(CAMERA_COLOR_PRESETS).forEach(([key, info]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = `${info.label}（${key}）`;
  camInputs.color.appendChild(option);
});
cameraLegend.innerHTML = Object.entries(CAMERA_COLOR_PRESETS).map(([key, info]) => `
  <span class="legend-chip"><span class="legend-dot" style="background:#${info.body.toString(16).padStart(6,'0')}"></span>${info.label}</span>
`).join('');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);
scene.fog = new THREE.Fog(0x0b1118, 120, 210);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(0,72,86);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.target.set(0,0,0);
controls.maxPolarAngle = Math.PI/2.03;
controls.minDistance = 28;
controls.maxDistance = 180;
scene.add(new THREE.HemisphereLight(0xccecff,0x1a2734,1.9));
const keyLight = new THREE.DirectionalLight(0xffffff,1.45); keyLight.position.set(20,50,30); scene.add(keyLight);
const floorRoot = new THREE.Group(), moduleRoot = new THREE.Group(), cameraRoot = new THREE.Group();
scene.add(floorRoot,moduleRoot,cameraRoot);
const grid = new THREE.GridHelper(120,24,0x25465d,0x172837); grid.position.y=-.05; scene.add(grid);

const textureLoader = new THREE.TextureLoader();
const floorData = {
  B1:{title:'B1 地下一層',texture:'assets/b1-plan.png'},
  B2:{title:'B2 地下二層',texture:'assets/b2-plan.png'}
};
const floorWidth = 100, floorDepth = 78.26;
let floorPlane = null;

const state = {
  floor:'B1', addingMode:null, showPlan:true, selectedCameraId:null, selectedModuleId:null,
  cameras: sanitizeCameras(JSON.parse(localStorage.getItem('cctv3d-cameras-v1-5') || localStorage.getItem('cctv3d-cameras-v1-4') || localStorage.getItem('cctv3d-cameras-v1') || '{"B1":[],"B2":[]}')),
  modules: sanitizeModules(JSON.parse(localStorage.getItem('cctv3d-modules-v1-3') || '{"B1":[],"B2":[]}'))
};

function sanitizeCameras(raw){
  const out={B1:[],B2:[]};
  for(const floor of ['B1','B2']){
    out[floor]=(raw?.[floor]||[]).map((c,i)=>{
      const lens = String(c.lens || '4');
      const preset = LENS_PRESETS[lens] || LENS_PRESETS['4'];
      const colorKey=c.colorKey||'red';
      return {
        id:c.id||`${floor}-cam-${Date.now()}-${i}`,
        name:c.name||`CAM-${floor}-${String(i+1).padStart(2,'0')}`,
        x:Number(c.x||0),z:Number(c.z||0),lens,
        fov:Number(c.fov ?? preset.fov),range:Number(c.range ?? preset.range),yaw:Number(c.yaw||0),note:c.note||'',
        colorKey,colorLabel:c.colorLabel||CAMERA_COLOR_PRESETS[colorKey]?.label||'原建置',fixed:!!c.fixed
      };
    });
  }
  return out;
}
function sanitizeModules(raw){
  const out={B1:[],B2:[]};
  for(const floor of ['B1','B2']){
    out[floor]=(raw?.[floor]||[]).map((m,i)=>({
      id:m.id||`${floor}-mod-${Date.now()}-${i}`,type:m.type||'wall',name:m.name||`${m.type==='column'?'COL':'WALL'}-${floor}-${String(i+1).padStart(2,'0')}`,
      x:Number(m.x||0),z:Number(m.z||0),length:Number(m.length||(m.type==='column'?.8:8)),width:Number(m.width||.8),height:Number(m.height||3),thickness:Number(m.thickness||.2),angle:Number(m.angle||0)
    }));
  }
  return out;
}

function clearGroup(group){while(group.children.length){const o=group.children[0];group.remove(o);o.traverse?.(n=>{n.geometry?.dispose?.();if(n.material)(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose?.())})}}
function buildFloor(){
  clearGroup(floorRoot);
  const tex=textureLoader.load(floorData[state.floor].texture,()=>renderer.render(scene,camera));
  tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  floorPlane=new THREE.Mesh(new THREE.PlaneGeometry(floorWidth,floorDepth),new THREE.MeshStandardMaterial({map:tex,roughness:.92,transparent:true,opacity:state.showPlan?1:.12}));
  floorPlane.rotation.x=-Math.PI/2; floorPlane.userData.isFloor=true; floorRoot.add(floorPlane);
}
function makeModuleVisual(m){
  const sel=m.id===state.selectedModuleId,isWall=m.type==='wall';
  const geo=new THREE.BoxGeometry(m.length,m.height,isWall?m.thickness:m.width);
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:sel?(isWall?0x93c5fd:0xc4b5fd):(isWall?0x6487a7:0x7c73c9),transparent:true,opacity:.9,roughness:.65,emissive:sel?(isWall?0x0b2e55:0x281f56):0}));
  mesh.position.y=m.height/2; mesh.userData={moduleId:m.id,entityType:'module'};
  const g=new THREE.Group(); g.userData={moduleId:m.id,entityType:'module'}; g.add(mesh);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:sel?0xffffff:0xdbeafe,transparent:true,opacity:.55})); edge.position.copy(mesh.position); edge.userData={moduleId:m.id,entityType:'module'}; g.add(edge);
  g.position.set(m.x,0,m.z); g.rotation.y=-THREE.MathUtils.degToRad(m.angle||0); return g;
}
function lighten(hex,f=.25){const c=new THREE.Color(hex);c.lerp(new THREE.Color(0xffffff),f);return c.getHex()}
function makeCameraVisual(c){
  const sel=c.id===state.selectedCameraId,p=CAMERA_COLOR_PRESETS[c.colorKey]||CAMERA_COLOR_PRESETS.red;
  const g=new THREE.Group(); g.userData={cameraId:c.id,entityType:'camera'};
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.8,.9),new THREE.MeshStandardMaterial({color:sel?lighten(p.body):p.body,metalness:.25,roughness:.45,emissive:sel?0x334155:0})); body.position.y=2.6; body.userData={cameraId:c.id,entityType:'camera'}; g.add(body);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.35,20),new THREE.MeshStandardMaterial({color:0x0f172a,metalness:.6,roughness:.25})); lens.rotation.z=Math.PI/2;lens.position.set(.95,2.6,0);lens.userData={cameraId:c.id,entityType:'camera'};g.add(lens);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,10),new THREE.MeshStandardMaterial({color:p.body}));pole.position.y=1.45;pole.userData={cameraId:c.id,entityType:'camera'};g.add(pole);
  const theta=THREE.MathUtils.degToRad(c.fov),r=c.range,shape=new THREE.Shape();shape.moveTo(0,0);for(let i=0;i<=28;i++){const a=-theta/2+theta*i/28;shape.lineTo(Math.cos(a)*r,Math.sin(a)*r)}shape.lineTo(0,0);
  const cone=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:p.cone,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false}));cone.rotation.x=-Math.PI/2;cone.position.y=.08;cone.userData={cameraId:c.id,entityType:'camera'};g.add(cone);
  const pts=[];[-theta/2,theta/2].forEach(a=>pts.push(new THREE.Vector3(0,.11,0),new THREE.Vector3(Math.cos(a)*r,.11,-Math.sin(a)*r)));
  const edges=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:p.line,transparent:true,opacity:.92}));edges.userData={cameraId:c.id,entityType:'camera'};g.add(edges);
  g.position.set(c.x,0,c.z);g.rotation.y=-THREE.MathUtils.degToRad(c.yaw);return g;
}
function renderModules(){clearGroup(moduleRoot);state.modules[state.floor].forEach(m=>moduleRoot.add(makeModuleVisual(m)));updateModuleList();updateModuleEditor()}
function renderCameras(){clearGroup(cameraRoot);state.cameras[state.floor].forEach(c=>cameraRoot.add(makeCameraVisual(c)));updateCameraList();updateCameraEditor()}
function saveWorking(){localStorage.setItem('cctv3d-cameras-v1-5',JSON.stringify(state.cameras));localStorage.setItem('cctv3d-modules-v1-3',JSON.stringify(state.modules))}
function selectedCamera(){return state.cameras[state.floor].find(c=>c.id===state.selectedCameraId)||null}
function selectedModule(){return state.modules[state.floor].find(m=>m.id===state.selectedModuleId)||null}
function updateStats(){cameraCount.textContent=state.cameras[state.floor].length;moduleCount.textContent=state.modules[state.floor].length;const c=selectedCamera(),m=selectedModule();selectedFov.textContent=c?`${c.fov}°`:'—';selectedModuleType.textContent=m?(m.type==='wall'?'牆體':'柱子'):'—'}
function updateModuleList(){const a=state.modules[state.floor];moduleList.innerHTML=a.length?a.map(m=>`<div class="cam-item ${m.id===state.selectedModuleId?'selected':''}" data-id="${m.id}"><div><strong>${esc(m.name)}</strong><small>${m.type==='wall'?'牆體':'柱子'}・${m.type==='wall'?`長 ${m.length}m / 厚 ${m.thickness}m`:`長 ${m.length}m / 寬 ${m.width}m`}</small></div><span class="cam-pill ${m.type}">${m.type==='wall'?'WALL':'COLUMN'}</span></div>`).join(''):'<div class="empty-list">尚無模組</div>';moduleList.querySelectorAll('.cam-item').forEach(el=>el.onclick=()=>selectModule(el.dataset.id));updateStats()}
function updateCameraList(){const a=state.cameras[state.floor];cameraList.innerHTML=a.length?a.map(c=>{const p=CAMERA_COLOR_PRESETS[c.colorKey]||CAMERA_COLOR_PRESETS.red;return `<div class="cam-item ${c.id===state.selectedCameraId?'selected':''}" data-id="${c.id}"><div><strong>${esc(c.name)}</strong><small>${c.lens}mm・${esc(c.colorLabel)}・FOV ${c.fov}°・${c.fixed?'固定':'可移動'}</small></div><span class="cam-pill" style="background:#${p.body.toString(16).padStart(6,'0')}">${esc(c.colorLabel)}</span></div>`}).join(''):'<div class="empty-list">尚無鏡頭</div>';cameraList.querySelectorAll('.cam-item').forEach(el=>el.onclick=()=>selectCamera(el.dataset.id));updateStats()}
function updateModuleEditor(){const m=selectedModule();if(!m){noModule.classList.remove('hidden');moduleForm.classList.add('hidden');return}noModule.classList.add('hidden');moduleForm.classList.remove('hidden');modInputs.name.value=m.name;modInputs.type.value=m.type==='wall'?'牆體':'柱子';modInputs.length.value=m.length;modInputs.width.value=m.width;modInputs.height.value=m.height;modInputs.thickness.value=m.thickness;modInputs.angle.value=m.angle;modInputs.angleOut.value=`${m.angle}°`;modInputs.widthWrap.classList.toggle('hidden',m.type==='wall');modInputs.thicknessWrap.classList.toggle('hidden',m.type!=='wall')}
function updateCameraEditor(){const c=selectedCamera();if(!c){noCamera.classList.remove('hidden');cameraForm.classList.add('hidden');return}noCamera.classList.add('hidden');cameraForm.classList.remove('hidden');camInputs.name.value=c.name;camInputs.lens.value=c.lens;camInputs.lensFov.value=`約 ${LENS_PRESETS[c.lens]?.fov||c.fov}°`;camInputs.color.value=c.colorKey;camInputs.colorLabel.value=c.colorLabel;camInputs.fixed.checked=c.fixed;camInputs.moveBtn.disabled=c.fixed;camInputs.moveBtn.textContent=state.addingMode==='moveCamera'?'取消移動鏡頭':'移動鏡頭位置';camInputs.fov.value=c.fov;camInputs.fovOut.value=`${c.fov}°`;camInputs.range.value=c.range;camInputs.rangeOut.value=`${c.range}m`;camInputs.yaw.value=c.yaw;camInputs.yawOut.value=`${c.yaw}°`;camInputs.note.value=c.note||''}
function selectCamera(id){state.selectedCameraId=id;state.selectedModuleId=null;renderModules();renderCameras()}
function selectModule(id){state.selectedModuleId=id;state.selectedCameraId=null;renderModules();renderCameras()}
function mutateCam(fn){const c=selectedCamera();if(!c)return;fn(c);saveWorking();renderCameras()}
function mutateMod(fn){const m=selectedModule();if(!m)return;fn(m);saveWorking();renderModules()}

camInputs.name.oninput=()=>mutateCam(c=>c.name=camInputs.name.value);
camInputs.lens.onchange=()=>mutateCam(c=>{c.lens=camInputs.lens.value;const p=LENS_PRESETS[c.lens]||LENS_PRESETS['4'];c.fov=p.fov;c.range=p.range});
camInputs.color.onchange=()=>mutateCam(c=>{const old=CAMERA_COLOR_PRESETS[c.colorKey]?.label||'';if(!c.colorLabel||c.colorLabel===old)c.colorLabel=CAMERA_COLOR_PRESETS[camInputs.color.value].label;c.colorKey=camInputs.color.value});
camInputs.colorLabel.oninput=()=>mutateCam(c=>c.colorLabel=camInputs.colorLabel.value||CAMERA_COLOR_PRESETS[c.colorKey].label);
camInputs.fixed.onchange=()=>mutateCam(c=>{c.fixed=camInputs.fixed.checked;if(c.fixed&&state.addingMode==='moveCamera')setAddingMode(null)});
camInputs.moveBtn.onclick=()=>{const c=selectedCamera();if(c&&!c.fixed)setAddingMode('moveCamera')};
camInputs.fov.oninput=()=>mutateCam(c=>c.fov=+camInputs.fov.value);
camInputs.range.oninput=()=>mutateCam(c=>c.range=+camInputs.range.value);
camInputs.yaw.oninput=()=>mutateCam(c=>c.yaw=+camInputs.yaw.value);
camInputs.note.oninput=()=>mutateCam(c=>c.note=camInputs.note.value);
$('deleteCamBtn').onclick=()=>{const c=selectedCamera();if(!c)return;state.cameras[state.floor]=state.cameras[state.floor].filter(x=>x.id!==c.id);state.selectedCameraId=null;saveWorking();renderCameras()};
modInputs.name.oninput=()=>mutateMod(m=>m.name=modInputs.name.value);
modInputs.length.oninput=()=>mutateMod(m=>m.length=Math.max(.2,+modInputs.length.value||.2));
modInputs.width.oninput=()=>mutateMod(m=>m.width=Math.max(.2,+modInputs.width.value||.2));
modInputs.height.oninput=()=>mutateMod(m=>m.height=Math.max(.2,+modInputs.height.value||.2));
modInputs.thickness.oninput=()=>mutateMod(m=>m.thickness=Math.max(.05,+modInputs.thickness.value||.05));
modInputs.angle.oninput=()=>mutateMod(m=>m.angle=+modInputs.angle.value);
$('deleteModuleBtn').onclick=()=>{const m=selectedModule();if(!m)return;state.modules[state.floor]=state.modules[state.floor].filter(x=>x.id!==m.id);state.selectedModuleId=null;saveWorking();renderModules()};
$('clearModuleBtn').onclick=()=>{if(state.modules[state.floor].length&&confirm(`確定清除 ${state.floor} 全部模組？`)){state.modules[state.floor]=[];state.selectedModuleId=null;saveWorking();renderModules()}};

function setAddingMode(mode){if(mode==='moveCamera'){const c=selectedCamera();if(!c||c.fixed)return}state.addingMode=state.addingMode===mode?null:mode;controls.enabled=!state.addingMode;addHint.classList.toggle('hidden',!state.addingMode);const txt={camera:'請在圖面上點一下放置監視器',wall:'請在圖面上點一下放置牆體',column:'請在圖面上點一下放置柱子',moveCamera:'請在圖面上點一下新的鏡頭位置'};addHint.textContent=txt[state.addingMode]||'';updateAddButtons();updateCameraEditor()}
function updateAddButtons(){const map={addCameraBtn:'camera',addWallBtn:'wall',drawerAddWallBtn:'wall',addColumnBtn:'column',drawerAddColumnBtn:'column'};Object.entries(map).forEach(([id,m])=>$(id)?.classList.toggle('active',state.addingMode===m));$('addCameraBtn').textContent=state.addingMode==='camera'?'取消新增鏡頭':'＋ 新增鏡頭';$('addWallBtn').textContent=state.addingMode==='wall'?'取消新增牆體':'＋ 新增牆體';$('drawerAddWallBtn').textContent=state.addingMode==='wall'?'取消牆體':'新增牆體';$('addColumnBtn').textContent=state.addingMode==='column'?'取消新增柱子':'＋ 新增柱子';$('drawerAddColumnBtn').textContent=state.addingMode==='column'?'取消柱子':'新增柱子'}
$('addCameraBtn').onclick=()=>setAddingMode('camera');$('addWallBtn').onclick=()=>setAddingMode('wall');$('drawerAddWallBtn').onclick=()=>setAddingMode('wall');$('addColumnBtn').onclick=()=>setAddingMode('column');$('drawerAddColumnBtn').onclick=()=>setAddingMode('column');

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{
  const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(mouse,camera);
  if(state.addingMode){const hit=raycaster.intersectObject(floorPlane,false)[0];if(!hit)return;const x=+hit.point.x.toFixed(2),z=+hit.point.z.toFixed(2);
    if(state.addingMode==='camera'){const n=state.cameras[state.floor].length+1,p=LENS_PRESETS['4'];const c={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,name:`CAM-${state.floor}-${String(n).padStart(2,'0')}`,x,z,lens:'4',fov:p.fov,range:p.range,yaw:0,note:'',colorKey:'red',colorLabel:'原建置',fixed:false};state.cameras[state.floor].push(c);state.selectedCameraId=c.id;state.selectedModuleId=null;saveWorking();setAddingMode(null);renderModules();renderCameras();return}
    if(state.addingMode==='moveCamera'){const c=selectedCamera();if(c&&!c.fixed){c.x=x;c.z=z;saveWorking();setAddingMode(null);renderCameras()}return}
    const type=state.addingMode,n=state.modules[state.floor].filter(m=>m.type===type).length+1;const m={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,type,name:`${type==='wall'?'WALL':'COL'}-${state.floor}-${String(n).padStart(2,'0')}`,x,z,length:type==='wall'?8:.8,width:.8,height:3,thickness:.2,angle:0};state.modules[state.floor].push(m);state.selectedModuleId=m.id;state.selectedCameraId=null;saveWorking();setAddingMode(null);renderModules();renderCameras();return
  }
  const hits=raycaster.intersectObjects([...moduleRoot.children,...cameraRoot.children],true);if(hits.length){const o=hits[0].object,camId=o.userData.cameraId||o.parent?.userData.cameraId||o.parent?.parent?.userData.cameraId,modId=o.userData.moduleId||o.parent?.userData.moduleId||o.parent?.parent?.userData.moduleId;if(camId){selectCamera(camId);return}if(modId){selectModule(modId);return}}
  state.selectedCameraId=null;state.selectedModuleId=null;renderModules();renderCameras();
});

$('planToggleBtn').onclick=e=>{state.showPlan=!state.showPlan;if(floorPlane)floorPlane.material.opacity=state.showPlan?1:.12;e.currentTarget.classList.toggle('active',state.showPlan);e.currentTarget.textContent=`平面底圖：${state.showPlan?'開':'關'}`};
$('view3dBtn').onclick=()=>{camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update()};
$('topViewBtn').onclick=()=>{camera.position.set(0,125,.01);controls.target.set(0,0,0);controls.update()};
$('resetViewBtn').onclick=resetView;
function resetView(){camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update()}
floorTabs.forEach(btn=>btn.onclick=()=>switchFloor(btn.dataset.floor));
function switchFloor(f){state.floor=f;state.selectedCameraId=null;state.selectedModuleId=null;setAddingMode(null);floorTabs.forEach(b=>b.classList.toggle('active',b.dataset.floor===f));floorTitle.textContent=floorData[f].title;floorChip.textContent=f;buildFloor();renderModules();renderCameras();resetView();statusText.textContent=`${f} 模型已載入｜版本 ${APP_VERSION}`}

// ---------- 專案資料夾 / 儲存 / 讀取 / 刪除 ----------
const STORAGE_KEY='cctv3d-project-store-v1-6';
const STORAGE_KEY_PREV='cctv3d-project-store-v1-5';
function getStore(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(STORAGE_KEY_PREV);
    return JSON.parse(raw)||{folders:[{id:'root',name:'我的專案'}],projects:[]};
  }catch{return {folders:[{id:'root',name:'我的專案'}],projects:[]}}
}
function setStore(s){localStorage.setItem(STORAGE_KEY,JSON.stringify(s))}
function ensureStore(){const s=getStore();if(!s.folders?.length)s.folders=[{id:'root',name:'我的專案'}];if(!s.projects)s.projects=[];setStore(s);return s}
function renderStorage(){const s=ensureStore();const current=projectFolder.value||s.folders[0].id;projectFolder.innerHTML=s.folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');projectFolder.value=s.folders.some(f=>f.id===current)?current:s.folders[0].id;const list=s.projects.filter(p=>p.folderId===projectFolder.value).sort((a,b)=>b.updatedAt-a.updatedAt);savedCount.textContent=`${list.length} 筆`;projectList.innerHTML=list.length?list.map(p=>`<div class="cam-item project-item" data-id="${esc(p.id)}"><div><strong>${esc(p.name)}</strong><small>${new Date(p.updatedAt).toLocaleString()}・${esc(p.version||'')}</small></div><div class="project-actions"><button data-act="load" data-id="${esc(p.id)}">讀取</button><button data-act="delete" data-id="${esc(p.id)}">刪除</button></div></div>`).join(''):'<div class="empty-list">此資料夾尚無儲存專案</div>';projectList.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();b.dataset.act==='load'?loadProject(b.dataset.id):deleteProject(b.dataset.id)});projectList.querySelectorAll('.project-item').forEach(el=>el.onclick=()=>{const s2=getStore(),p=s2.projects.find(x=>x.id===el.dataset.id);if(p)projectName.value=p.name})}
projectFolder.onchange=renderStorage;
$('newFolderBtn').onclick=()=>{const name=prompt('輸入新資料夾名稱：');if(!name?.trim())return;const s=ensureStore(),f={id:crypto.randomUUID?.()||`folder-${Date.now()}`,name:name.trim()};s.folders.push(f);setStore(s);renderStorage();projectFolder.value=f.id;renderStorage()};
$('deleteFolderBtn').onclick=()=>{const s=ensureStore(),id=projectFolder.value;if(id==='root'){alert('「我的專案」為預設資料夾，不能刪除。');return}const f=s.folders.find(x=>x.id===id);if(!f)return;const count=s.projects.filter(p=>p.folderId===id).length;if(!confirm(`刪除資料夾「${f.name}」？${count?`\n裡面的 ${count} 個專案也會一起刪除。`:''}`))return;s.folders=s.folders.filter(x=>x.id!==id);s.projects=s.projects.filter(p=>p.folderId!==id);setStore(s);renderStorage()};
$('saveProjectBtn').onclick=()=>{const name=projectName.value.trim();if(!name){alert('請先輸入專案名稱。');return}const s=ensureStore(),folderId=projectFolder.value;let p=s.projects.find(x=>x.folderId===folderId&&x.name===name);const payload={floor:state.floor,cameras:structuredClone(state.cameras),modules:structuredClone(state.modules),showPlan:state.showPlan};if(p){p.data=payload;p.updatedAt=Date.now();p.version=APP_VERSION}else{p={id:crypto.randomUUID?.()||`project-${Date.now()}`,folderId,name,data:payload,updatedAt:Date.now(),version:APP_VERSION};s.projects.push(p)}setStore(s);renderStorage();statusText.textContent=`已儲存：${name}｜${APP_VERSION}`};
function loadProject(id){const s=ensureStore(),p=s.projects.find(x=>x.id===id);if(!p)return;if(!confirm(`讀取「${p.name}」？目前未儲存的變更會被取代。`))return;state.cameras=sanitizeCameras(p.data.cameras);state.modules=sanitizeModules(p.data.modules);state.floor=p.data.floor||'B1';state.showPlan=p.data.showPlan!==false;projectName.value=p.name;floorTabs.forEach(b=>b.classList.toggle('active',b.dataset.floor===state.floor));floorTitle.textContent=floorData[state.floor].title;floorChip.textContent=state.floor;buildFloor();renderModules();renderCameras();saveWorking();resetView();statusText.textContent=`已讀取：${p.name}｜${p.version||APP_VERSION}`}
function deleteProject(id){const s=ensureStore(),p=s.projects.find(x=>x.id===id);if(!p)return;if(!confirm(`確定刪除專案「${p.name}」？`))return;s.projects=s.projects.filter(x=>x.id!==id);setStore(s);renderStorage()}

function buildProjectFilePayload(){
  const folderText=projectFolder?.selectedOptions?.[0]?.textContent?.trim()||'我的專案';
  const name=projectName.value.trim()||`CCTV專案-${new Date().toISOString().slice(0,10)}`;
  return {
    format:'UTOP-CCTV-3D-PROJECT',
    schemaVersion:1,
    appVersion:APP_VERSION,
    company:'昱拓弱電有限公司',
    name,
    folder:folderText,
    exportedAt:new Date().toISOString(),
    data:{
      floor:state.floor,
      cameras:structuredClone(state.cameras),
      modules:structuredClone(state.modules),
      showPlan:state.showPlan
    }
  };
}
function safeFileName(name){return String(name||'CCTV專案').replace(/[\\/:*?"<>|]+/g,'_').trim()||'CCTV專案'}
async function exportProjectFile(){
  const payload=buildProjectFilePayload();
  const text=JSON.stringify(payload,null,2);
  const suggested=`${safeFileName(payload.name)}_${APP_VERSION}.utop3d`;
  try{
    if('showSaveFilePicker' in window){
      const handle=await window.showSaveFilePicker({
        suggestedName:suggested,
        types:[{description:'昱拓 CCTV 3D 專案檔',accept:{'application/json':['.utop3d','.json']}}]
      });
      const writable=await handle.createWritable();
      await writable.write(text);
      await writable.close();
      statusText.textContent=`已匯出專案檔：${payload.name}｜${APP_VERSION}`;
      return;
    }
    const blob=new Blob([text],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=suggested;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    statusText.textContent=`已下載專案檔：${payload.name}｜${APP_VERSION}`;
  }catch(err){
    if(err?.name!=='AbortError') alert(`匯出失敗：${err?.message||err}`);
  }
}
function normalizeImportedProject(raw){
  if(raw?.format==='UTOP-CCTV-3D-PROJECT'&&raw?.data) return raw;
  if(raw?.data?.cameras&&raw?.data?.modules) return {format:'UTOP-CCTV-3D-PROJECT',schemaVersion:1,appVersion:raw.version||'舊版',name:raw.name||'匯入專案',folder:'我的專案',data:raw.data};
  if(raw?.cameras&&raw?.modules) return {format:'UTOP-CCTV-3D-PROJECT',schemaVersion:1,appVersion:'舊版',name:'匯入專案',folder:'我的專案',data:raw};
  throw new Error('這個檔案不是可辨識的 CCTV 3D 專案檔。');
}
async function importProjectFromFile(file){
  try{
    const text=await file.text();
    const parsed=normalizeImportedProject(JSON.parse(text));
    if(!confirm(`匯入「${parsed.name||file.name}」？目前尚未儲存的變更會被取代。`)) return;
    state.cameras=sanitizeCameras(parsed.data.cameras);
    state.modules=sanitizeModules(parsed.data.modules);
    state.floor=parsed.data.floor==='B2'?'B2':'B1';
    state.showPlan=parsed.data.showPlan!==false;
    state.selectedCameraId=null;state.selectedModuleId=null;state.addingMode=null;
    projectName.value=parsed.name||file.name.replace(/\.(utop3d|json)$/i,'');
    floorTabs.forEach(b=>b.classList.toggle('active',b.dataset.floor===state.floor));
    floorTitle.textContent=floorData[state.floor].title;floorChip.textContent=state.floor;
    buildFloor();renderModules();renderCameras();saveWorking();resetView();
    statusText.textContent=`已匯入：${projectName.value}｜來源 ${parsed.appVersion||'未知版本'}`;
  }catch(err){alert(`匯入失敗：${err?.message||err}`)}
  finally{importProjectFile.value=''}
}
exportProjectBtn.onclick=exportProjectFile;
importProjectBtn.onclick=()=>importProjectFile.click();
importProjectFile.onchange=()=>{const file=importProjectFile.files?.[0];if(file)importProjectFromFile(file)};

function resize(){const w=viewer.clientWidth,h=viewer.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}window.addEventListener('resize',resize);
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
function esc(v=''){return String(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}

buildFloor();renderModules();renderCameras();updateAddButtons();renderStorage();resize();animate();
