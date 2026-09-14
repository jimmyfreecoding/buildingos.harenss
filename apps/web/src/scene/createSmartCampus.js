import * as THREE from 'three';
import { createDesignCenter } from './createDesignCenter.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSmartFacadeMaterials } from './smartFacadeMaterials.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Photo-based concept geometry, in approximate metres; not a surveyed BIM model.
export const SMART_BUILDINGS = [
  { id: 'A', name: '总部', label: '总部', x: 0, z: 30, w: 150, d: 60, h: 18, floors: 3, area: '24,000', people: 138, equipment: 426 },
  { id: 'B', name: '造型中心', label: '造型中心', x: -178, z: 30, w: 100, d: 60, h: 12, floors: 2, area: '10,800', people: 107, equipment: 382 },
];

export function createSmartCampus(container, callbacks = {}, options = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .85;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(43, 1, 1, 1800);
  const home = new THREE.Vector3(-15, 230, 410), target = new THREE.Vector3(-65, 0, -10);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 40; controls.maxDistance = 850;
  controls.maxPolarAngle = Math.PI * .485; controls.autoRotateSpeed = .45;
  const sun = new THREE.DirectionalLight(0xffeed8, 2.4); sun.position.set(-100, 180, 100);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -210, right: 210, top: 210, bottom: -210, near: 1, far: 600 });
  sun.shadow.bias = -.0003;
  const ambient = new THREE.HemisphereLight(0xd7eeff, 0x5a6650, 1.3); scene.add(sun, ambient);
  // 主题调色板：只覆盖它关心的项
  const p = options.palette || {};
  const pick = (key, fallback) => (p[key] === undefined ? fallback : p[key]);
  const material = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra }); m.color.convertSRGBToLinear(); return m; };
  const silver = material(pick('silver', 0xcbd3d8), { metalness: .45, roughness: .38 });
  const glass = material(pick('glass', 0x426f84), { metalness: .65, roughness: .2, emissive: 0x183644, emissiveIntensity: .15 });
  const frameMat = material(pick('frame', 0xa9c1cc), { metalness: .65 });
  const road = material(pick('road', 0x343f49)), white = material(pick('white', 0xe1e5e6)), green = material(pick('green', 0x547249)), dark = material(pick('dark', 0x182a35));
  const { facadeGlass, reflection, facadeTexture } = createSmartFacadeMaterials(renderer);
  const innerFrame = material(0x263c40, { metalness: .35 });
  const boxGeo = new THREE.BoxBufferGeometry(1, 1, 1), selectable = [];
  function mesh(geometry, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  }
  function box(w, h, d, x, y, z, mat, building) {
    const m = mesh(boxGeo, mat, x, y, z); m.scale.set(w, h, d);
    if (building) { m.userData.building = building; selectable.push(m); } return m;
  }
  const beamMeshes = [];
  function beam(a, b, radius = .12, mat = frameMat) {
    const delta = b.clone().sub(a);
    const m = mesh(new THREE.CylinderBufferGeometry(radius, radius, delta.length(), 5), mat);
    m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); beamMeshes.push(m); return m;
  }
  // 「纯白背景」开关：天空和地面都刷成同一个纯色，地平线就消失了
  const groundMat = material(pick('ground', 0x84917e));
  const groundBase = groundMat.color.clone();
  const studioSky = pick('studioSky', 0xffffff);
  const studioGround = pick('studioGround', 0xffffff);
  let studio = Boolean(options.studio);
  let currentHour = 14;
  box(1100, 1, 1100, 0, -2, 0, groundMat);
  box(230, 1, 285, 0, -1, -26, material(0xadb4b4));
  box(217, .12, 268, 0, -.4, -26, road);
  box(166, .25, 84, 0, -.15, 37, material(0xc4cbd0));
  // Office footprint: curved corners and a deep semicircular entrance recess.
  const outline = new THREE.Shape();
  outline.moveTo(-68, -30); outline.lineTo(68, -30); outline.quadraticCurveTo(75, -30, 75, -23);
  outline.lineTo(75, 23); outline.quadraticCurveTo(75, 30, 68, 30); outline.lineTo(32, 30);
  outline.absarc(0, 30, 32, 0, Math.PI, true);
  outline.lineTo(-68, 30); outline.quadraticCurveTo(-75, 30, -75, 23);
  outline.lineTo(-75, -23); outline.quadraticCurveTo(-75, -30, -68, -30);
  function officePlate(height, y, mat, expand = 1) {
    const geo = new THREE.ExtrudeBufferGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 32 });
    geo.rotateX(Math.PI / 2);
    if (mat === facadeGlass) {
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i=0;i<pos.count;i++) uv.setXY(i,(pos.getX(i)+pos.getZ(i)+30)/5.4,(pos.getY(i)+y+height)/18);
    }
    const m = mesh(geo, mat, 0, y + height, 30); m.scale.set(expand, 1, expand);
    m.userData.building = SMART_BUILDINGS[0]; selectable.push(m); return m;
  }
  officePlate(18, 0, facadeGlass); officePlate(.36, 18.24, silver, 1.008);
  officePlate(.2, 18.02, dark, 1.006); officePlate(.25, 0, dark, 1.006);
  // The reference's signature glass funnel: wide roof rim narrowing to a circular plaza.
  const rows = 8, segments = 40, vertices = [], points = [];
  for (let r = 0; r <= rows; r++) {
    // Keep the roof rim and street-facing ends fixed; extend the lower recess
    // into the building so the circular courtyard sits behind the facade.
    const t = r / rows, radius = 15 + 17 * t, recessDepth = 29 + 3 * t;
    points[r] = [];
    for (let s = 0; s <= segments; s++) {
      const angle = Math.PI + s / segments * Math.PI;
      points[r][s] = new THREE.Vector3(Math.cos(angle) * radius, 1 + 17.6 * Math.sin(t * Math.PI / 2), 60 + Math.sin(angle) * recessDepth);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < segments; s++) {
    const a = points[r][s], b = points[r + 1][s], c = points[r + 1][s + 1], d = points[r][s + 1];
    for (const p of [a, b, c, a, c, d]) vertices.push(p.x, p.y, p.z);
    beam(a, b, .09, dark); beam(a, d, .09, dark); beam(a, c, .075, dark);
  }
  const funnelGeo = new THREE.BufferGeometry(); funnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); funnelGeo.computeVertexNormals();
  const triangleColors=[];
  for(let i=0;i<vertices.length/9;i++){
    const shade=.68+.28*((Math.sin(i*78.233)*43758.5453)%1+1)/2;
    const c=new THREE.Color(0x709eb8).convertSRGBToLinear().multiplyScalar(shade);
    for(let j=0;j<3;j++)triangleColors.push(c.r,c.g,c.b);
  }
  funnelGeo.setAttribute('color',new THREE.Float32BufferAttribute(triangleColors,3));
  const funnel = mesh(funnelGeo, material(0xffffff, { vertexColors:THREE.VertexColors,envMap:reflection,envMapIntensity:.9, metalness: .55, roughness: .21, side: THREE.DoubleSide, flatShading: true }));
  funnel.userData.building = SMART_BUILDINGS[0]; selectable.push(funnel);
  for (let s = 0; s < segments; s++) beam(points[rows][s], points[rows][s + 1], .24);
  // Close both front wings below the funnel edge. Reuse its sampled boundary so
  // the glazing and diagonal coping meet exactly, rather than leaving open wedges.
  for (const side of [-1, 1]) {
    const edge = points.map(row => row[side < 0 ? 0 : segments]);
    const wing = new THREE.Shape();
    wing.moveTo(side * 32, 0);
    wing.lineTo(side * 15, 0);
    edge.forEach(p => wing.lineTo(p.x, p.y));
    wing.closePath();
    const infill = mesh(new THREE.ExtrudeBufferGeometry(wing, {
      depth: .35, bevelEnabled: false,
    }), facadeGlass, 0, 0, 59.65);
    const pos = infill.geometry.attributes.position, uv = infill.geometry.attributes.uv;
    for (let i=0;i<pos.count;i++) uv.setXY(i,(pos.getX(i)+pos.getZ(i)+59.65)/5.4,pos.getY(i)/18);
    infill.userData.building = SMART_BUILDINGS[0]; selectable.push(infill);
    for (let r = 0; r < rows; r++) beam(edge[r], edge[r + 1], .19, frameMat);
    box(17, .4, .5, side * 23.5, .2, 60, frameMat);
    box(.16, 1, .25, side * 15, .5, 60.15, frameMat);
  }
  // A continuous perimeter supports paired mullions, fine glazing bars and
  // recessed dark framing, including the rounded corners and entrance wings.
  const perimeter = new THREE.Path();
  perimeter.moveTo(-15,60);perimeter.lineTo(-68,60);perimeter.quadraticCurveTo(-75,60,-75,53);
  perimeter.lineTo(-75,7);perimeter.quadraticCurveTo(-75,0,-68,0);perimeter.lineTo(68,0);
  perimeter.quadraticCurveTo(75,0,75,7);perimeter.lineTo(75,53);perimeter.quadraticCurveTo(75,60,68,60);perimeter.lineTo(15,60);
  const perimeterLength=perimeter.getLength();
  const facadeHeight=p=>{
    if(p.y<59.99||Math.abs(p.x)>=32)return 18;
    const t=Math.max(0,Math.min(rows-.000001,(Math.abs(p.x)-15)/17*rows)),i=Math.floor(t);
    return Math.min(18,THREE.MathUtils.lerp(points[i][0].y,points[i+1][0].y,t-i));
  };
  function facadeBar(p,tangent,y,w,h,depth,offset,mat){
    const outward=new THREE.Vector2(tangent.y,-tangent.x);
    const m=box(w,h,depth,p.x+outward.x*offset,y,p.y+outward.y*offset,mat);
    m.rotation.y=-Math.atan2(tangent.y,tangent.x);return m;
  }
  for(let d=0,index=0;d<=perimeterLength;d+=1.35,index++){
    const t=d/perimeterLength,p=perimeter.getPointAt(t),dir=perimeter.getTangentAt(t),h=facadeHeight(p);
    facadeBar(p,dir,h/2,.09,h,.25,.1,innerFrame);
    for(const shift of [-.085,.085]){
      const q=p.clone().addScaledVector(dir,shift);
      const height=facadeHeight(q);
      facadeBar(q,dir,height/2,.045,height,.1,.25,frameMat);
    }
    if(index%4===0)facadeBar(p,dir,h/2,.25,h,.38,.06,frameMat);
    for(let y=1.5;y<h-.4;y+=3){
      // Small operable-window frames behind the outer pair.
      if(index%3===0){facadeBar(p,dir,y,.7,.06,.08,.17,frameMat);facadeBar(p,dir,y+.8,.7,.06,.08,.17,frameMat);}
    }
  }
  const pathPoints=perimeter.getSpacedPoints(Math.ceil(perimeterLength/.65));
  for(const y of [.3,3,6,9,12,15,17.8])for(let i=0;i<pathPoints.length-1;i++){
    const a=pathPoints[i],b=pathPoints[i+1];if(Math.min(facadeHeight(a),facadeHeight(b))<y+.1)continue;
    const dir=b.clone().sub(a).normalize(),p=a.clone().add(b).multiplyScalar(.5);
    facadeBar(p,dir,y,a.distanceTo(b)+.01,y%6===0?.10:.045,.10,.24,y%6===0?frameMat:innerFrame);
  }
  // Entire circle remains inside z=60 (the front facade), with a paved approach.
  const courtyardZ = 44, courtyardRadius = 11;
  box(28, .12, 28, 0, .08, 46, material(0x9ea5aa));
  mesh(new THREE.CylinderBufferGeometry(courtyardRadius, courtyardRadius, .25, 64), material(0x080f1a, { roughness: .22, metalness: .35 }), 0, .2, courtyardZ);
  mesh(new THREE.CylinderBufferGeometry(4.5, 4.5, .3, 48), silver, 0, .4, courtyardZ);
  mesh(new THREE.CylinderBufferGeometry(4, 4, .32, 48), dark, 0, .42, courtyardZ);
  for(const radius of [3.1,3.5,3.9]){
    const ring=mesh(new THREE.TorusBufferGeometry(radius,.025,4,64),frameMat,0,.6,courtyardZ);ring.rotation.x=Math.PI/2;
  }
  // Low rounded service enclosure: flat louver deck with a rolled east edge.
  const enclosure=new THREE.Shape();
  enclosure.moveTo(-68,5);enclosure.lineTo(-43,5);enclosure.quadraticCurveTo(-37,5,-37,11);
  enclosure.lineTo(-37,44);enclosure.lineTo(-68,44);enclosure.quadraticCurveTo(-72,44,-72,40);
  enclosure.lineTo(-72,10);enclosure.quadraticCurveTo(-72,5,-68,5);
  const enclosureGeo=new THREE.ExtrudeBufferGeometry(enclosure,{depth:4.4,bevelEnabled:true,bevelThickness:.6,bevelSize:.7,bevelSegments:5,steps:1,curveSegments:20});
  enclosureGeo.rotateX(Math.PI/2);mesh(enclosureGeo,silver,0,23.1,0);
  const louverMat=material(0x53595b,{metalness:.45});
  box(26,.25,37,-56.5,23.5,24.5,louverMat);
  for(let z=6;z<44;z+=.55){
    box(26,.16,.09,-56.5,23.75,z,frameMat);
    let prev=new THREE.Vector3(-43.5,23.75,z);
    for(let i=1;i<=8;i++){
      const angle=i/8*Math.PI/2,p=new THREE.Vector3(-43.5+6*Math.sin(angle),19.1+4.65*Math.cos(angle),z);
      beam(prev,p,.06,louverMat);prev=p;
    }
  }
  const accent=material(0xbbce73);
  for(const z of [5.5,44]){
    beam(new THREE.Vector3(-69.5,23.65,z),new THREE.Vector3(-43.5,23.65,z),.16,accent);
    let prev=new THREE.Vector3(-43.5,23.65,z);
    for(let i=1;i<=16;i++){const a=i/16*Math.PI/2,p=new THREE.Vector3(-43.5+6*Math.sin(a),19.1+4.55*Math.cos(a),z);beam(prev,p,.16,accent);prev=p;}
  }
  for(let x=-70;x<73;x+=6)for(let z=3;z<59;z+=1.5){
    if(Math.hypot(x,z-60)>33 && !(x<-35&&z<46))box(.055,.025,1.45,x,18.615,z,frameMat);
  }
  for(let z=3;z<59;z+=8)for(let x=-70;x<73;x+=1.5){
    if(Math.hypot(x,z-60)>33 && !(x<-35&&z<46))box(1.45,.025,.045,x,18.62,z,frameMat);
  }
  // Large silver production shed, roof skylights, loading doors and service annex.
  box(140, 27, 100, -7, 13.5, -74, silver);
  box(141, .6, 101, -7, 27.2, -74, white);
  for (let y = 1; y < 27; y += .65) box(140,.025,.06,-7,y,-23.96,frameMat);
  for (let x=-75;x<64;x+=14) box(.04,26,.07,x,13.5,-23.95,frameMat);
  for (let x = -65; x < 62; x += 14) for (let z = -112; z < -29; z += 17) {
    box(2, .9, 5, x, 28, z, white); box(1.6, .12, 4.4, x, 28.5, z, frameMat);
  }
  for (const x of [-45, 32]) { box(9, 6, .2, x, 3, -23.8, frameMat); box(10, .35, 2, x, 6.2, -23, white); }
  box(96, 12, 22, -12, 6, -137, silver);
  createDesignCenter({scene,building:SMART_BUILDINGS[1],material,box,mesh,reflection,selectable,road,white,green});
  // Extend the campus boundary to include the western design centre.
  box(135,.16,12,-177,-.3,106,road);
  box(16,.16,150,-245,-.3,28,road);
  // Photovoltaic covered walkway separating office and factory.
  const solar = material(0x203a59, { metalness: .5, roughness: .3 });
  for (let x = -91; x < 99; x += 6) {
    box(.25, 4.7, .25, x, 2.35, -10, frameMat);
    box(5.8, .18, 6, x, 4.8, -10, solar);
    for (let i = -2; i <= 2; i++) box(.05, .03, 6, x + i, 4.91, -10, frameMat);
  }
  // East parking rows and the front entrance plaza.
  for (let z = -137; z < -20; z += 6) for (const x of [82, 96]) {
    box(4, .035, .12, x, -.3, z + 2.6, white);
    box(2.3, 1.2, 4.2, x, .5, z, white); box(1.9, .7, 2, x, 1.3, z, glass);
  }
  for (let x = -76; x < 78; x += 6) {
    box(2.8, .06, 15, x, .05, 76, white);
    if (Math.abs(x) > 17) box(4, .4, 3, x, .3, 89, green);
  }
  // Alternating triangular stone paving on the entrance axis.
  const pavingVertices=[];
  for(let x=-18;x<18;x+=3)for(let z=61;z<87;z+=3){
    const flip=(Math.round((x+18)/3)+Math.round((z-61)/3))%2;
    const triangle=flip?[[x,z],[x+3,z+3],[x,z+3]]:[[x,z],[x+3,z],[x+3,z+3]];
    triangle.reverse().forEach(([px,pz])=>pavingVertices.push(px,.12,pz));
  }
  const pavingGeo=new THREE.BufferGeometry();pavingGeo.setAttribute('position',new THREE.Float32BufferAttribute(pavingVertices,3));pavingGeo.computeVertexNormals();
  mesh(pavingGeo,material(0x747c80,{side:THREE.DoubleSide}));
  box(22, .15, 26, 0, .05, 93, silver);
  for (const x of [-40, 40]) { box(43, 2.5, 2.5, x, 1.3, 96, white); box(40, .2, 3.5, x, 2.7, 96, silver); }
  const leaves = new THREE.IcosahedronBufferGeometry(2.4, 1);
  for (let z = -145; z <= 90; z += 12) for (const x of [-100, 108]) {
    box(4.5, .3, 5, x, -.1, z, green); box(.35, 3, .35, x, 1.4, z, dark); mesh(leaves, green, x, 4, z);
  }
  for (let z = -150; z < 110; z += 10) for (const x of [-89, 72]) box(.18, .03, 4, x, -.3, z, white);
  for (let x = -100; x < 110; x += 10) box(4, .03, .2, x, -.3, 106, white);
  // Batch the glass lattice by material to keep draw calls low.
  for (const mat of new Set(beamMeshes.map(m => m.material))) {
    const parts = beamMeshes.filter(m => m.material === mat);
    parts.forEach(m => { m.updateMatrix(); m.geometry.applyMatrix4(m.matrix); scene.remove(m); });
    mesh(BufferGeometryUtils.mergeBufferGeometries(parts.map(m => m.geometry)), mat);
    parts.forEach(m => m.geometry.dispose());
  }
  // Batch static bars by material; keep shared materials for weather updates.
  const staticBoxes=scene.children.filter(o=>o.isMesh&&o.geometry===boxGeo&&!o.userData.building);
  for(const mat of new Set(staticBoxes.map(m=>m.material))){
    const parts=staticBoxes.filter(m=>m.material===mat);
    const geometries=parts.map(m=>{m.updateMatrix();scene.remove(m);return boxGeo.clone().applyMatrix4(m.matrix);});
    mesh(BufferGeometryUtils.mergeBufferGeometries(geometries),mat);
    geometries.forEach(g=>g.dispose());
  }
  const particlePositions = new Float32Array(1800);
  for (let i = 0; i < particlePositions.length; i += 3) { particlePositions[i] = Math.random() * 260 - 130; particlePositions[i + 1] = Math.random() * 150; particlePositions[i + 2] = Math.random() * 300 - 170; }
  const particleGeo = new THREE.BufferGeometry(); particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const precipitation = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: 0xdcefff, size: .55, transparent: true, opacity: .7 })); scene.add(precipitation);
  let weather = 'sunny', paused = false, disposed = false, frame, fly, last = performance.now(), statsAt = last, frames = 0, labelsAt = 0;
  function applyStudio() {
    if (studio) groundMat.color.set(studioGround).convertSRGBToLinear(); else groundMat.color.copy(groundBase);
    environment(weather, currentHour);
  }
  function environment(value = 'sunny', hour = 14) {
    currentHour = hour;
    weather = value; const night = hour < 6 || hour > 19;
    scene.background = new THREE.Color(studio ? studioSky : night ? pick('skyNight', 0x091525) : value === 'sunny' ? pick('skyDay', 0xa8c6dc) : 0x899ba9);
    scene.fog = new THREE.FogExp2(scene.background, value === 'fog' ? .007 : .0009);
    sun.intensity = night ? .15 : value === 'sunny' ? 2.4 : .9; ambient.intensity = night ? .5 : 1.3;
    sun.position.set(Math.cos(hour / 24 * Math.PI * 2) * 160, 80 + Math.sin(hour / 24 * Math.PI) * 120, 100);
    glass.emissiveIntensity = night ? 1.7 : .15; facadeGlass.emissiveIntensity=night?.35:0; precipitation.visible = value === 'rain' || value === 'snow'; precipitation.material.size = value === 'snow' ? 1.1 : .45;
    road.roughness = value === 'rain' ? .2 : .9;
  }
  function reset() { fly = { position: home.clone(), target: target.clone() }; controls.autoRotate = false; }
  function focus(id) { const b = SMART_BUILDINGS.find(b => b.id === id); if (!b) return; fly = { position: new THREE.Vector3(b.x + 110, b.h + 90, b.z + 160), target: new THREE.Vector3(b.x, b.h / 2, b.z) }; controls.autoRotate = false; callbacks.onSelect?.(b); }
  let down;
  const onDown = e => { down = [e.clientX, e.clientY]; fly = null; };
  const onUp = e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = ray.intersectObjects(selectable)[0]; if (hit) focus(hit.object.userData.building.id);
  };
  renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp);
  const resize = () => { const w = container.clientWidth, h = Math.max(1, container.clientHeight); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  camera.position.copy(home); controls.target.copy(target); controls.update(); environment();
  function snapshots() {
    const position = camera.position.clone(), images = [];
    for (const v of [[100, 60, 140], [-110, 100, 80]]) { camera.position.set(...v); camera.lookAt(0, 10, 10); renderer.render(scene, camera); const c = document.createElement('canvas'); c.width = 480; c.height = 270; c.getContext('2d').drawImage(renderer.domElement, 0, 0, 480, 270); images.push(c.toDataURL('image/jpeg', .82)); }
    camera.position.copy(position); camera.lookAt(controls.target); renderer.render(scene, camera); callbacks.onSnapshots?.(images);
  }
  function animate(now) {
    if (disposed) return; frame = requestAnimationFrame(animate); const dt = Math.min((now - last) / 1000, .05); last = now; if (paused) return;
    if (fly) { camera.position.lerp(fly.position, .05); controls.target.lerp(fly.target, .05); if (camera.position.distanceTo(fly.position) < .1) fly = null; }
    if (precipitation.visible) { for (let i = 1; i < particlePositions.length; i += 3) { particlePositions[i] -= dt * (weather === 'snow' ? 5 : 65); if (particlePositions[i] < 0) particlePositions[i] = 150; } particleGeo.attributes.position.needsUpdate = true; }
    controls.update(); renderer.render(scene, camera);
    if (now - labelsAt > 60) { labelsAt = now; callbacks.onLabels?.(SMART_BUILDINGS.map(b => { const p = new THREE.Vector3(b.x, b.h + 8, b.z).project(camera); return { id: b.id, x: (p.x * .5 + .5) * container.clientWidth, y: (-p.y * .5 + .5) * container.clientHeight, visible: p.z > -1 && p.z < 1 }; })); }
    frames++; if (now - statsAt > 1200) { callbacks.onStats?.(Math.round(frames * 1000 / (now - statsAt))); frames = 0; statsAt = now; }
  }
  animate(last); const snapshotTimer = setTimeout(snapshots, 500);
  return {
    environment, focus, reset, snapshots, pause(value) { paused = value; frames = 0; statsAt = performance.now(); },
    orbit(value) { controls.autoRotate = value; fly = null; },
    studio(value) { studio = Boolean(value); applyStudio(); }, top() { controls.autoRotate = false; fly = { position: new THREE.Vector3(-65, 470, -9), target: target.clone() }; },
    // 不带参数就是「现在相机在哪」，带参数就平滑飞过去。演示模式每一页的视角靠它。
    view(state) {
      if (!state) return { camera: camera.position.toArray(), target: controls.target.toArray() };
      const p = state.position, t = state.target;
      if (!Array.isArray(p) || p.length < 3) return undefined;
      const target3 = Array.isArray(t) && t.length >= 3 ? new THREE.Vector3(t[0], t[1], t[2]) : controls.target.clone();
      controls.autoRotate = false;
      fly = { position: new THREE.Vector3(p[0], p[1], p[2]), target: target3 };
      return undefined;
    },
    dispose() { disposed = true; cancelAnimationFrame(frame); clearTimeout(snapshotTimer); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); const resources = new Set(); scene.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => resources.add(m)); }); resources.add(reflection);resources.add(facadeTexture);resources.forEach(r => r.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}

