import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const APP_VERSION = 'V1.4';
const CAMERA_COLOR_PRESETS = {
  red:    { label: '原建置', body: 0xdc2626, cone: 0xef4444, line: 0xf87171 },
  blue:   { label: '增設',   body: 0x2563eb, cone: 0x3b82f6, line: 0x60a5fa },
  orange: { label: '故障',   body: 0xea580c, cone: 0xf97316, line: 0xfb923c },
  yellow: { label: '黃',     body: 0xca8a04, cone: 0xeab308, line: 0xfacc15 },
  green:  { label: '綠',     body: 0x16a34a, cone: 0x22c55e, line: 0x4ade80 },
  purple: { label: '紫',     body: 0x7c3aed, cone: 0x8b5cf6, line: 0xa78bfa },
  gray:   { label: '灰',     body: 0x4b5563, cone: 0x6b7280, line: 0x9ca3af }
};

const viewer = document.getElementById('viewer');
const floorTabs = [...document.querySelectorAll('.floor-tab')];
const floorTitle = document.getElementById('floorTitle');
const floorChip = document.getElementById('floorChip');
const cameraCount = document.getElementById('cameraCount');
const moduleCount = document.getElementById('moduleCount');
const cameraList = document.getElementById('cameraList');
const moduleList = document.getElementById('moduleList');
const cameraLegend = document.getElementById('cameraLegend');
const noCamera = document.getElementById('noCamera');
const noModule = document.getElementById('noModule');
const cameraForm = document.getElementById('cameraForm');
const moduleForm = document.getElementById('moduleForm');
const addHint = document.getElementById('addHint');
const selectedFov = document.getElementById('selectedFov');
const selectedModuleType = document.getElementById('selectedModuleType');
const statusText = document.getElementById('statusText');
const versionBadge = document.getElementById('versionBadge');
const footerVersionInline = document.getElementById('footerVersionInline');

const inputs = {
  name: document.getElementById('camName'),
  color: document.getElementById('camColor'),
  colorLabel: document.getElementById('camColorLabel'),
  fixed: document.getElementById('camFixed'),
  moveBtn: document.getElementById('moveCamBtn'),
  fov: document.getElementById('camFov'),
  fovOut: document.getElementById('camFovOut'),
  range: document.getElementById('camRange'),
  rangeOut: document.getElementById('camRangeOut'),
  yaw: document.getElementById('camYaw'),
  yawOut: document.getElementById('camYawOut'),
  note: document.getElementById('camNote')
};

const modInputs = {
  name: document.getElementById('modName'),
  type: document.getElementById('modType'),
  length: document.getElementById('modLength'),
  width: document.getElementById('modWidth'),
  height: document.getElementById('modHeight'),
  thickness: document.getElementById('modThickness'),
  angle: document.getElementById('modAngle'),
  angleOut: document.getElementById('modAngleOut'),
  widthWrap: document.getElementById('modWidthWrap'),
  thicknessWrap: document.getElementById('modThicknessWrap')
};

versionBadge.textContent = APP_VERSION;
footerVersionInline.textContent = APP_VERSION;

Object.entries(CAMERA_COLOR_PRESETS).forEach(([key, info]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = `${info.label}（${key}）`;
  inputs.color.appendChild(option);
});

cameraLegend.innerHTML = Object.entries(CAMERA_COLOR_PRESETS).map(([key, info]) => `
  <span class="legend-chip"><span class="legend-dot" style="background:#${info.body.toString(16).padStart(6,'0')}"></span>${info.label}</span>
`).join('');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);
scene.fog = new THREE.Fog(0x0b1118, 120, 210);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(0, 72, 86);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewer.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0,0,0);
controls.maxPolarAngle = Math.PI / 2.03;
controls.minDistance = 28;
controls.maxDistance = 180;

scene.add(new THREE.HemisphereLight(0xccecff, 0x1a2734, 1.9));
const key = new THREE.DirectionalLight(0xffffff, 1.45);
key.position.set(20,50,30);
scene.add(key);

const floorRoot = new THREE.Group();
const moduleRoot = new THREE.Group();
const cameraRoot = new THREE.Group();
scene.add(floorRoot, moduleRoot, cameraRoot);
const grid = new THREE.GridHelper(120, 24, 0x25465d, 0x172837);
grid.position.y = -0.05;
scene.add(grid);

const textureLoader = new THREE.TextureLoader();
const floorData = {
  B1: { title:'B1 地下一層', texture:'assets/b1-plan.png' },
  B2: { title:'B2 地下二層', texture:'assets/b2-plan.png' }
};

const state = {
  floor:'B1',
  addingMode:null, // camera | wall | column | moveCamera
  showPlan:true,
  selectedCameraId:null,
  selectedModuleId:null,
  cameras: sanitizeCameras(JSON.parse(localStorage.getItem('cctv3d-cameras-v1-4') || localStorage.getItem('cctv3d-cameras-v1') || '{"B1":[],"B2":[]}')),
  modules: sanitizeModules(JSON.parse(localStorage.getItem('cctv3d-modules-v1-3') || '{"B1":[],"B2":[]}'))
};

let floorPlane = null;
const floorWidth = 100;
const floorDepth = 78.26;

function sanitizeCameras(raw){
  const base = { B1: [], B2: [] };
  ['B1','B2'].forEach(floor => {
    base[floor] = (raw?.[floor] || []).map((c, i) => ({
      id: c.id || `${floor}-cam-${Date.now()}-${i}`,
      name: c.name || `CAM-${floor}-${String(i+1).padStart(2,'0')}`,
      x: Number(c.x || 0),
      z: Number(c.z || 0),
      fov: Number(c.fov || 90),
      range: Number(c.range || 18),
      yaw: Number(c.yaw || 0),
      note: c.note || '',
      colorKey: c.colorKey || 'red',
      colorLabel: c.colorLabel || CAMERA_COLOR_PRESETS[c.colorKey || 'red']?.label || '原建置',
      fixed: !!c.fixed
    }));
  });
  return base;
}

function sanitizeModules(raw){
  const base = { B1: [], B2: [] };
  ['B1','B2'].forEach(floor => {
    base[floor] = (raw?.[floor] || []).map((m, i) => ({
      id: m.id || `${floor}-mod-${Date.now()}-${i}`,
      type: m.type || 'wall',
      name: m.name || `${m.type === 'column' ? 'COL' : 'WALL'}-${floor}-${String(i+1).padStart(2,'0')}`,
      x: Number(m.x || 0), z: Number(m.z || 0),
      length: Number(m.length || (m.type === 'column' ? 0.8 : 8)),
      width: Number(m.width || 0.8),
      height: Number(m.height || 3),
      thickness: Number(m.thickness || 0.2),
      angle: Number(m.angle || 0)
    }));
  });
  return base;
}

function clearGroup(group){
  while(group.children.length){
    const o = group.children[0];
    group.remove(o);
    o.traverse?.(n=>{
      n.geometry?.dispose?.();
      if(n.material) (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose?.());
    });
  }
}

function buildFloor(){
  clearGroup(floorRoot);
  const tex = textureLoader.load(floorData[state.floor].texture, () => renderer.render(scene, camera));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness:.92, metalness:0, transparent:true, opacity: state.showPlan ? 1 : .12 });
  floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, floorDepth), mat);
  floorPlane.rotation.x = -Math.PI/2;
  floorPlane.userData.isFloor = true;
  floorRoot.add(floorPlane);
}

function makeModuleVisual(data){
  const selected = data.id === state.selectedModuleId;
  const group = new THREE.Group();
  group.userData.moduleId = data.id;
  group.userData.entityType = 'module';
  const isWall = data.type === 'wall';
  const geometry = new THREE.BoxGeometry(isWall ? data.length : data.length, data.height, isWall ? data.thickness : data.width);
  const material = new THREE.MeshStandardMaterial({
    color: selected ? (isWall ? 0x93c5fd : 0xc4b5fd) : (isWall ? 0x6487a7 : 0x7c73c9),
    transparent:true, opacity: .9, roughness:.65, metalness:.04,
    emissive: selected ? (isWall ? 0x0b2e55 : 0x281f56) : 0x000000
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = data.height / 2;
  mesh.userData.moduleId = data.id;
  mesh.userData.entityType = 'module';
  group.add(mesh);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: selected ? 0xffffff : 0xdbeafe, transparent:true, opacity:.55 }));
  edge.position.copy(mesh.position);
  edge.userData.moduleId = data.id;
  edge.userData.entityType = 'module';
  group.add(edge);
  group.position.set(data.x, 0, data.z);
  group.rotation.y = -THREE.MathUtils.degToRad(data.angle || 0);
  return group;
}

function getCameraColors(cameraData, selected){
  const preset = CAMERA_COLOR_PRESETS[cameraData.colorKey] || CAMERA_COLOR_PRESETS.red;
  return {
    body: selected ? lightenHex(preset.body, 0.25) : preset.body,
    cone: preset.cone,
    line: preset.line,
    ring: selected ? 0xffffff : preset.body
  };
}

function lightenHex(hex, factor = .2){
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), factor);
  return c.getHex();
}

function makeCameraVisual(data){
  const selected = data.id === state.selectedCameraId;
  const colors = getCameraColors(data, selected);
  const g = new THREE.Group();
  g.userData.cameraId = data.id;
  g.userData.entityType = 'camera';

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8,.8,.9), new THREE.MeshStandardMaterial({ color: colors.body, metalness:.25, roughness:.45, emissive: selected ? 0x334155 : 0x000000 }));
  body.position.y = 2.6;
  body.userData.cameraId = data.id; body.userData.entityType='camera';
  g.add(body);

  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.35,20), new THREE.MeshStandardMaterial({ color:0x0f172a, metalness:.6, roughness:.25 }));
  lens.rotation.z = Math.PI/2;
  lens.position.set(.95,2.6,0);
  lens.userData.cameraId = data.id; lens.userData.entityType='camera';
  g.add(lens);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,10), new THREE.MeshStandardMaterial({ color: colors.body }));
  pole.position.y = 1.45;
  pole.userData.cameraId = data.id; pole.userData.entityType='camera';
  g.add(pole);

  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(.55,.65,.12,18), new THREE.MeshStandardMaterial({ color: colors.ring, transparent:true, opacity:.9 }));
  baseRing.position.y = .06;
  baseRing.userData.cameraId = data.id; baseRing.userData.entityType='camera';
  g.add(baseRing);

  const theta = THREE.MathUtils.degToRad(data.fov);
  const r = data.range;
  const shape = new THREE.Shape();
  shape.moveTo(0,0);
  const n = 28;
  for(let i=0;i<=n;i++){
    const a = -theta/2 + theta*i/n;
    shape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  shape.lineTo(0,0);
  const cone = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colors.cone, transparent:true, opacity:.17, side:THREE.DoubleSide, depthWrite:false }));
  cone.rotation.x = -Math.PI/2;
  cone.position.y = .08;
  cone.userData.cameraId = data.id; cone.userData.entityType='camera';
  g.add(cone);

  const edgePts=[];
  [-theta/2,theta/2].forEach(a => {
    edgePts.push(new THREE.Vector3(0,.11,0), new THREE.Vector3(Math.cos(a)*r,.11,-Math.sin(a)*r));
  });
  const edges = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePts), new THREE.LineBasicMaterial({ color: colors.line, transparent:true, opacity:.92 }));
  edges.userData.cameraId = data.id; edges.userData.entityType='camera';
  g.add(edges);

  g.position.set(data.x,0,data.z);
  g.rotation.y = -THREE.MathUtils.degToRad(data.yaw);
  return g;
}

function renderModules(){
  clearGroup(moduleRoot);
  state.modules[state.floor].forEach(m => moduleRoot.add(makeModuleVisual(m)));
  updateModuleList();
  updateModuleEditor();
}

function renderCameras(){
  clearGroup(cameraRoot);
  state.cameras[state.floor].forEach(c => cameraRoot.add(makeCameraVisual(c)));
  updateCameraList();
  updateCameraEditor();
}

function saveAll(){
  localStorage.setItem('cctv3d-cameras-v1-4', JSON.stringify(state.cameras));
  localStorage.setItem('cctv3d-modules-v1-3', JSON.stringify(state.modules));
}

function selectedCamera(){ return state.cameras[state.floor].find(c => c.id === state.selectedCameraId) || null; }
function selectedModule(){ return state.modules[state.floor].find(m => m.id === state.selectedModuleId) || null; }

function updateStats(){
  cameraCount.textContent = state.cameras[state.floor].length;
  moduleCount.textContent = state.modules[state.floor].length;
  const cam = selectedCamera();
  selectedFov.textContent = cam ? `${cam.fov}°` : '—';
  const mod = selectedModule();
  selectedModuleType.textContent = mod ? (mod.type === 'wall' ? '牆體' : '柱子') : '—';
}

function updateModuleList(){
  const arr = state.modules[state.floor];
  if(!arr.length){
    moduleList.innerHTML = '<div class="empty-list">尚無模組</div>';
    updateStats();
    return;
  }
  moduleList.innerHTML = arr.map(m => `
    <div class="cam-item ${m.id===state.selectedModuleId?'selected':''}" data-id="${m.id}">
      <div>
        <strong>${escapeHtml(m.name)}</strong>
        <small>${m.type==='wall'?'牆體':'柱子'}・${m.type==='wall'?`長 ${m.length}m / 厚 ${m.thickness}m`:`長 ${m.length}m / 寬 ${m.width}m`}</small>
      </div>
      <span class="cam-pill ${m.type}">${m.type==='wall'?'WALL':'COLUMN'}</span>
    </div>
  `).join('');
  moduleList.querySelectorAll('.cam-item').forEach(el => el.addEventListener('click', () => selectModule(el.dataset.id)));
  updateStats();
}

function updateCameraList(){
  const arr = state.cameras[state.floor];
  if(!arr.length){
    cameraList.innerHTML = '<div class="empty-list">尚無鏡頭</div>';
    updateStats();
    return;
  }
  cameraList.innerHTML = arr.map(c => {
    const preset = CAMERA_COLOR_PRESETS[c.colorKey] || CAMERA_COLOR_PRESETS.red;
    return `
      <div class="cam-item ${c.id===state.selectedCameraId?'selected':''}" data-id="${c.id}">
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <small>${escapeHtml(c.colorLabel || preset.label)}・FOV ${c.fov}°・${c.fixed ? '固定' : '可移動'}</small>
        </div>
        <span class="cam-pill cctv" style="background:#${preset.body.toString(16).padStart(6,'0')}">${escapeHtml(c.colorLabel || preset.label)}</span>
      </div>
    `;
  }).join('');
  cameraList.querySelectorAll('.cam-item').forEach(el => el.addEventListener('click', () => selectCamera(el.dataset.id)));
  updateStats();
}

function updateModuleEditor(){
  const m = selectedModule();
  if(!m){
    noModule.classList.remove('hidden');
    moduleForm.classList.add('hidden');
    return;
  }
  noModule.classList.add('hidden');
  moduleForm.classList.remove('hidden');
  modInputs.name.value = m.name;
  modInputs.type.value = m.type === 'wall' ? '牆體' : '柱子';
  modInputs.length.value = m.length;
  modInputs.width.value = m.width;
  modInputs.height.value = m.height;
  modInputs.thickness.value = m.thickness;
  modInputs.angle.value = m.angle || 0;
  modInputs.angleOut.value = `${m.angle || 0}°`;
  modInputs.widthWrap.classList.toggle('hidden', m.type === 'wall');
  modInputs.thicknessWrap.classList.toggle('hidden', m.type !== 'wall');
}

function updateCameraEditor(){
  const c = selectedCamera();
  if(!c){
    noCamera.classList.remove('hidden');
    cameraForm.classList.add('hidden');
    return;
  }
  noCamera.classList.add('hidden');
  cameraForm.classList.remove('hidden');
  inputs.name.value = c.name;
  inputs.color.value = c.colorKey;
  inputs.colorLabel.value = c.colorLabel;
  inputs.fixed.checked = !!c.fixed;
  inputs.moveBtn.disabled = !!c.fixed;
  inputs.moveBtn.textContent = state.addingMode === 'moveCamera' ? '取消移動鏡頭' : '移動鏡頭位置';
  inputs.fov.value = c.fov; inputs.fovOut.value = `${c.fov}°`;
  inputs.range.value = c.range; inputs.rangeOut.value = `${c.range}m`;
  inputs.yaw.value = c.yaw; inputs.yawOut.value = `${c.yaw}°`;
  inputs.note.value = c.note || '';
}

function setCameraColorLabelDefaultIfNeeded(cameraObj, newColorKey){
  const currentPreset = CAMERA_COLOR_PRESETS[cameraObj.colorKey] || CAMERA_COLOR_PRESETS.red;
  const currentText = (cameraObj.colorLabel || '').trim();
  if(!currentText || currentText === currentPreset.label){
    cameraObj.colorLabel = CAMERA_COLOR_PRESETS[newColorKey]?.label || currentText;
  }
}

function mutateSelectedCamera(mut){
  const c = selectedCamera();
  if(!c) return;
  mut(c);
  saveAll();
  renderCameras();
}

function mutateSelectedModule(mut){
  const m = selectedModule();
  if(!m) return;
  mut(m);
  saveAll();
  renderModules();
}

function selectCamera(id){
  state.selectedCameraId = id;
  state.selectedModuleId = null;
  renderModules();
  renderCameras();
}

function selectModule(id){
  state.selectedModuleId = id;
  state.selectedCameraId = null;
  renderModules();
  renderCameras();
}

inputs.name.addEventListener('input', () => mutateSelectedCamera(c => c.name = inputs.name.value));
inputs.color.addEventListener('change', () => mutateSelectedCamera(c => {
  setCameraColorLabelDefaultIfNeeded(c, inputs.color.value);
  c.colorKey = inputs.color.value;
}));
inputs.colorLabel.addEventListener('input', () => mutateSelectedCamera(c => c.colorLabel = inputs.colorLabel.value || (CAMERA_COLOR_PRESETS[c.colorKey]?.label || '')));
inputs.fixed.addEventListener('change', () => mutateSelectedCamera(c => {
  c.fixed = inputs.fixed.checked;
  if(c.fixed && state.addingMode === 'moveCamera') setAddingMode(null);
}));
inputs.moveBtn.addEventListener('click', () => {
  const c = selectedCamera();
  if(!c || c.fixed) return;
  setAddingMode('moveCamera');
});
inputs.fov.addEventListener('input', () => mutateSelectedCamera(c => c.fov = +inputs.fov.value));
inputs.range.addEventListener('input', () => mutateSelectedCamera(c => c.range = +inputs.range.value));
inputs.yaw.addEventListener('input', () => mutateSelectedCamera(c => c.yaw = +inputs.yaw.value));
inputs.note.addEventListener('input', () => mutateSelectedCamera(c => c.note = inputs.note.value));

document.getElementById('deleteCamBtn').addEventListener('click', () => {
  const c = selectedCamera();
  if(!c) return;
  state.cameras[state.floor] = state.cameras[state.floor].filter(x => x.id !== c.id);
  state.selectedCameraId = null;
  saveAll();
  renderCameras();
});

modInputs.name.addEventListener('input', () => mutateSelectedModule(m => m.name = modInputs.name.value));
modInputs.length.addEventListener('input', () => mutateSelectedModule(m => m.length = Math.max(0.2, +(modInputs.length.value || 0))));
modInputs.width.addEventListener('input', () => mutateSelectedModule(m => m.width = Math.max(0.2, +(modInputs.width.value || 0))));
modInputs.height.addEventListener('input', () => mutateSelectedModule(m => m.height = Math.max(0.2, +(modInputs.height.value || 0))));
modInputs.thickness.addEventListener('input', () => mutateSelectedModule(m => m.thickness = Math.max(0.05, +(modInputs.thickness.value || 0))));
modInputs.angle.addEventListener('input', () => mutateSelectedModule(m => m.angle = +modInputs.angle.value));

document.getElementById('deleteModuleBtn').addEventListener('click', () => {
  const m = selectedModule();
  if(!m) return;
  state.modules[state.floor] = state.modules[state.floor].filter(x => x.id !== m.id);
  state.selectedModuleId = null;
  saveAll();
  renderModules();
});

document.getElementById('clearModuleBtn').addEventListener('click', () => {
  if(!state.modules[state.floor].length) return;
  if(confirm(`確定清除 ${state.floor} 全部模組？`)){
    state.modules[state.floor] = [];
    state.selectedModuleId = null;
    saveAll();
    renderModules();
  }
});

function setAddingMode(mode){
  const selectedCam = selectedCamera();
  if(mode === 'moveCamera' && (!selectedCam || selectedCam.fixed)) return;
  state.addingMode = state.addingMode === mode ? null : mode;
  controls.enabled = !state.addingMode;
  addHint.classList.toggle('hidden', !state.addingMode);
  const map = {
    camera: '請在圖面上點一下放置監視器',
    wall: '請在圖面上點一下放置牆體',
    column: '請在圖面上點一下放置柱子',
    moveCamera: '請在圖面上點一下新的鏡頭位置'
  };
  addHint.textContent = map[state.addingMode] || '請在圖面上點一下放置模組或監視器';
  updateAddButtons();
  updateCameraEditor();
}

function updateAddButtons(){
  const bind = { addCameraBtn:'camera', addWallBtn:'wall', drawerAddWallBtn:'wall', addColumnBtn:'column', drawerAddColumnBtn:'column' };
  Object.entries(bind).forEach(([id, mode]) => {
    const btn = document.getElementById(id);
    if(btn) btn.classList.toggle('active', state.addingMode === mode);
  });
  document.getElementById('addCameraBtn').textContent = state.addingMode === 'camera' ? '取消新增鏡頭' : '＋ 新增鏡頭';
  document.getElementById('addWallBtn').textContent = state.addingMode === 'wall' ? '取消新增牆體' : '＋ 新增牆體';
  document.getElementById('drawerAddWallBtn').textContent = state.addingMode === 'wall' ? '取消牆體' : '新增牆體';
  document.getElementById('addColumnBtn').textContent = state.addingMode === 'column' ? '取消新增柱子' : '＋ 新增柱子';
  document.getElementById('drawerAddColumnBtn').textContent = state.addingMode === 'column' ? '取消柱子' : '新增柱子';
}

document.getElementById('addCameraBtn').addEventListener('click', () => setAddingMode('camera'));
document.getElementById('addWallBtn').addEventListener('click', () => setAddingMode('wall'));
document.getElementById('drawerAddWallBtn').addEventListener('click', () => setAddingMode('wall'));
document.getElementById('addColumnBtn').addEventListener('click', () => setAddingMode('column'));
document.getElementById('drawerAddColumnBtn').addEventListener('click', () => setAddingMode('column'));

document.getElementById('planToggleBtn').addEventListener('click', e => {
  state.showPlan = !state.showPlan;
  if(floorPlane) floorPlane.material.opacity = state.showPlan ? 1 : .12;
  e.currentTarget.classList.toggle('active', state.showPlan);
  e.currentTarget.textContent = `平面底圖：${state.showPlan ? '開' : '關'}`;
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if(state.addingMode){
    const hit = raycaster.intersectObject(floorPlane, false)[0];
    if(!hit) return;
    const x = +hit.point.x.toFixed(2);
    const z = +hit.point.z.toFixed(2);

    if(state.addingMode === 'camera'){
      const n = state.cameras[state.floor].length + 1;
      const c = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, name:`CAM-${state.floor}-${String(n).padStart(2,'0')}`, x, z, fov:90, range:18, yaw:0, note:'', colorKey:'red', colorLabel:'原建置', fixed:false };
      state.cameras[state.floor].push(c);
      state.selectedCameraId = c.id;
      state.selectedModuleId = null;
      saveAll();
      setAddingMode(null);
      renderModules();
      renderCameras();
      return;
    }

    if(state.addingMode === 'moveCamera'){
      const c = selectedCamera();
      if(c && !c.fixed){
        c.x = x; c.z = z;
        saveAll();
        setAddingMode(null);
        renderCameras();
      }
      return;
    }

    if(state.addingMode === 'wall'){
      const n = state.modules[state.floor].filter(x => x.type === 'wall').length + 1;
      const m = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, type:'wall', name:`WALL-${state.floor}-${String(n).padStart(2,'0')}`, x, z, length:8, width:.2, height:3, thickness:.2, angle:0 };
      state.modules[state.floor].push(m);
      state.selectedModuleId = m.id;
      state.selectedCameraId = null;
      saveAll();
      setAddingMode(null);
      renderModules();
      renderCameras();
      return;
    }

    if(state.addingMode === 'column'){
      const n = state.modules[state.floor].filter(x => x.type === 'column').length + 1;
      const m = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, type:'column', name:`COL-${state.floor}-${String(n).padStart(2,'0')}`, x, z, length:.8, width:.8, height:3, thickness:.8, angle:0 };
      state.modules[state.floor].push(m);
      state.selectedModuleId = m.id;
      state.selectedCameraId = null;
      saveAll();
      setAddingMode(null);
      renderModules();
      renderCameras();
      return;
    }
  }

  const hits = raycaster.intersectObjects([...moduleRoot.children, ...cameraRoot.children], true);
  if(hits.length){
    const object = hits[0].object;
    const camId = object.userData.cameraId || object.parent?.userData.cameraId || object.parent?.parent?.userData.cameraId;
    const moduleId = object.userData.moduleId || object.parent?.userData.moduleId || object.parent?.parent?.userData.moduleId;
    if(camId){ selectCamera(camId); return; }
    if(moduleId){ selectModule(moduleId); return; }
  }

  state.selectedCameraId = null;
  state.selectedModuleId = null;
  renderModules();
  renderCameras();
});

function switchFloor(floor){
  state.floor = floor;
  state.selectedCameraId = null;
  state.selectedModuleId = null;
  setAddingMode(null);
  floorTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.floor === floor));
  floorTitle.textContent = floorData[floor].title;
  floorChip.textContent = floor;
  buildFloor();
  renderModules();
  renderCameras();
  resetView();
  statusText.textContent = `${floor} 模型已載入｜版本 ${APP_VERSION}`;
}

floorTabs.forEach(btn => btn.addEventListener('click', () => switchFloor(btn.dataset.floor)));

document.getElementById('view3dBtn').addEventListener('click', () => { camera.position.set(0,72,86); controls.target.set(0,0,0); controls.update(); });
document.getElementById('topViewBtn').addEventListener('click', () => { camera.position.set(0,125,.01); controls.target.set(0,0,0); controls.update(); });
document.getElementById('resetViewBtn').addEventListener('click', resetView);

function resetView(){
  camera.position.set(0,72,86);
  controls.target.set(0,0,0);
  controls.update();
}

function resize(){
  const w = viewer.clientWidth;
  const h = viewer.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
window.addEventListener('resize', resize);

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

buildFloor();
renderModules();
renderCameras();
updateAddButtons();
statusText.textContent = `${state.floor} 模型已載入｜版本 ${APP_VERSION}`;
resize();
animate();

function escapeHtml(s=''){
  return String(s).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}
