import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const APP_VERSION = 'V1.7';
const PLAN_W = 2530;
const PLAN_H = 1980;
const PX_TO_UNIT = 0.04; // X/Z 同比例映射，保留原圖長寬比
const FLOOR_W = PLAN_W * PX_TO_UNIT;
const FLOOR_D = PLAN_H * PX_TO_UNIT;
const WORKING_KEY = 'cctv3d-working-v1-7';
const STORE_KEY = 'cctv3d-project-store-v1-7';
const PREV_STORE_KEYS = ['cctv3d-project-store-v1-6', 'cctv3d-project-store-v1-5'];

const CAMERA_COLOR_PRESETS = {
  red:    { label: '原建置', body: 0xdc2626, cone: 0xef4444, line: 0xf87171 },
  blue:   { label: '增設',   body: 0x2563eb, cone: 0x3b82f6, line: 0x60a5fa },
  orange: { label: '故障',   body: 0xea580c, cone: 0xf97316, line: 0xfb923c },
  yellow: { label: '黃',     body: 0xca8a04, cone: 0xeab308, line: 0xfacc15 },
  green:  { label: '綠',     body: 0x16a34a, cone: 0x22c55e, line: 0x4ade80 },
  purple: { label: '紫',     body: 0x7c3aed, cone: 0x8b5cf6, line: 0xa78bfa },
  gray:   { label: '灰',     body: 0x4b5563, cone: 0x6b7280, line: 0x9ca3af }
};
const LENS_PRESETS = {
  '2.8': { fov: 102, range: 14 },
  '3.6': { fov: 84,  range: 17 },
  '4':   { fov: 76,  range: 18 },
  '6':   { fov: 53,  range: 25 },
  '8':   { fov: 40,  range: 32 }
};

const $ = id => document.getElementById(id);
const els = {
  viewer: $('viewer'), floorTitle: $('floorTitle'), floorChip: $('floorChip'), statusText: $('statusText'),
  cameraCount: $('cameraCount'), moduleCount: $('moduleCount'), selectedFov: $('selectedFov'), selectedType: $('selectedType'),
  versionBadge: $('versionBadge'), footerVersionInline: $('footerVersionInline'), addHint: $('addHint'),
  noCamera: $('noCamera'), cameraForm: $('cameraForm'), noModule: $('noModule'), moduleForm: $('moduleForm'),
  itemList: $('itemList'), listFilter: $('listFilter'), cameraLegend: $('cameraLegend'),
  projectFolder: $('projectFolder'), projectName: $('projectName'), projectList: $('projectList'), savedCount: $('savedCount')
};
const floorTabs = [...document.querySelectorAll('.floor-tab')];

const camInputs = {
  name: $('camName'), lens: $('camLens'), lensFov: $('camLensFov'), color: $('camColor'), colorLabel: $('camColorLabel'), fixed: $('camFixed'),
  fov: $('camFov'), fovOut: $('camFovOut'), range: $('camRange'), rangeOut: $('camRangeOut'), yaw: $('camYaw'), yawOut: $('camYawOut'), note: $('camNote')
};
const modInputs = {
  name: $('modName'), type: $('modType'), length: $('modLength'), width: $('modWidth'), height: $('modHeight'), thickness: $('modThickness'), angle: $('modAngle'), angleOut: $('modAngleOut'), fixed: $('modFixed'),
  widthWrap: $('modWidthWrap'), thicknessWrap: $('modThicknessWrap')
};

els.versionBadge.textContent = APP_VERSION;
els.footerVersionInline.textContent = APP_VERSION;
Object.entries(CAMERA_COLOR_PRESETS).forEach(([key, info]) => {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = `${info.label}（${key}）`;
  camInputs.color.appendChild(opt);
});
els.cameraLegend.innerHTML = Object.entries(CAMERA_COLOR_PRESETS).map(([key, info]) => `<span class="legend-chip"><span class="legend-dot" style="background:#${info.body.toString(16).padStart(6,'0')}"></span>${info.label}</span>`).join('');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1118);
scene.fog = new THREE.Fog(0x0b1118, 120, 220);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
camera.position.set(0, 72, 86);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.viewer.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI / 2.03;
controls.minDistance = 28;
controls.maxDistance = 200;
scene.add(new THREE.HemisphereLight(0xccecff, 0x1a2734, 1.85));
const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(20, 60, 30); scene.add(dir);
const grid = new THREE.GridHelper(140, 28, 0x25465d, 0x172837); grid.position.y = -0.05; scene.add(grid);

const floorRoot = new THREE.Group();
const moduleRoot = new THREE.Group();
const cameraRoot = new THREE.Group();
const draftRoot = new THREE.Group();
scene.add(floorRoot, moduleRoot, cameraRoot, draftRoot);
const textureLoader = new THREE.TextureLoader();
let floorPlane = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorData = { B1: { title: 'B1 地下一層', texture: 'assets/b1-plan.png' }, B2: { title: 'B2 地下二層', texture: 'assets/b2-plan.png' } };

const state = loadWorkingState();
let dragState = null; // {kind:'camera'|'module', id}
let draftWall = { points: [], mousePoint: null };

function loadWorkingState(){
  const empty = { floor: 'B1', showPlan: true, listFilter: 'camera', cameras: { B1: [], B2: [] }, modules: { B1: [], B2: [] }, selected: { kind: 'camera', id: null } };
  try{
    const raw = JSON.parse(localStorage.getItem(WORKING_KEY) || '{}');
    const prevRaw = JSON.parse(localStorage.getItem('cctv3d-working-v1-6') || '{}');
    const merged = Object.keys(raw).length ? raw : prevRaw;
    empty.floor = merged.floor || 'B1';
    empty.showPlan = merged.showPlan !== false;
    empty.listFilter = merged.listFilter || 'camera';
    empty.cameras = sanitizeCameras(merged.cameras);
    empty.modules = sanitizeModules(merged.modules);
    empty.selected = merged.selected || empty.selected;
  }catch{}
  return empty;
}
function sanitizeCameras(raw){
  const result = { B1: [], B2: [] };
  ['B1','B2'].forEach(f => {
    result[f] = (raw?.[f] || []).map((c, i) => ({
      id: c.id || `${f}-cam-${Date.now()}-${i}`,
      name: c.name || `CAM-${f}-${String(i+1).padStart(2, '0')}`,
      x: Number(c.x ?? 0), z: Number(c.z ?? 0),
      lens: String(c.lens || '4'),
      fov: Number(c.fov ?? (LENS_PRESETS[String(c.lens || '4')]?.fov || 76)),
      range: Number(c.range ?? (LENS_PRESETS[String(c.lens || '4')]?.range || 18)),
      yaw: Number(c.yaw ?? 0), note: c.note || '', colorKey: c.colorKey || 'red', colorLabel: c.colorLabel || (CAMERA_COLOR_PRESETS[c.colorKey || 'red']?.label || '原建置'), fixed: !!c.fixed
    }));
  });
  return result;
}
function sanitizeModules(raw){
  const result = { B1: [], B2: [] };
  ['B1','B2'].forEach(f => {
    result[f] = (raw?.[f] || []).map((m, i) => ({
      id: m.id || `${f}-mod-${Date.now()}-${i}`,
      type: m.type || 'wall',
      name: m.name || `${m.type === 'column' ? 'COL' : 'WALL'}-${f}-${String(i+1).padStart(2, '0')}`,
      x: Number(m.x ?? 0), z: Number(m.z ?? 0),
      length: Number(m.length ?? (m.type === 'column' ? 0.8 : 8)),
      width: Number(m.width ?? 0.8), height: Number(m.height ?? 3), thickness: Number(m.thickness ?? 0.2), angle: Number(m.angle ?? 0), fixed: !!m.fixed
    }));
  });
  return result;
}
function saveWorking(){
  localStorage.setItem(WORKING_KEY, JSON.stringify({ floor: state.floor, showPlan: state.showPlan, listFilter: state.listFilter, cameras: state.cameras, modules: state.modules, selected: state.selected }));
}
function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }
function esc(s=''){ return String(s).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch])); }
function uid(prefix='id'){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`; }
function selCamera(){ return state.cameras[state.floor].find(x => x.id === state.selected.id && state.selected.kind === 'camera') || null; }
function selModule(){ return state.modules[state.floor].find(x => x.id === state.selected.id && state.selected.kind === 'module') || null; }
function setSelected(kind, id){ state.selected = { kind, id }; saveWorking(); refreshUI(); }
function clearSelection(){ state.selected = { kind: state.listFilter === 'camera' ? 'camera' : 'module', id: null }; saveWorking(); refreshUI(); }

function buildFloor(){
  clearGroup(floorRoot);
  const tex = textureLoader.load(floorData[state.floor].texture, () => renderer.render(scene, camera));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, transparent: true, opacity: state.showPlan ? 1 : 0.12 });
  floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D), mat);
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.userData.kind = 'floor';
  floorRoot.add(floorPlane);
}
function clearGroup(group){
  while(group.children.length){
    const obj = group.children[0];
    group.remove(obj);
    obj.traverse?.(n => {
      n.geometry?.dispose?.();
      if(n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.dispose?.());
    });
  }
}
function colorToHex(n){ return `#${n.toString(16).padStart(6, '0')}`; }
function lightHex(hex, amt=.2){ const c = new THREE.Color(hex); c.lerp(new THREE.Color(0xffffff), amt); return c.getHex(); }

function makeCameraMesh(data){
  const selected = state.selected.kind === 'camera' && state.selected.id === data.id;
  const preset = CAMERA_COLOR_PRESETS[data.colorKey] || CAMERA_COLOR_PRESETS.red;
  const g = new THREE.Group(); g.userData = { kind: 'camera', id: data.id };
  const bodyColor = selected ? lightHex(preset.body, 0.22) : preset.body;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .8, .9), new THREE.MeshStandardMaterial({ color: bodyColor, metalness: .25, roughness: .45, emissive: selected ? 0x334155 : 0x000000 }));
  body.position.y = 2.6; body.userData = { kind: 'camera', id: data.id }; g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .35, 18), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: .6, roughness: .25 }));
  lens.rotation.z = Math.PI/2; lens.position.set(.95, 2.6, 0); lens.userData = { kind: 'camera', id: data.id }; g.add(lens);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 2.2, 12), new THREE.MeshStandardMaterial({ color: bodyColor }));
  pole.position.y = 1.45; pole.userData = { kind: 'camera', id: data.id }; g.add(pole);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, .12, 18), new THREE.MeshStandardMaterial({ color: selected ? 0xffffff : preset.body, transparent: true, opacity: .95 }));
  ring.position.y = .06; ring.userData = { kind: 'camera', id: data.id }; g.add(ring);
  const theta = THREE.MathUtils.degToRad(data.fov); const r = data.range;
  const shape = new THREE.Shape(); shape.moveTo(0,0);
  for(let i=0;i<=32;i++){
    const a = -theta/2 + theta * (i/32);
    shape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  shape.lineTo(0,0);
  const cone = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: preset.cone, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
  cone.rotation.x = -Math.PI/2; cone.position.y = .08; cone.userData = { kind: 'camera', id: data.id }; g.add(cone);
  const pts=[]; [-theta/2, theta/2].forEach(a => pts.push(new THREE.Vector3(0,.11,0), new THREE.Vector3(Math.cos(a)*r, .11, -Math.sin(a)*r)));
  const edge = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: preset.line, transparent:true, opacity:.9 }));
  edge.userData = { kind: 'camera', id: data.id }; g.add(edge);
  g.position.set(data.x, 0, data.z); g.rotation.y = -THREE.MathUtils.degToRad(data.yaw);
  return g;
}
function makeModuleMesh(data){
  const selected = state.selected.kind === 'module' && state.selected.id === data.id;
  const isWall = data.type === 'wall';
  const group = new THREE.Group(); group.userData = { kind: 'module', id: data.id };
  const geom = new THREE.BoxGeometry(isWall ? data.length : data.length, data.height, isWall ? data.thickness : data.width);
  const mat = new THREE.MeshStandardMaterial({ color: selected ? (isWall ? 0x93c5fd : 0xc4b5fd) : (isWall ? 0x6487a7 : 0x7c73c9), transparent:true, opacity:.9, roughness:.65, metalness:.04, emissive: selected ? (isWall ? 0x0b2e55 : 0x281f56) : 0x000000 });
  const mesh = new THREE.Mesh(geom, mat); mesh.position.y = data.height / 2; mesh.userData = { kind: 'module', id: data.id }; group.add(mesh);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({ color: selected ? 0xffffff : 0xdbeafe, transparent:true, opacity:.55 }));
  edge.position.copy(mesh.position); edge.userData = { kind: 'module', id: data.id }; group.add(edge);
  group.position.set(data.x, 0, data.z); group.rotation.y = -THREE.MathUtils.degToRad(data.angle || 0);
  return group;
}
function renderObjects(){
  clearGroup(cameraRoot); clearGroup(moduleRoot); clearGroup(draftRoot);
  state.cameras[state.floor].forEach(c => cameraRoot.add(makeCameraMesh(c)));
  state.modules[state.floor].forEach(m => moduleRoot.add(makeModuleMesh(m)));
  renderWallDraft();
}

function renderWallDraft(){
  clearGroup(draftRoot);
  if(draftWall.points.length === 0) return;
  const points = [...draftWall.points];
  if(draftWall.mousePoint) points.push(draftWall.mousePoint);
  if(points.length >= 2){
    const worldPts = points.map(p => new THREE.Vector3(p.x, 0.15, p.z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPts), new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 }));
    draftRoot.add(line);
  }
  draftWall.points.forEach(p => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    marker.position.set(p.x, 0.15, p.z); draftRoot.add(marker);
  });
}

function refreshUI(){
  els.floorTitle.textContent = floorData[state.floor].title;
  els.floorChip.textContent = state.floor;
  els.statusText.textContent = `${state.floor} 模型已載入｜版本 ${APP_VERSION}`;
  els.listFilter.value = state.listFilter;
  els.cameraCount.textContent = state.cameras[state.floor].length;
  els.moduleCount.textContent = state.modules[state.floor].length;
  const cam = selCamera(); const mod = selModule();
  els.selectedFov.textContent = cam ? `${cam.fov}°` : '—';
  els.selectedType.textContent = cam ? '鏡頭' : mod ? (mod.type === 'wall' ? '牆體' : '柱子') : '—';
  updateCameraEditor(); updateModuleEditor(); updateItemList();
  floorTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.floor === state.floor));
  $('planToggleBtn').classList.toggle('active', state.showPlan); $('planToggleBtn').textContent = `平面底圖：${state.showPlan ? '開' : '關'}`;
}
function updateCameraEditor(){
  const c = selCamera();
  if(!c){ els.noCamera.classList.remove('hidden'); els.cameraForm.classList.add('hidden'); return; }
  els.noCamera.classList.add('hidden'); els.cameraForm.classList.remove('hidden');
  camInputs.name.value = c.name; camInputs.lens.value = String(c.lens);
  camInputs.lensFov.value = `${LENS_PRESETS[String(c.lens)]?.fov ?? c.fov}°`;
  camInputs.color.value = c.colorKey; camInputs.colorLabel.value = c.colorLabel; camInputs.fixed.checked = !!c.fixed;
  camInputs.fov.value = c.fov; camInputs.fovOut.value = `${c.fov}°`;
  camInputs.range.value = c.range; camInputs.rangeOut.value = `${c.range}m`;
  camInputs.yaw.value = c.yaw; camInputs.yawOut.value = `${c.yaw}°`;
  camInputs.note.value = c.note || '';
}
function updateModuleEditor(){
  const m = selModule();
  if(!m){ els.noModule.classList.remove('hidden'); els.moduleForm.classList.add('hidden'); return; }
  els.noModule.classList.add('hidden'); els.moduleForm.classList.remove('hidden');
  modInputs.name.value = m.name; modInputs.type.value = m.type === 'wall' ? '牆體' : '柱子'; modInputs.length.value = m.length; modInputs.width.value = m.width; modInputs.height.value = m.height; modInputs.thickness.value = m.thickness; modInputs.angle.value = m.angle; modInputs.angleOut.value = `${m.angle}°`; modInputs.fixed.checked = !!m.fixed;
  modInputs.widthWrap.classList.toggle('hidden', m.type === 'wall'); modInputs.thicknessWrap.classList.toggle('hidden', m.type !== 'wall');
}
function updateItemList(){
  const filter = state.listFilter;
  let items = [];
  if(filter === 'camera' || filter === 'all') items.push(...state.cameras[state.floor].map(x => ({ kind: 'camera', data: x })));
  if(filter === 'wall' || filter === 'all') items.push(...state.modules[state.floor].filter(x => x.type === 'wall').map(x => ({ kind: 'module', data: x })));
  if(filter === 'column' || filter === 'all') items.push(...state.modules[state.floor].filter(x => x.type === 'column').map(x => ({ kind: 'module', data: x })));
  if(!items.length){ els.itemList.innerHTML = '<div class="empty-list">目前篩選類別沒有資料</div>'; return; }
  els.itemList.innerHTML = items.map(({kind, data}) => {
    if(kind === 'camera'){
      const preset = CAMERA_COLOR_PRESETS[data.colorKey] || CAMERA_COLOR_PRESETS.red;
      const selected = state.selected.kind === 'camera' && state.selected.id === data.id ? 'selected' : '';
      return `<div class="item ${selected}" data-kind="camera" data-id="${esc(data.id)}"><div><strong>${esc(data.name)}</strong><small>${esc(data.colorLabel)}・${data.fixed ? '固定' : '可移動'}・FOV ${data.fov}°</small></div><span class="pill" style="background:${colorToHex(preset.body)}">${esc(data.colorLabel)}</span></div>`;
    }
    const selected = state.selected.kind === 'module' && state.selected.id === data.id ? 'selected' : '';
    const pillCls = data.type === 'wall' ? 'wall' : 'column';
    const desc = data.type === 'wall' ? `長 ${data.length} / 厚 ${data.thickness}` : `長 ${data.length} / 寬 ${data.width}`;
    return `<div class="item ${selected}" data-kind="module" data-id="${esc(data.id)}"><div><strong>${esc(data.name)}</strong><small>${data.type === 'wall' ? '牆體' : '柱子'}・${data.fixed ? '固定' : '可移動'}・${desc}</small></div><span class="pill ${pillCls}">${data.type === 'wall' ? 'WALL' : 'COLUMN'}</span></div>`;
  }).join('');
  els.itemList.querySelectorAll('.item').forEach(el => el.addEventListener('click', () => setSelected(el.dataset.kind, el.dataset.id)));
}

function mutateCamera(mut){ const c = selCamera(); if(!c) return; mut(c); saveWorking(); renderObjects(); refreshUI(); }
function mutateModule(mut){ const m = selModule(); if(!m) return; mut(m); saveWorking(); renderObjects(); refreshUI(); }
camInputs.name.oninput = () => mutateCamera(c => c.name = camInputs.name.value);
camInputs.lens.onchange = () => mutateCamera(c => { c.lens = camInputs.lens.value; const preset = LENS_PRESETS[c.lens]; c.fov = preset.fov; c.range = preset.range; if(!c.colorLabel) c.colorLabel = CAMERA_COLOR_PRESETS[c.colorKey]?.label || '原建置'; });
camInputs.color.onchange = () => mutateCamera(c => { const oldPreset = CAMERA_COLOR_PRESETS[c.colorKey] || CAMERA_COLOR_PRESETS.red; const current = (c.colorLabel || '').trim(); c.colorKey = camInputs.color.value; if(!current || current === oldPreset.label){ c.colorLabel = CAMERA_COLOR_PRESETS[c.colorKey]?.label || current; } });
camInputs.colorLabel.oninput = () => mutateCamera(c => c.colorLabel = camInputs.colorLabel.value || (CAMERA_COLOR_PRESETS[c.colorKey]?.label || ''));
camInputs.fixed.onchange = () => mutateCamera(c => c.fixed = camInputs.fixed.checked);
camInputs.fov.oninput = () => mutateCamera(c => c.fov = +camInputs.fov.value);
camInputs.range.oninput = () => mutateCamera(c => c.range = +camInputs.range.value);
camInputs.yaw.oninput = () => mutateCamera(c => c.yaw = +camInputs.yaw.value);
camInputs.note.oninput = () => mutateCamera(c => c.note = camInputs.note.value);
$('deleteCamBtn').onclick = () => { const c = selCamera(); if(!c) return; state.cameras[state.floor] = state.cameras[state.floor].filter(x => x.id !== c.id); clearSelection(); saveWorking(); renderObjects(); refreshUI(); };

modInputs.name.oninput = () => mutateModule(m => m.name = modInputs.name.value);
modInputs.length.oninput = () => mutateModule(m => m.length = Math.max(.2, +modInputs.length.value || .2));
modInputs.width.oninput = () => mutateModule(m => m.width = Math.max(.2, +modInputs.width.value || .2));
modInputs.height.oninput = () => mutateModule(m => m.height = Math.max(.2, +modInputs.height.value || .2));
modInputs.thickness.oninput = () => mutateModule(m => m.thickness = Math.max(.05, +modInputs.thickness.value || .05));
modInputs.angle.oninput = () => mutateModule(m => m.angle = +modInputs.angle.value);
modInputs.fixed.onchange = () => mutateModule(m => m.fixed = modInputs.fixed.checked);
$('deleteModuleBtn').onclick = () => { const m = selModule(); if(!m) return; state.modules[state.floor] = state.modules[state.floor].filter(x => x.id !== m.id); clearSelection(); saveWorking(); renderObjects(); refreshUI(); };
$('clearModuleBtn').onclick = () => { if(!state.modules[state.floor].length) return; if(confirm(`確定清除 ${state.floor} 全部模組？`)){ state.modules[state.floor] = []; if(state.selected.kind === 'module') clearSelection(); saveWorking(); renderObjects(); refreshUI(); } };

function setAddMode(mode){
  if(state.addMode === mode){ state.addMode = null; if(mode === 'wall') draftWall = { points: [], mousePoint: null }; }
  else { state.addMode = mode; if(mode !== 'wall') draftWall = { points: [], mousePoint: null }; }
  controls.enabled = !state.addMode && !dragState;
  const hintMap = { camera: '請在圖面點一下新增鏡頭', column: '請在圖面點一下新增柱子', wall: '牆體折線：可連續點多個點，按 Enter 完成，Esc 取消' };
  els.addHint.classList.toggle('hidden', !state.addMode);
  els.addHint.textContent = hintMap[state.addMode] || '請在圖面上操作';
  $('addCameraBtn').classList.toggle('active', state.addMode === 'camera'); $('addWallBtn').classList.toggle('active', state.addMode === 'wall'); $('drawerAddWallBtn').classList.toggle('active', state.addMode === 'wall'); $('addColumnBtn').classList.toggle('active', state.addMode === 'column'); $('drawerAddColumnBtn').classList.toggle('active', state.addMode === 'column');
  $('addCameraBtn').textContent = state.addMode === 'camera' ? '取消新增鏡頭' : '＋ 新增鏡頭';
  $('addWallBtn').textContent = state.addMode === 'wall' ? '取消折線牆體' : '＋ 折線牆體';
  $('drawerAddWallBtn').textContent = state.addMode === 'wall' ? '取消折線' : '折線牆體';
  $('addColumnBtn').textContent = state.addMode === 'column' ? '取消新增柱子' : '＋ 新增柱子';
  $('drawerAddColumnBtn').textContent = state.addMode === 'column' ? '取消柱子' : '新增柱子';
  renderObjects();
}
$('addCameraBtn').onclick = () => setAddMode('camera'); $('addWallBtn').onclick = () => setAddMode('wall'); $('drawerAddWallBtn').onclick = () => setAddMode('wall'); $('addColumnBtn').onclick = () => setAddMode('column'); $('drawerAddColumnBtn').onclick = () => setAddMode('column');

function getWorldPointFromEvent(evt){
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(floorPlane, false)[0];
  if(hit) return { x: +hit.point.x.toFixed(2), z: +hit.point.z.toFixed(2) };
  const p = new THREE.Vector3(); if(raycaster.ray.intersectPlane(dragPlane, p)) return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
  return null;
}
function getHitEntity(evt){
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...cameraRoot.children, ...moduleRoot.children], true);
  if(!hits.length) return null;
  let o = hits[0].object;
  while(o){ if(o.userData?.kind && o.userData?.id) return o.userData; o = o.parent; }
  return null;
}

renderer.domElement.addEventListener('pointerdown', evt => {
  const world = getWorldPointFromEvent(evt);
  if(state.addMode === 'camera'){ if(!world) return; const p = LENS_PRESETS['4']; const n = state.cameras[state.floor].length + 1; const c = { id: uid('cam'), name: `CAM-${state.floor}-${String(n).padStart(2,'0')}`, x: world.x, z: world.z, lens: '4', fov: p.fov, range: p.range, yaw: 0, note: '', colorKey: 'red', colorLabel: '原建置', fixed: false }; state.cameras[state.floor].push(c); setSelected('camera', c.id); saveWorking(); renderObjects(); refreshUI(); setAddMode(null); return; }
  if(state.addMode === 'column'){ if(!world) return; const n = state.modules[state.floor].filter(x => x.type === 'column').length + 1; const m = { id: uid('col'), type: 'column', name: `COL-${state.floor}-${String(n).padStart(2,'0')}`, x: world.x, z: world.z, length: .8, width: .8, height: 3, thickness: .8, angle: 0, fixed: false }; state.modules[state.floor].push(m); setSelected('module', m.id); saveWorking(); renderObjects(); refreshUI(); setAddMode(null); return; }
  if(state.addMode === 'wall'){ if(!world) return; draftWall.points.push(world); draftWall.mousePoint = world; renderObjects(); return; }

  const hit = getHitEntity(evt);
  if(hit){
    setSelected(hit.kind, hit.id);
    const item = hit.kind === 'camera' ? selCamera() : selModule();
    if(item && !item.fixed && world){ dragState = { kind: hit.kind, id: hit.id }; controls.enabled = false; }
    return;
  }
  clearSelection();
});
renderer.domElement.addEventListener('pointermove', evt => {
  const world = getWorldPointFromEvent(evt);
  if(state.addMode === 'wall' && draftWall.points.length){ draftWall.mousePoint = world; renderObjects(); return; }
  if(!dragState || !world) return;
  const target = dragState.kind === 'camera' ? state.cameras[state.floor].find(x => x.id === dragState.id) : state.modules[state.floor].find(x => x.id === dragState.id);
  if(!target || target.fixed) return;
  target.x = world.x; target.z = world.z; saveWorking(); renderObjects(); refreshUI();
});
['pointerup','pointerleave','pointercancel'].forEach(type => renderer.domElement.addEventListener(type, () => { if(dragState){ dragState = null; controls.enabled = !state.addMode; } }));
window.addEventListener('keydown', evt => {
  if(state.addMode !== 'wall') return;
  if(evt.key === 'Escape'){ draftWall = { points: [], mousePoint: null }; setAddMode(null); return; }
  if(evt.key === 'Enter') finalizeWallDraft();
});
function finalizeWallDraft(){
  if(draftWall.points.length < 2){ alert('牆體至少需要兩個點位。'); return; }
  const baseIndex = state.modules[state.floor].filter(x => x.type === 'wall').length + 1;
  for(let i=0;i<draftWall.points.length-1;i++){
    const a = draftWall.points[i], b = draftWall.points[i+1];
    const dx = b.x - a.x, dz = b.z - a.z; const len = +Math.hypot(dx, dz).toFixed(2); if(len < 0.2) continue;
    const angle = (Math.atan2(-dz, dx) * 180 / Math.PI + 360) % 360;
    state.modules[state.floor].push({ id: uid('wall'), type: 'wall', name: `WALL-${state.floor}-${String(baseIndex + i).padStart(2,'0')}`, x: +( (a.x+b.x)/2 ).toFixed(2), z: +( (a.z+b.z)/2 ).toFixed(2), length: len, width: .2, height: 3, thickness: .2, angle: +angle.toFixed(1), fixed: false });
  }
  draftWall = { points: [], mousePoint: null };
  saveWorking(); renderObjects(); refreshUI(); setAddMode(null);
}

els.listFilter.onchange = () => { state.listFilter = els.listFilter.value; saveWorking(); refreshUI(); };
$('planToggleBtn').onclick = () => { state.showPlan = !state.showPlan; if(floorPlane) floorPlane.material.opacity = state.showPlan ? 1 : 0.12; saveWorking(); refreshUI(); };
$('view3dBtn').onclick = () => { camera.position.set(0,72,86); controls.target.set(0,0,0); controls.update(); };
$('topViewBtn').onclick = () => { camera.position.set(0,130,0.01); controls.target.set(0,0,0); controls.update(); };
$('resetViewBtn').onclick = resetView;
function resetView(){ camera.position.set(0,72,86); controls.target.set(0,0,0); controls.update(); }
floorTabs.forEach(btn => btn.onclick = () => switchFloor(btn.dataset.floor));
function switchFloor(floor){ state.floor = floor; draftWall = { points: [], mousePoint: null }; dragState = null; buildFloor(); renderObjects(); refreshUI(); saveWorking(); resetView(); }

function getStore(){
  try{ const raw = localStorage.getItem(STORE_KEY) || PREV_STORE_KEYS.map(k => localStorage.getItem(k)).find(Boolean); return JSON.parse(raw) || { folders:[{id:'root',name:'我的專案'}], projects:[] }; }
  catch{ return { folders:[{id:'root',name:'我的專案'}], projects:[] }; }
}
function setStore(store){ localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function ensureStore(){ const s = getStore(); if(!s.folders?.length) s.folders = [{id:'root',name:'我的專案'}]; if(!s.projects) s.projects = []; setStore(s); return s; }
function renderStore(){
  const s = ensureStore();
  const current = els.projectFolder.value && s.folders.some(f => f.id === els.projectFolder.value) ? els.projectFolder.value : s.folders[0].id;
  els.projectFolder.innerHTML = s.folders.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('');
  els.projectFolder.value = current;
  const list = s.projects.filter(p => p.folderId === current).sort((a,b) => b.updatedAt - a.updatedAt);
  els.savedCount.textContent = `${list.length} 筆`;
  if(!list.length){ els.projectList.innerHTML = '<div class="empty-list">此資料夾尚無儲存專案</div>'; return; }
  els.projectList.innerHTML = list.map(p => `<div class="item"><div><strong>${esc(p.name)}</strong><small>${new Date(p.updatedAt).toLocaleString()}・${esc(p.version || '')}</small></div><div class="project-actions"><button data-act="load" data-id="${esc(p.id)}">讀取</button><button data-act="delete" data-id="${esc(p.id)}">刪除</button></div></div>`).join('');
  els.projectList.querySelectorAll('button').forEach(btn => btn.onclick = e => { e.stopPropagation(); btn.dataset.act === 'load' ? loadProject(btn.dataset.id) : deleteProject(btn.dataset.id); });
}
els.projectFolder.onchange = renderStore;
$('newFolderBtn').onclick = () => { const name = prompt('輸入新資料夾名稱：'); if(!name?.trim()) return; const s = ensureStore(); const folder = { id: uid('folder'), name: name.trim() }; s.folders.push(folder); setStore(s); renderStore(); els.projectFolder.value = folder.id; renderStore(); };
$('deleteFolderBtn').onclick = () => { const s = ensureStore(); const id = els.projectFolder.value; if(id === 'root'){ alert('「我的專案」為預設資料夾，不能刪除。'); return; } const folder = s.folders.find(f => f.id === id); if(!folder) return; const count = s.projects.filter(p => p.folderId === id).length; if(!confirm(`刪除資料夾「${folder.name}」？${count ? `\n裡面的 ${count} 個專案也會一起刪除。` : ''}`)) return; s.folders = s.folders.filter(f => f.id !== id); s.projects = s.projects.filter(p => p.folderId !== id); setStore(s); renderStore(); };
$('saveProjectBtn').onclick = () => { const name = els.projectName.value.trim(); if(!name){ alert('請先輸入專案名稱。'); return; } const s = ensureStore(); const folderId = els.projectFolder.value; const payload = buildProjectPayload(); let p = s.projects.find(x => x.folderId === folderId && x.name === name); if(p){ p.data = payload; p.updatedAt = Date.now(); p.version = APP_VERSION; } else { s.projects.push({ id: uid('project'), folderId, name, data: payload, updatedAt: Date.now(), version: APP_VERSION }); } setStore(s); renderStore(); els.statusText.textContent = `已儲存：${name}｜${APP_VERSION}`; };
function buildProjectPayload(){ return { floor: state.floor, showPlan: state.showPlan, listFilter: state.listFilter, cameras: deepCopy(state.cameras), modules: deepCopy(state.modules) }; }
function applyProjectPayload(payload){ state.floor = payload.floor || 'B1'; state.showPlan = payload.showPlan !== false; state.listFilter = payload.listFilter || 'camera'; state.cameras = sanitizeCameras(payload.cameras); state.modules = sanitizeModules(payload.modules); clearSelection(); saveWorking(); buildFloor(); renderObjects(); refreshUI(); resetView(); }
function loadProject(id){ const s = ensureStore(); const p = s.projects.find(x => x.id === id); if(!p) return; if(!confirm(`讀取「${p.name}」？目前未儲存的變更會被取代。`)) return; els.projectName.value = p.name; applyProjectPayload(p.data); els.statusText.textContent = `已讀取：${p.name}｜${p.version || APP_VERSION}`; }
function deleteProject(id){ const s = ensureStore(); const p = s.projects.find(x => x.id === id); if(!p) return; if(!confirm(`確定刪除專案「${p.name}」？`)) return; s.projects = s.projects.filter(x => x.id !== id); setStore(s); renderStore(); }
$('exportProjectBtn').onclick = async () => {
  const name = els.projectName.value.trim() || `CCTV專案-${new Date().toISOString().slice(0,10)}`;
  const payload = { format: 'UTOP-CCTV-3D-PROJECT', schemaVersion: 2, appVersion: APP_VERSION, company: '昱拓弱電有限公司', name, exportedAt: new Date().toISOString(), data: buildProjectPayload() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const filename = `${name}.utop3d`;
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types:[{ description:'UTOP 3D Project', accept:{ 'application/json':['.utop3d','.json'] } }] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); els.statusText.textContent = `已匯出：${filename}`; return;
    }catch(err){ if(err?.name !== 'AbortError') console.warn(err); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); els.statusText.textContent = `已下載：${filename}`;
};
$('importProjectBtn').onclick = () => $('importProjectFile').click();
$('importProjectFile').onchange = async e => {
  const file = e.target.files?.[0]; if(!file) return; try{ const text = await file.text(); const json = JSON.parse(text); const payload = json.data ? json.data : json; applyProjectPayload(payload); els.projectName.value = json.name || file.name.replace(/\.(utop3d|json)$/i, ''); els.statusText.textContent = `已匯入：${file.name}`; }catch(err){ alert('匯入失敗，檔案格式不正確。'); console.warn(err); } e.target.value = '';
};

function resize(){ const w = els.viewer.clientWidth, h = els.viewer.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); }
window.addEventListener('resize', resize);
function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

buildFloor(); renderObjects(); refreshUI(); renderStore(); resize(); animate();
