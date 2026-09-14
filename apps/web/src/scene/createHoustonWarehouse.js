import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HOUSTON as C, ZONES, SERVICE_CORE as U } from '../sites/houston/modelConfig.js';

/** CAD-based, metre-scale scene. Repeated components are instanced by layer/material. */
export function createHoustonWarehouse(container, { emit = () => {}, theme } = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.dataset.scene = 'houston';
  const camera = new THREE.PerspectiveCamera(38, 1, .15, 1800);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 780;
  controls.maxPolarAngle = Math.PI * .495; controls.autoRotateSpeed = .4;
  const sun = new THREE.DirectionalLight(0xfff4e5, 1.1); sun.position.set(-110, 180, -70);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 170, bottom: -170, near: 1, far: 500 });
  sun.shadow.bias = -.00025; sun.shadow.normalBias = .03;
  const ambient = new THREE.HemisphereLight(0xf3f7ff, 0xa0a0a0, .95); scene.add(sun, ambient);
  const groups = {};
  for (const name of ['site','roof','structure','racks','cargo','vehicles','labels','utilities','utilityRoof','utilityLabels']) { groups[name]=new THREE.Group(); groups[name].name=name; scene.add(groups[name]); }
  const mats = {};
  function mat(name, color, extra={}) {
    const m = new THREE.MeshStandardMaterial({color,roughness:.83,...extra});
    m.color.convertSRGBToLinear(); mats[name]=m; return m;
  }
  mat('white',0xf4f4f0); mat('wall',0xd9ddd9); mat('seam',0xb6bcb9); mat('roof',0xe5e9e8);
  mat('glass',0x405d68,{metalness:.45,roughness:.25}); mat('concrete',0xd5d9d9); mat('road',0x9ea9b1);
  mat('ground',0xebeeee); mat('green',0xa8bd98); mat('tree',0x8cab83); mat('trunk',0x969180);
  mat('steel',0x49565b,{metalness:.35}); mat('rack',0x286954,{metalness:.2}); mat('orange',0xef762e);
  mat('yellow',0xf1bf32); mat('carton',0xbda580); mat('carton2',0xd4bb93); mat('pallet',0xa58661);
  mat('dark',0x35424d); mat('blue',0x608da4); mat('red',0xba6556); mat('line',0xfafaf5);
  const cube = new THREE.BoxBufferGeometry(1,1,1), batches = new Map(), temp = new THREE.Object3D();
  function box(layer, material, x,y,z,w,h,d,rotation=0) {
    const key=layer+':'+material;
    if(!batches.has(key)) batches.set(key,[]);
    temp.position.set(x,y,z); temp.scale.set(w,h,d); temp.rotation.set(0,rotation,0); temp.updateMatrix();
    batches.get(key).push(temp.matrix.clone());
  }
  function beam(layer, material, a,b,width=.1) {
    const key=layer+':'+material;
    if(!batches.has(key)) batches.set(key,[]);
    const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), delta=end.clone().sub(start);
    temp.position.copy(start).add(end).multiplyScalar(.5); temp.scale.set(width,delta.length(),width);
    temp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); temp.updateMatrix();
    batches.get(key).push(temp.matrix.clone());
  }
  const textures = [], geometries = new Set([cube]);
  function sign(text,x,y,z,width,layer='labels',color='#586670',flat=false) {
    const c=document.createElement('canvas'); c.width=1024; c.height=128;
    const ctx=c.getContext('2d'); ctx.fillStyle=color; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='500 62px Arial'; ctx.fillText(text,512,64);
    const texture=new THREE.CanvasTexture(c); texture.encoding=THREE.sRGBEncoding; textures.push(texture);
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    mats['sign'+textures.length]=material;
    const geometry=new THREE.PlaneBufferGeometry(width,width/8); geometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); if(flat) mesh.rotation.x=-Math.PI/2;
    groups[layer].add(mesh); return mesh;
  }
  const W=C.width,D=C.depth,H=C.height;
  // The four corner returns extend beyond the main rectangle in the site plan.
  box('site','ground',0,-1.2,0,1300,1,1300);
  box('site','white',15,-.6,0,343,.9,283);
  box('site','road',15,-.11,0,337,.12,277);
  box('site','concrete',0,0,0,W+6,.18,D+2*C.court);
  box('site','white',0,.65,0,W,1.3,D);
  box('site','concrete',0,1.32,0,W,.1,D);
  for(const s of [-1,1]) {
    box('site','green',s*(W/2+2.2),.13,0,2.8,.2,D+25);
    for(const end of [-1,1]) box('site','white',s*(W/2-8.5),.7,end*(D/2+8),17,1.4,16);
    // Concrete panel seams on short sides.
    box('roof','wall',s*W/2,H/2+1.4,0,.32,H,D+30);
    for(let z=-D/2-14;z<D/2+15;z+=7.6) box('roof','seam',s*(W/2+.18),H/2+1.4,z,.04,H,.035);
    for(const y of [4.5,9.5,12.5]) box('roof','seam',s*(W/2+.2),y,0,.035,.045,D+30);
    for(const end of [-1,1]) {
      const x=s*(W/2-8.5),z=end*(D/2+8);
      box('roof','wall',x,8.5,z,17,14.2,16);
      box('roof','white',s*(W/2+.28),8.7,z+end*5,1,15,3);
      box('roof','glass',s*(W/2+.55),6.7,z+end*2,.12,10,4.2);
      for(let y=2;y<12;y+=2) box('roof','white',s*(W/2+.64),y,z+end*2,.14,.1,4.3);
      box('roof','glass',s*(W/2+.55),3,z-end*4,.12,2.2,5.5);
      box('roof','glass',x,3,end*(D/2+16.1),9,2.3,.12);
      box('roof','white',x,H+2,z,17.5,.32,16.5);
      box('site','concrete',s*(W/2+3),.8,z,5,1.4,10);
      for(let i=0;i<6;i++) box('site','white',s*(W/2+6+i*.4),.1+(6-i)*.11,z,1,(6-i)*.22,4);
      for(const dz of [-4,4]) {
        beam('site','steel',[s*(W/2+1),2,z+dz],[s*(W/2+5),2,z+dz],.07);
        for(let j=1;j<6;j+=2) beam('site','steel',[s*(W/2+j),.8,z+dz],[s*(W/2+j),2,z+dz],.06);
      }
    }
    // Long elevations: separated wall piers leave actual dock openings.
    const start=-W/2+18,finish=W/2-18, bays=38, pitch=(finish-start)/bays;
    box('roof','wall',0,10,s*D/2,W-34,8.4,.32);
    box('roof','white',0,H+1.55,s*D/2,W,.4,.65);
    for(let i=0;i<=bays;i++) {
      const x=start+i*pitch;
      const servicePier=s<0&&x>=U.x0-1&&x<=U.x1+1;
      if(!servicePier)box('roof','wall',x,3.55,s*D/2,pitch-2.8,4.4,.32);
      if(i===bays) continue;
      const dx=x+pitch/2;
      // The service core replaces these dock bays, including doors, bumpers and bollards.
      if(s<0&&dx+1.8>U.x0&&dx-1.8<U.x1)continue;
      const raised=s<0&&i>=16&&i<=24;
      box('roof','dark',dx,raised?5:3.2,s*(D/2+.2),3.05,raised?1.2:3.7,.3);
      box('roof','seam',dx,raised?5:3.2,s*(D/2+.4),2.58,raised?1.1:3.25,.12);
      for(let y=raised?4.55:1.8;y<(raised?5.5:4.8);y+=.43) box('roof','white',dx,y,s*(D/2+.49),2.55,.035,.05);
      // Interior receiving view has a partially raised door.
      box('structure','seam',dx,5,s*(D/2-.25),2.7,1.2,.18);
      for(const q of [-1,1]) box('site','yellow',dx+q*1.72,1.08,s*(D/2+1.1),.17,2,.17);
      box('site','dark',dx,1.05,s*(D/2+.2),2.5,.25,.6);
      if(i%3===0) box('roof','glass',dx,8,s*(D/2+.21),1.5,2.3,.05);
      if(i%4===0) sign(String(i+1).padStart(2,'0'),dx,5.6,s*(D/2+.45),2,'roof','#69787e');
    }
  }
  // Roof cassette, parapets, subtle ribs and rooftop plant.
  box('roof','roof',0,H+1.25,0,W,.24,D);
  for(let x=-W/2+4;x<W/2;x+=8.5) box('roof','white',x,H+1.41,0,.09,.07,D);
  for(let z=-D/2+16;z<D/2;z+=32) box('roof','white',0,H+1.5,z,W,.16,.26);
  for(let x=-78;x<=78;x+=39) for(const z of [-32,32]) {
    box('roof','seam',x,H+1.9,z,4.1,.7,2.4); box('roof','white',x,H+2.33,z,4.4,.2,2.7);
  }
  sign('BUILDING 6',0,H+1.62,7,55,'roof','#8b989e',true);
  sign('HOUSTON  /  LOGISTICS',0,H+1.62,15,40,'roof','#a5afb3',true);
  // C-zone service core: persistent partitions remain when the warehouse shell is hidden.
  const uw=U.x1-U.x0,ux=(U.x0+U.x1)/2,front=U.wallZ+U.insideDepth;
  const roomZ=(U.wallZ+front)/2,top=U.floorY+U.height;
  const elecX=(U.partitionX+U.x1)/2,pumpX=(U.x0+U.partitionX)/2;
  box('utilities','concrete',ux,U.floorY,roomZ,uw,.15,U.insideDepth);
  box('utilities','wall',ux,U.floorY+U.height/2,U.wallZ,uw,U.height,.25);
  box('roof','wall',ux,5.5,U.wallZ,uw+.4,.6,.32);
  for(const x of [U.x0,U.partitionX,U.x1]) box('utilities','wall',x,U.floorY+U.height/2,roomZ,.2,U.height,U.insideDepth);
  // Front walls use real openings; door leaves are slightly ajar to reveal the rooms.
  for(const [left,right,cx,name] of [[U.x0,U.partitionX,pumpX,'PUMP ROOM'],[U.partitionX,U.x1,elecX,'ELEC ROOM']]) {
    const doorWidth=1.1,pier=(right-left-doorWidth)/2;
    box('utilities','wall',left+pier/2,U.floorY+U.height/2,front,pier,U.height,.22);
    box('utilities','wall',right-pier/2,U.floorY+U.height/2,front,pier,U.height,.22);
    box('utilities','wall',cx,top-.6,front,doorWidth,1.2,.22);
    box('utilities','blue',cx-.15,U.floorY+1.25,front+.26,1.05,2.5,.08,-.38);
    box('utilities','steel',cx+.2,U.floorY+1.15,front+.5,.07,.22,.06);
    sign(name,cx,top-.56,front+.13,right-left-.25,'utilities','#516772');
    sign(name,cx,U.floorY+.1,roomZ,right-left-.4,'utilities','#ac743f',true);
  }
  box('utilityRoof','roof',ux,top+.12,roomZ,uw+.3,.24,U.insideDepth+.25);
  // Switchboards inside ELEC ROOM (schematic cabinet count, not an equipment schedule).
  for(let i=0;i<4;i++) {
    const z=U.wallZ+1.2+i*1.25;
    box('utilities','seam',U.x1-.55,U.floorY+1.05,z,.75,2.1,1.05);
    box('utilities','dark',U.x1-.94,U.floorY+1.5,z,.025,.32,.45);
    box('utilities','yellow',U.x1-.96,U.floorY+.92,z,.02,.18,.18);
  }
  // BREAK TANK is drawn within the neighboring pump room in the supplied CAD.
  const tankGeo=new THREE.CylinderBufferGeometry(1.15,1.15,1.6,24);geometries.add(tankGeo);
  // r115 also caches the instancing shader variant per material: the standalone
  // tank must not share its material with the instanced wall/cabinet batches.
  const tank=new THREE.Mesh(tankGeo,mat('tank',0xb6bcb9));tank.position.set(pumpX,U.floorY+.8,front-1.65);tank.castShadow=true;groups.utilities.add(tank);
  box('utilities','blue',pumpX,U.floorY+.5,U.wallZ+2,1.1,1,1.5);
  beam('utilities','red',[pumpX,2.4,U.wallZ+2],[pumpX,2.4,front-1.6],.14);
  // External equipment pad and service stair, as shown outside wall A.
  const padZ=U.wallZ-U.outsideDepth/2;
  box('utilities','concrete',ux,.7,padZ,uw,1.4,U.outsideDepth);
  box('utilities','seam',ux,2.15,padZ,3.8,1.4,3.6);
  box('utilities','white',ux,2.9,padZ,4.05,.12,3.85);
  for(let z=padZ-1.4;z<padZ+1.5;z+=.3)box('utilities','steel',ux,2.98,z,2.8,.04,.12);
  for(const x of [U.x0,U.x1]) {
    beam('utilities','steel',[x,2.45,U.wallZ-.5],[x,2.45,U.wallZ-U.outsideDepth],.065);
    for(let z=U.wallZ-1;z>U.wallZ-U.outsideDepth;z-=1.5)beam('utilities','steel',[x,1.4,z],[x,2.45,z],.06);
  }
  for(let i=0;i<7;i++)box('utilities','white',U.x1-1,.1+(7-i)*.1,U.wallZ-U.outsideDepth-.2-i*.35,1.6,(7-i)*.2,.36);
  // Exterior access door and adjacent louver; door faces the service pad.
  box('utilities','blue',elecX,2.65,U.wallZ-.15,1.15,2.5,.06);
  box('utilities','steel',elecX-.4,2.5,U.wallZ-.2,.07,.2,.07);
  for(let y=2;y<3.4;y+=.16)box('utilities','steel',pumpX,y,U.wallZ-.15,1.3,.07,.1);
  sign('ELEC ROOM',elecX,4.62,U.wallZ-.17,3.8,'utilities','#516772').rotation.y=Math.PI;
  // A location label stays readable at campus scale; geometry is still physically occluded.
  const utilityLabel=sign('ELEC ROOM',elecX,H+4,U.wallZ-1,17,'utilityLabels','#b2763c');
  utilityLabel.material.depthTest=false;utilityLabel.renderOrder=5;
  // 56 ft column grid across the long axis; 60 ft end bays / 50 ft typical bays.
  const columnZ=[-64.008,-45.72,-30.48,-15.24,0,15.24,30.48,45.72,64.008];
  for(let i=1;i<13;i++) for(const z of columnZ.slice(1,-1)) {
    const x=-W/2+i*56*.3048;
    box('structure','white',x,7,z,.28,11.4,.28); box('structure','yellow',x,2.6,z,.32,2.6,.32);
  }
  for(let x=-W/2+8.53;x<W/2;x+=8.53) {
    for(const y of [12.5,13.6]) beam('structure','steel',[x,y,-D/2],[x,y,D/2],.12);
    for(let z=-D/2;z<D/2;z+=4) beam('structure','steel',[x,12.5,z],[x,13.6,Math.min(z+4,D/2)],.07);
  }
  for(let z=-D/2;z<=D/2;z+=7.62) beam('structure','steel',[-W/2,13.5,z],[W/2,13.5,z],.1);
  for(let x=-90;x<=90;x+=17) for(let z=-46;z<=46;z+=15.24) box('structure','white',x,12.3,z,1.6,.12,.6);
  // Rack footprints follow A/B/C/D on cad.pdf; cross aisles are left open.
  function cargo(x,y,z,seed=0,layer='cargo') {
    box(layer,'pallet',x,y+.09,z,1,.18,1.12);
    const height=.65+(seed%4)*.14;
    box(layer,seed%2?'carton':'carton2',x,y+.18+height/2,z,.91,height,1);
    box(layer,'line',x,y+.28+height/2,z+.506,.25,.22,.008);
  }
  for(const zone of ZONES) {
    const pitch=(zone.x1-zone.x0)/zone.rows;
    for(let row=0;row<zone.rows;row++) {
      const x=zone.x0+pitch*(row+.5),length=zone.z1-zone.z0;
      const bays=Math.floor(length/2.8), step=length/bays;
      for(let bay=0;bay<bays;bay++) {
        const z=zone.z0+(bay+.5)*step;
        if(zone.id!=='C'&&((z>-15&&z<-11)||(z>14&&z<18)))continue;
        if(zone.id==='C'&&z>-30&&z<-27)continue;
        const rackW=zone.id==='C'?1.12:1.85;
        for(const side of [-1,1]) for(const end of [-1,1]) {
          box('racks','rack',x+side*rackW/2,5.55,z+end*step/2,.085,C.rackHeight,.085);
        }
        for(let l=0;l<zone.levels;l++) {
          const y=1.5+l*(C.rackHeight-.5)/zone.levels;
          for(const side of [-1,1]) box('racks','orange',x+side*rackW/2,y,z,.095,.15,step);
          box('racks','steel',x,y-.08,z,rackW,.04,step-.05);
          for(let q=0;q<2;q++) if((row*13+bay*7+l*3+q)%9>1) cargo(x,y+.08,z+(q-.5)*1.3,row+bay+l+q);
        }
        for(let y=1.6;y<9;y+=2) beam('racks','rack',[x-rackW/2,y,z-step/2],[x+rackW/2,y+1.8,z-step/2],.05);
      }
    }
    sign(zone.id+'  /  STORAGE',(zone.x0+zone.x1)/2,1.405,zone.z1+3,19,'labels','#b78b5f',true);
  }
  // Central floor storage, pick/pack workstations and conveyor from the CAD.
  for(let x=-18;x<54;x+=3.3) for(let z=-6;z<16;z+=3.2) cargo(x,1.4,z,Math.round(x+z+100));
  for(let x=-12;x<50;x+=12) for(let z=25;z<=37;z+=4) {
    box('racks','white',x,2.25,z,4,.15,1.2); box('racks','blue',x,1.8,z,3.6,.75,.8);
    box('racks','dark',x,2.7,z-.4,.6,.55,.1); cargo(x+1,2.33,z,1);
  }
  box('racks','steel',18,1.95,42,64,.25,1.2);
  for(let x=-14;x<50;x+=.65) box('racks','seam',x,2.1,42,.15,.05,1.05);
  sign('PICK  /  PACK',18,1.4,47,29,'labels','#ac805d',true);
  for(const s of [-1,1]) {
    for(let x=-100;x<102;x+=4) {
      if(s<0&&x>-10&&x<38)continue;
      for(let z=52;z<60;z+=3.1) cargo(x,1.4,s*z,Math.round(x+z+200));
    }
    box('site','yellow',0,1.395,s*49,W-8,.015,.1);
    sign(s<0?'RECEIVING  /  STAGING':'DISPATCH  /  STAGING',s<0?13:0,1.415,s<0?-51:s*57,42,'labels','#b68653',true);
  }
  for(const x of [12,16]) cargo(x,1.4,-55,Math.round(x));
  // 35/38 trailer spaces and 96/149 passenger spaces, plus the outlined future lot.
  function trailer(x,z,seed) {
    box('vehicles',seed%3===0?'blue':'white',x,2.4,z,2.55,2.7,13.6);
    box('vehicles','dark',x,1,z+3.7,2.75,.55,2.1);
    box('vehicles','dark',x,1,z-4.7,2.75,.55,1.4);
    box('vehicles','seam',x,3.82,z,2.6,.12,13.7);
  }
  for(const s of [-1,1]) {
    const n=s<0?C.parking.upperTrailers:C.parking.lowerTrailers, span=W-62, pitch=span/n;
    for(let i=0;i<=n;i++) box('site','line',-span/2+i*pitch,.14,s*(D/2+C.court-9),.1,.03,17);
    box('site','line',0,.14,s*(D/2+C.court-.5),span,.03,.1);
    for(let i=0;i<n;i++) if(i%5===1||i%7===2) trailer(-span/2+(i+.5)*pitch,s*(D/2+C.court-8.5),i);
    for(let i=0;i<9;i++) {
      const x=-76+i*19;
      if(s<0&&x+1.4>U.x0-1&&x-1.4<U.x1+1)continue;
      trailer(x,s*(D/2+9.3),i+1);
    }
    sign(n+' TRAILER PARKS',0,.17,s*99,44,'site','#f8faf9',true);
    box('site','red',0,.15,s*126,285,.025,.14);
  }
  function car(x,z,seed,rotation=0) {
    box('vehicles',['white','blue','dark','red'][seed%4],x,.85,z,1.8,1.15,4.3,rotation);
    box('vehicles','glass',x,1.6,z,1.48,.55,2.25,rotation);
  }
  function parkingRow(x,start,count,pitch,future=false) {
    for(let i=0;i<=count;i++) box('site',future?'seam':'line',x,.14,start+i*pitch,5.4,.03,.08);
    if(!future)for(let i=0;i<count;i++)if(i%5===0||i%9===3) car(x,start+(i+.5)*pitch,i,Math.PI/2);
  }
  parkingRow(-W/2-7,-68,48,2.85);parkingRow(-W/2-24,-68,48,2.85);
  parkingRow(W/2+7,-101,75,2.7);parkingRow(W/2+24,-101,74,2.7);
  box('site','ground',W/2+44,.02,0,19,.08,214);
  parkingRow(W/2+38,-102,76,2.7,true);parkingRow(W/2+49,-102,75,2.7,true);
  sign('FUTURE PARKING',W/2+44,.17,0,35,'site','#99a4a8',true).rotation.z=Math.PI/2;
  // Quiet landscaping on the boundary, with faceted trees.
  const treeGeo=new THREE.IcosahedronBufferGeometry(1,1); geometries.add(treeGeo);
  for(const s of [-1,1]) for(let i=0;i<14;i++) {
    const x=-137+i*22,z=s*132;
    box('site','green',x,.06,z,12,.2,4.2); box('site','trunk',x,1.25,z,.24,2.4,.24);
    const tree=new THREE.Mesh(treeGeo,mats.tree);tree.position.set(x,3.3,z);tree.scale.set(1.7,2.4,1.7);tree.castShadow=true;groups.site.add(tree);
  }
  // Commit all repeat geometry into a small number of GPU draws.
  for(const [key,matrices] of batches) {
    // r115 caches vertex bindings by geometry/program. Separate geometry IDs prevent
    // batches with the same shader from reusing another batch's instance matrices.
    const [layer,material]=key.split(':'), geometry=cube.clone(); geometries.add(geometry);
    const mesh=new THREE.InstancedMesh(geometry,mats[material],matrices.length);
    matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.castShadow=!['line','seam','ground'].includes(material);mesh.receiveShadow=true;mesh.frustumCulled=false;
    groups[layer].add(mesh);
  }
  batches.clear();
  const states={roof:true,structure:true,racks:true,cargo:true,vehicles:true};
  let modeId='overview',paused=false,disposed=false,frame=0,studio=false,currentHour=14,weather='sunny';
  let desiredPosition=null,desiredTarget=null;
  const home=[330,320,400];
  function fly(position,target=[5,0,0]) { controls.autoRotate=false;desiredPosition=new THREE.Vector3(...position);desiredTarget=new THREE.Vector3(...target); }
  function layersChanged(){Object.keys(states).forEach(key=>{groups[key].visible=states[key];});groups.utilityRoof.visible=states.roof;utilityLabel.position.y=states.roof?H+4:top+2;emit('layers',{...states});}
  function setMode(id) {
    if(!['overview','interior','racks','receiving'].includes(id))return;
    modeId=id;states.roof=id!=='interior';states.structure=id!=='interior';layersChanged();
    groups.labels.visible=id==='overview'||id==='interior';
    groups.utilityLabels.visible=id==='overview'||id==='interior';
    if(id==='overview')fly(home);
    if(id==='interior')fly([210,255,285],[0,0,0]);
    if(id==='racks')fly([-100.4,4.2,24],[-100.4,4,-8]);
    if(id==='receiving')fly([32,6.7,-49],[2,4.3,-61]);
    renderer.domElement.dataset.mode=id;emit('mode',id);
  }
  function setEnvironment(nextWeather=weather,hour=currentHour) {
    weather=nextWeather;currentHour=hour;
    const night=hour<6||hour>19;
    const light=theme?.id==='light-orange';
    const color=studio?0xffffff:night?0x344351:light?0xeff2f3:0xb8c5cc;
    scene.background=new THREE.Color(color);
    scene.fog=new THREE.Fog(color,weather==='fog'?180:600,weather==='fog'?650:1500);
    sun.intensity=night?.25:weather==='sunny'?1.1:.65;ambient.intensity=night?.65:.95;
  }
  function resize(){const w=container.clientWidth||1,h=container.clientHeight||1;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  camera.position.fromArray(home);controls.target.set(5,0,0);controls.update();setEnvironment();
  renderer.domElement.dataset.mode=modeId;
  function cancelFlight(){desiredPosition=null;desiredTarget=null;}
  controls.addEventListener('start',cancelFlight);
  let lastStats=performance.now(),frames=0;
  function draw(now) {
    if(disposed)return;frame=requestAnimationFrame(draw);if(paused)return;
    if(desiredPosition) {
      camera.position.lerp(desiredPosition,.1);controls.target.lerp(desiredTarget,.1);
      if(camera.position.distanceTo(desiredPosition)<.02){camera.position.copy(desiredPosition);controls.target.copy(desiredTarget);cancelFlight();}
    }
    controls.update();utilityLabel.quaternion.copy(camera.quaternion);renderer.render(scene,camera);frames++;
    if(now-lastStats>800) {emit('stats',Math.round(frames*1000/(now-lastStats)));frames=0;lastStats=now;}
  }
  frame=requestAnimationFrame(draw);
  return {
    mode(id){if(id)setMode(id);return modeId;},
    layer(id,value){if(id in states&&typeof value==='boolean'){states[id]=value;layersChanged();}return {...states};},
    focus(id){
      if(id==='elec-interior'||id==='elec-exterior') {
        const outside=id==='elec-exterior';setMode(outside?'overview':'interior');
        groups.utilityLabels.visible=false;
        fly(outside?[ux+19,18,U.wallZ-26]:[ux-10,29,front+13],[ux,2.5,outside?padZ:roomZ]);
        return;
      }
      const zone=ZONES.find(z=>z.id===id);if(zone){setMode('interior');const x=(zone.x0+zone.x1)/2,z=(zone.z0+zone.z1)/2;fly([x+32,60,z+65],[x,0,z]);}else setMode('overview');
    },
    reset(){setMode('overview');},top(){setMode('interior');fly([0,335,.1],[0,0,0]);},
    orbit(value){cancelFlight();controls.autoRotate=value;},pause(value){paused=value;},
    studio(value){studio=value;setEnvironment();},environment:setEnvironment,
    view(value){if(value?.position){fly(value.position,value.target||[0,0,0]);}return {position:camera.position.toArray(),target:controls.target.toArray()};},
    labels(){return [];},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('start',cancelFlight);controls.dispose();
      geometries.forEach(g=>g.dispose());Object.values(mats).forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();},
  };
}
