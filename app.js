import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const viewer = document.getElementById('viewer');
const floorTabs = [...document.querySelectorAll('.floor-tab')];
const floorTitle = document.getElementById('floorTitle');
const floorChip = document.getElementById('floorChip');
const cameraCount = document.getElementById('cameraCount');
const cameraList = document.getElementById('cameraList');
const noCamera = document.getElementById('noCamera');
const cameraForm = document.getElementById('cameraForm');
const addHint = document.getElementById('addHint');
const selectedFov = document.getElementById('selectedFov');
const selectedRange = document.getElementById('selectedRange');
const statusText = document.getElementById('statusText');

const inputs = {
  name: document.getElementById('camName'),
  fov: document.getElementById('camFov'),
  fovOut: document.getElementById('camFovOut'),
  range: document.getElementById('camRange'),
  rangeOut: document.getElementById('camRangeOut'),
  yaw: document.getElementById('camYaw'),
  yawOut: document.getElementById('camYawOut'),
  note: document.getElementById('camNote')
};

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

scene.add(new THREE.HemisphereLight(0xccecff, 0x1a2734, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(20,50,30); scene.add(key);

const floorRoot = new THREE.Group(); scene.add(floorRoot);
const cameraRoot = new THREE.Group(); scene.add(cameraRoot);
const grid = new THREE.GridHelper(120, 24, 0x25465d, 0x172837); grid.position.y = -0.05; scene.add(grid);

const textureLoader = new THREE.TextureLoader();
const floorData = {
  B1: { title:'B1 地下一層', texture:'assets/b1-plan.png' },
  B2: { title:'B2 地下二層', texture:'assets/b2-plan.png' }
};
const state = {
  floor:'B1',
  adding:false,
  selectedId:null,
  showWalls:true,
  showPlan:true,
  cameras: JSON.parse(localStorage.getItem('cctv3d-cameras-v1') || '{"B1":[],"B2":[]}')
};
if(!state.cameras.B1) state.cameras.B1=[];
if(!state.cameras.B2) state.cameras.B2=[];

let floorPlane = null;
const floorWidth = 100, floorDepth = 78.26;
const PLAN_W = 2530, PLAN_H = 1980;

// 依平面圖重新校正後的主要牆線資料（V1.2）
const wallPresets = {
  B1: {
    footprint: [
      [92,316],[1576,316],[1846,520],[1911,1197],[2281,1197],[2281,1810],[90,1810],[90,316]
    ],
    rects: [
      [337,544,555,748],    // 左上車位區核心
      [336,747,609,1043],   // 左上垃圾儲存區外框
      [610,1042,675,1220],  // 左上 FSD1 豎井
      [337,1042,1030,1220], // 發電機室
      [337,1418,1158,1528], // 左下電梯/機房長條區
      [1578,519,1848,722],  // 右上台電室/受電室主體
      [1579,721,1847,783],  // 右上受電箱室前緣
      [1583,1376,1896,1578],// 右中梯廳/機電核心外框
      [1493,1607,1706,1810] // 右下電信室
    ],
    polylines: [
      // 外圍補強
      [[92,316],[338,545]],
      [[92,1043],[338,1043]],
      [[92,1810],[2281,1810]],
      [[1911,1197],[2281,1197]],

      // 左上曲線核心與連接牆（以折線近似）
      [[338,545],[338,747]],
      [[555,545],[555,747]],
      [[338,747],[338,1043]],
      [[609,747],[609,905],[585,960],[545,1002],[490,1030],[432,1043],[338,1043]],
      [[555,747],[609,747]],
      [[610,1042],[610,1220]],
      [[675,1042],[675,1220]],
      [[675,1042],[1030,1042]],
      [[1030,1042],[1030,1220]],
      [[337,1220],[337,1528]],
      [[1158,1418],[1158,1528]],

      // 左下設備/梯間補線
      [[337,1418],[337,1528]],
      [[1030,1220],[1030,1418]],
      [[1030,1418],[1158,1418]],
      [[730,1220],[730,1318],[1030,1318]],

      // 右上斜房間與底邊
      [[1578,519],[1578,722]],
      [[1578,722],[1847,722]],
      [[1847,520],[1847,722]],
      [[1579,783],[1847,783]],

      // 右中梯廳/機房細分
      [[1583,1376],[1583,1578]],
      [[1715,1376],[1715,1578]],
      [[1788,1376],[1788,1578]],
      [[1896,1376],[1896,1578]],
      [[1583,1515],[1715,1515]],
      [[1788,1515],[1896,1515]],
      [[1493,1607],[1493,1810]],
      [[1706,1607],[1706,1810]],
      [[1706,1607],[1812,1607]],
      [[1812,1607],[1812,1810]],

      // 中下 83~88 車位左側牆與右側室內牆對齊感
      [[1412,1376],[1412,1810]],
      [[1412,1528],[1583,1528]],
      [[1412,1220],[1412,1376]],
    ],
    columns: [
      [337,544],[808,319],[1412,319],[1591,318],[1848,542],[1910,1197],[2201,1810],
      [807,847],[1096,847],[1412,847],[1592,847],[1767,847],
      [774,1197],[1410,1197],[1766,1197],[2026,1347],
      [338,1418],[776,1527],[1592,1526],[1910,1526],
      [338,747],[610,1042],[1030,1220],[1158,1418],[1412,1528]
    ]
  },
  B2: {
    footprint: [
      [92,316],[1576,316],[1846,519],[1911,1197],[2281,1197],[2281,1810],[90,1810],[90,316]
    ],
    rects: [
      [199,317,338,520],    // 左上機房
      [338,544,557,845],    // 左上車位群 / 坡道核心
      [338,1042,520,1220],  // 左中排煙機房區
      [521,1042,760,1220],  // 左中可售車位群/房間區
      [338,1418,765,1528],  // 左下電梯/設備區
      [906,1526,1088,1643], // 綠美化水槽/設備室
      [1578,519,1848,722],  // 右上機房群主體
      [1583,1376,1896,1578],// 右中梯廳/機電核心外框
      [1583,1607,1896,1810] // 右下設備室群
    ],
    polylines: [
      // 外圍補強
      [[92,316],[338,545]],
      [[92,1042],[338,1042]],
      [[92,1810],[2281,1810]],
      [[1911,1197],[2281,1197]],

      // 左上坡道核心
      [[199,317],[338,317]],
      [[338,317],[338,520]],
      [[199,520],[338,520]],
      [[338,544],[338,845]],
      [[557,544],[557,845]],
      [[338,845],[520,845]],
      [[520,845],[557,845]],
      [[338,1042],[520,1042]],
      [[520,1042],[760,1042]],
      [[520,1220],[760,1220]],
      [[760,1042],[760,1220]],
      [[338,1220],[338,1528]],
      [[765,1418],[765,1528]],

      // 左下設備與中下水槽區
      [[338,1418],[338,1528]],
      [[765,1418],[906,1418]],
      [[906,1418],[906,1643]],
      [[1088,1526],[1088,1643]],
      [[906,1643],[1088,1643]],

      // 右上房間分隔
      [[1578,519],[1578,722]],
      [[1848,519],[1848,722]],
      [[1578,563],[1848,563]],
      [[1578,640],[1848,640]],
      [[1578,722],[1848,722]],

      // 右中梯廳/設備群
      [[1583,1376],[1583,1578]],
      [[1715,1376],[1715,1578]],
      [[1788,1376],[1788,1578]],
      [[1896,1376],[1896,1578]],
      [[1583,1515],[1715,1515]],
      [[1788,1515],[1896,1515]],
      [[1583,1607],[1583,1810]],
      [[1712,1607],[1712,1810]],
      [[1896,1607],[1896,1810]],
      [[1410,1528],[1583,1528]],
      [[1410,1376],[1410,1810]]
    ],
    columns: [
      [337,545],[808,319],[1412,319],[1591,318],[1848,541],[1910,1197],[2201,1810],
      [808,846],[1096,847],[1412,847],[1592,847],[1767,847],
      [774,1197],[1410,1197],[1766,1197],[2026,1347],
      [338,1418],[776,1527],[1592,1526],[1910,1526],
      [338,845],[520,1042],[760,1220],[906,1643]
    ]
  }
};

function clearGroup(group){
  while(group.children.length){
    const o = group.children[0];
    group.remove(o);
    o.traverse?.(n=>{
      n.geometry?.dispose?.();
      if(n.material){
        (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose?.());
      }
    });
  }
}

function imgToWorld([x,y]){
  return [
    (x / PLAN_W - 0.5) * floorWidth,
    (y / PLAN_H - 0.5) * floorDepth
  ];
}

function makeWall(a,b,height=3.35,thickness=.28,color=0x6f8799,opacity=.86){
  const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
  const geo=new THREE.BoxGeometry(len,height,thickness);
  const mat=new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.05,transparent:true,opacity});
  const m=new THREE.Mesh(geo,mat);
  m.position.set((a[0]+b[0])/2,height/2,(a[1]+b[1])/2);
  m.rotation.y=-Math.atan2(dz,dx);
  return m;
}

function makeColumn(x,z,size=.72,height=3.25){
  const geo = new THREE.BoxGeometry(size,height,size);
  const mat = new THREE.MeshStandardMaterial({color:0x96a9b8,roughness:.72,metalness:.04,transparent:true,opacity:.9});
  const col = new THREE.Mesh(geo,mat);
  col.position.set(x,height/2,z);
  return col;
}

function addPolylineWalls(group, pts, {height=3.2, thickness=.24, color=0x768ca0, opacity=.88, closed=false}={}){
  for(let i=0;i<pts.length-1;i++){
    const a = imgToWorld(pts[i]);
    const b = imgToWorld(pts[i+1]);
    group.add(makeWall(a,b,height,thickness,color,opacity));
  }
  if(closed && pts.length > 2){
    const a = imgToWorld(pts[pts.length-1]);
    const b = imgToWorld(pts[0]);
    group.add(makeWall(a,b,height,thickness,color,opacity));
  }
}

function addRectWalls(group, [x1,y1,x2,y2], {height=3.0, thickness=.22, color=0x7f95a7, opacity=.88}={}){
  const pts = [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]];
  addPolylineWalls(group, pts, {height, thickness, color, opacity});
}

function buildWalls(){
  const group = new THREE.Group();
  group.name = 'walls';
  const preset = wallPresets[state.floor];

  addPolylineWalls(group, preset.footprint, {
    height: 3.55,
    thickness: 0.34,
    color: 0x5f7890,
    opacity: 0.94
  });

  preset.rects.forEach(rect => addRectWalls(group, rect, {
    height: 3.02,
    thickness: 0.22,
    color: 0x768a9d,
    opacity: 0.9
  }));

  preset.polylines.forEach(poly => addPolylineWalls(group, poly, {
    height: 3.02,
    thickness: 0.2,
    color: 0x70879a,
    opacity: 0.9
  }));

  const colGroup = new THREE.Group();
  colGroup.name = 'columns';
  preset.columns.forEach(pt => {
    const [x,z] = imgToWorld(pt);
    colGroup.add(makeColumn(x,z));
  });
  group.add(colGroup);

  group.visible = state.showWalls;
  floorRoot.add(group);
}

function buildFloor(){
  clearGroup(floorRoot);
  const tex=textureLoader.load(floorData[state.floor].texture,()=>renderer.render(scene,camera));
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.9,metalness:0,transparent:true,opacity:state.showPlan?1:.12});
  floorPlane=new THREE.Mesh(new THREE.PlaneGeometry(floorWidth,floorDepth),mat);
  floorPlane.rotation.x=-Math.PI/2;
  floorPlane.position.y=0;
  floorPlane.userData.isFloor=true;
  floorRoot.add(floorPlane);
  buildWalls();
}

function makeCameraVisual(data){
  const g=new THREE.Group(); g.userData.cameraId=data.id;
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.8,.9),new THREE.MeshStandardMaterial({color:0xdbeafe,metalness:.25,roughness:.45}));
  body.position.y=2.6; g.add(body);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.35,20),new THREE.MeshStandardMaterial({color:0x0f172a,metalness:.6,roughness:.25}));
  lens.rotation.z=Math.PI/2; lens.position.set(.95,2.6,0); g.add(lens);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,2.2,10),new THREE.MeshStandardMaterial({color:0x64748b})); pole.position.y=1.45; g.add(pole);
  const theta=THREE.MathUtils.degToRad(data.fov), r=data.range;
  const shape=new THREE.Shape(); shape.moveTo(0,0); const n=28; for(let i=0;i<=n;i++){ const a=-theta/2+theta*i/n; shape.lineTo(Math.cos(a)*r,Math.sin(a)*r); } shape.lineTo(0,0);
  const geo=new THREE.ShapeGeometry(shape); const mat=new THREE.MeshBasicMaterial({color:0xef4444,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false});
  const cone=new THREE.Mesh(geo,mat); cone.rotation.x=-Math.PI/2; cone.position.y=.08; g.add(cone);
  const edgePts=[]; [-theta/2,theta/2].forEach(a=>{edgePts.push(new THREE.Vector3(0,.11,0),new THREE.Vector3(Math.cos(a)*r,.11,-Math.sin(a)*r));});
  const edges=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePts),new THREE.LineBasicMaterial({color:0xff6b6b,transparent:true,opacity:.85})); g.add(edges);
  g.position.set(data.x,0,data.z); g.rotation.y=-THREE.MathUtils.degToRad(data.yaw);
  return g;
}

function renderCameras(){
  clearGroup(cameraRoot);
  state.cameras[state.floor].forEach(c=>cameraRoot.add(makeCameraVisual(c)));
  updateList(); updateEditor();
}

function save(){localStorage.setItem('cctv3d-cameras-v1',JSON.stringify(state.cameras));}

function updateList(){
  const arr=state.cameras[state.floor]; cameraCount.textContent=arr.length;
  if(!arr.length){cameraList.innerHTML='<div class="empty-list">尚無鏡頭</div>';return;}
  cameraList.innerHTML=arr.map(c=>`<div class="cam-item ${c.id===state.selectedId?'selected':''}" data-id="${c.id}"><div><strong>${escapeHtml(c.name)}</strong><small>FOV ${c.fov}°・${c.range}m</small></div><span class="cam-pill">CCTV</span></div>`).join('');
  cameraList.querySelectorAll('.cam-item').forEach(el=>el.addEventListener('click',()=>selectCamera(el.dataset.id)));
}

function escapeHtml(s=''){return s.replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));}
function selected(){return state.cameras[state.floor].find(c=>c.id===state.selectedId)||null;}
function selectCamera(id){state.selectedId=id; updateList(); updateEditor();}

function updateEditor(){
  const c=selected();
  if(!c){noCamera.classList.remove('hidden');cameraForm.classList.add('hidden');selectedFov.textContent='—';selectedRange.textContent='—';return;}
  noCamera.classList.add('hidden');cameraForm.classList.remove('hidden');
  inputs.name.value=c.name; inputs.fov.value=c.fov; inputs.fovOut.value=`${c.fov}°`; inputs.range.value=c.range; inputs.rangeOut.value=`${c.range}m`; inputs.yaw.value=c.yaw; inputs.yawOut.value=`${c.yaw}°`; inputs.note.value=c.note||'';
  selectedFov.textContent=`${c.fov}°`; selectedRange.textContent=`${c.range}m`;
}

function mutateSelected(mut){ const c=selected(); if(!c)return; mut(c); save(); renderCameras(); }
inputs.name.addEventListener('input',()=>mutateSelected(c=>c.name=inputs.name.value));
inputs.fov.addEventListener('input',()=>mutateSelected(c=>c.fov=+inputs.fov.value));
inputs.range.addEventListener('input',()=>mutateSelected(c=>c.range=+inputs.range.value));
inputs.yaw.addEventListener('input',()=>mutateSelected(c=>c.yaw=+inputs.yaw.value));
inputs.note.addEventListener('input',()=>mutateSelected(c=>c.note=inputs.note.value));

document.getElementById('deleteCamBtn').addEventListener('click',()=>{const c=selected();if(!c)return;state.cameras[state.floor]=state.cameras[state.floor].filter(x=>x.id!==c.id);state.selectedId=null;save();renderCameras();});
document.getElementById('clearCameraBtn').addEventListener('click',()=>{if(!state.cameras[state.floor].length)return;if(confirm(`確定清除 ${state.floor} 全部鏡頭？`)){state.cameras[state.floor]=[];state.selectedId=null;save();renderCameras();}});

document.getElementById('addCameraBtn').addEventListener('click',()=>{state.adding=!state.adding;addHint.classList.toggle('hidden',!state.adding);document.getElementById('addCameraBtn').textContent=state.adding?'取消新增':'＋ 新增鏡頭';controls.enabled=!state.adding;});

const raycaster=new THREE.Raycaster(), mouse=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!state.adding)return;
  const r=renderer.domElement.getBoundingClientRect(); mouse.x=((e.clientX-r.left)/r.width)*2-1; mouse.y=-((e.clientY-r.top)/r.height)*2+1; raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObject(floorPlane,false)[0]; if(!hit)return;
  const n=state.cameras[state.floor].length+1;
  const c={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,name:`CAM-${state.floor}-${String(n).padStart(2,'0')}`,x:+hit.point.x.toFixed(2),z:+hit.point.z.toFixed(2),fov:90,range:18,yaw:0,note:''};
  state.cameras[state.floor].push(c); state.selectedId=c.id; state.adding=false; controls.enabled=true; addHint.classList.add('hidden'); document.getElementById('addCameraBtn').textContent='＋ 新增鏡頭'; save(); renderCameras();
});

function switchFloor(floor){
  state.floor=floor;
  state.selectedId=null;
  floorTabs.forEach(b=>b.classList.toggle('active',b.dataset.floor===floor));
  floorTitle.textContent=floorData[floor].title;
  floorChip.textContent=floor;
  buildFloor();
  renderCameras();
  resetView();
  statusText.textContent = `${floor} 模型已載入`;
}
floorTabs.forEach(b=>b.addEventListener('click',()=>switchFloor(b.dataset.floor)));

function resetView(){camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update();}
document.getElementById('resetViewBtn').addEventListener('click',resetView);
document.getElementById('view3dBtn').addEventListener('click',()=>{camera.position.set(0,72,86);controls.target.set(0,0,0);controls.update();});
document.getElementById('topViewBtn').addEventListener('click',()=>{camera.position.set(0,125,.01);controls.target.set(0,0,0);controls.update();});
document.getElementById('wallToggleBtn').addEventListener('click',e=>{state.showWalls=!state.showWalls;const w=floorRoot.getObjectByName('walls');if(w)w.visible=state.showWalls;e.currentTarget.classList.toggle('active',state.showWalls);e.currentTarget.textContent=`立體牆體：${state.showWalls?'開':'關'}`;});
document.getElementById('planToggleBtn').addEventListener('click',e=>{state.showPlan=!state.showPlan;if(floorPlane)floorPlane.material.opacity=state.showPlan?1:.12;e.currentTarget.classList.toggle('active',state.showPlan);e.currentTarget.textContent=`平面底圖：${state.showPlan?'開':'關'}`;});

function resize(){const w=viewer.clientWidth,h=viewer.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}window.addEventListener('resize',resize);
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}buildFloor();renderCameras();resize();animate();
