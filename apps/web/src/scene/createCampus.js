import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Architectural study based on the supplied reference; all geometry is generated locally.
export const BUILDINGS = [
  { id:'A', name:'A 座 · 吉利总部', x:32, z:10, w:31, d:29, h:140, floors:40, area:'58,620', people:138, equipment:426 },
  { id:'B', name:'B 座 · 研发中心', x:-10, z:-15, w:27, d:27, h:124, floors:40, area:'54,280', people:107, equipment:382 },
  { id:'C', name:'C 座 · 创新中心', x:-50, z:-15, w:24, d:25, h:104, floors:40, area:'42,092', people:64, equipment:216 },
];

export function createCampus(container, callbacks = {}, options = {}) {
  let seed=7812;
  const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const scene=new THREE.Scene();
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));
  renderer.setSize(container.clientWidth,container.clientHeight);
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.85;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(43,container.clientWidth/container.clientHeight,1,2200);
  const home=new THREE.Vector3(90,128,272);
  const homeTarget=new THREE.Vector3(-8,56,0);
  camera.position.copy(home);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.copy(homeTarget);controls.enableDamping=true;controls.dampingFactor=.065;
  controls.minDistance=45;controls.maxDistance=430;controls.maxPolarAngle=Math.PI*.485;
  controls.autoRotateSpeed=.45;
  controls.update();
  const hemi=new THREE.HemisphereLight(0xdcefff,0x576350,.95);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffefd2,2.6);sun.position.set(-110,170,100);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-160,right:160,top:160,bottom:-160,near:1,far:500});
  sun.shadow.bias=-.0004;sun.shadow.normalBias=.1;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xa8ceff,.3);fill.position.set(100,90,-120);scene.add(fill);
  scene.fog=new THREE.FogExp2(0x9fb8ce,.00165);
  const disposables=new Set(); const litMaterials=[]; const nightLights=[];
  // 主题调色板：只覆盖它关心的项，没写的用下面的默认值
  const p = options.palette || {};
  const pick = (key, fallback) => (p[key] === undefined ? fallback : p[key]);
  const mat=(color,roughness=.8,extra={})=>{const material=new THREE.MeshStandardMaterial({color,roughness,...extra});material.color.convertSRGBToLinear();return material;};
  const concrete=mat(pick('concrete',0xb9bcba)),curb=mat(pick('curb',0xd2d0c8)),asphalt=mat(pick('asphalt',0x414a50)),dark=mat(pick('dark',0x222c36)),white=mat(pick('white',0xdce4e7));
  const lawn=mat(pick('lawn',0x587340)),soil=mat(pick('soil',0x384632)),wood=mat(pick('wood',0x9a7960)),metal=mat(pick('metal',0x536371),.35,{metalness:.7});
  // 外立面是 canvas 画的贴图，它的颜色也得能跟着主题走，否则换浅色主题时楼还是深色
  const facadeBase=pick('facadeBase','#5c7788'),facadeNightBase=pick('facadeNightBase','#050608');
  const facadeLit=pick('facadeLit','#efd8a0'),facadeOff=pick('facadeOff','#020304');
  const facadeMullion=pick('facadeMullion','rgba(184,207,218,.44)'),facadeShadow=pick('facadeShadow','rgba(15,29,38,.6)');
  const winBase=pick('facadeWindow',[39,57,70]),winRange=pick('facadeWindowRange',[27,30,34]);
  const boxGeometry=new THREE.BoxBufferGeometry(1,1,1);
  function box(w,h,d,x,y,z,material=concrete,parent=scene,shadow=true){
    const m=new THREE.Mesh(boxGeometry,material);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;
  }
  function instanceBoxes(items,material){
    const mesh=new THREE.InstancedMesh(boxGeometry,material,items.length);const temp=new THREE.Object3D();
    items.forEach((v,i)=>{temp.position.set(v[3],v[4],v[5]);temp.scale.set(v[0],v[1],v[2]);temp.rotation.set(0,v[6]||0,0);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);});
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  }
  // 「纯白背景」：给 PPT 展示用。开了之后天空是一块纯色、地面也刷成同一个色，
  // 远处的地平线就消失了，模型像摆在一块白板上。周边城市体块一并藏起来。
  const studioSky=pick('studioSky',0xffffff),studioGround=pick('studioGround',0xffffff);
  let studio=Boolean(options.studio);
  const cityGroup=new THREE.Group();scene.add(cityGroup);
  // Procedural cloud sky, shared with a hand-built reflection environment.
  const skyUniforms={time:{value:0},cloud:{value:.43},night:{value:0},dusk:{value:0},flatMix:{value:0},flatColor:{value:new THREE.Color(studioSky)}};
  const sky=new THREE.Mesh(new THREE.SphereBufferGeometry(1100,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
    vertexShader:'varying vec3 vWorld; void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vWorld; uniform float time; uniform float cloud; uniform float night; uniform float dusk; uniform float flatMix; uniform vec3 flatColor;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.;float a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+13.5;a*=.5;}return v;}
      void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 color=mix(vec3(.72,.81,.87),vec3(.16,.39,.66),pow(h,.45));
      color=mix(color,mix(vec3(.91,.59,.39),vec3(.29,.33,.54),pow(h,.4)),dusk*.82);
      vec2 uv=d.xz/(max(d.y,.06)+.24)*2.6+vec2(time*.004,0.);float n=fbm(uv);float c=smoothstep(.68-cloud*.42,.79-cloud*.33,n)*smoothstep(-.02,.16,d.y);
      color=mix(color,mix(vec3(.69,.76,.8),vec3(1.),smoothstep(.4,.8,n)),c*.93);
      color=mix(color,vec3(.016,.033,.085)+h*.02,night*.98);
      float star=step(.9978,hash(floor(d.xz/(d.y+.2)*850.)))*smoothstep(.1,.5,h);color+=star*night*.7;
      color=mix(color,flatColor,flatMix);
      gl_FragColor=vec4(color,1.);}`
  }));scene.add(sky);
  const faces=[];
  for(let side=0;side<6;side++){
    const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,512);g.addColorStop(0,pick('envSkyTop','#688cba'));g.addColorStop(.48,pick('envSkyMid','#a5c3d7'));g.addColorStop(.65,pick('envSkyLow','#dae0df'));g.addColorStop(1,pick('envGround','#697168'));ctx.fillStyle=g;ctx.fillRect(0,0,512,512);
    for(let i=0;i<32;i++){const x=random()*512,y=80+random()*180;const cg=ctx.createRadialGradient(x,y,1,x,y,25+random()*65);cg.addColorStop(0,'rgba(255,255,255,.72)');cg.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=cg;ctx.fillRect(0,0,512,512);}
    for(let i=0;i<25;i++){ctx.fillStyle=`rgb(${95+i%4*9},${112+i%3*9},${125+i%4*6})`;const h=20+random()*100;ctx.fillRect(i*24,360-h,17+random()*20,h);}
    faces.push(c);
  }
  const env=new THREE.CubeTexture(faces);env.needsUpdate=true;env.encoding=THREE.sRGBEncoding;disposables.add(env);
  function facadeTexture(emissive=false){
    const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');
    ctx.fillStyle=emissive?facadeNightBase:facadeBase;ctx.fillRect(0,0,512,1024);
    for(let col=0;col<32;col++)for(let row=0;row<34;row++){
      const bright=random();
      ctx.fillStyle=emissive?(bright>.75?facadeLit:facadeOff):'rgb('+Math.round(winBase[0]+bright*winRange[0])+','+Math.round(winBase[1]+bright*winRange[1])+','+Math.round(winBase[2]+bright*winRange[2])+')';
      ctx.fillRect(col*16+2,row*30+2,12,27);
      if(!emissive){ctx.fillStyle=facadeMullion;ctx.fillRect(col*16,row*30,1.5,30);ctx.fillStyle=facadeShadow;ctx.fillRect(col*16,row*30+29,16,1);}
    }
    if(!emissive){
      const reflection=ctx.createLinearGradient(0,0,140,1024);reflection.addColorStop(0,'rgba(116,162,204,.18)');reflection.addColorStop(.48,'rgba(191,216,230,.08)');reflection.addColorStop(1,'rgba(3,15,24,.48)');ctx.fillStyle=reflection;ctx.fillRect(0,0,512,1024);
      for(let i=0;i<9;i++){const x=60+random()*430,y=250+random()*480,r=60+random()*90;const cloud=ctx.createRadialGradient(x,y,3,x,y,r);cloud.addColorStop(0,'rgba(184,210,226,.2)');cloud.addColorStop(1,'rgba(184,210,226,0)');ctx.fillStyle=cloud;ctx.fillRect(0,0,512,1024);}
    }
    const texture=new THREE.CanvasTexture(c);texture.encoding=THREE.sRGBEncoding;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);disposables.add(texture);return texture;
  }
  const facade=facadeTexture(),windows=facadeTexture(true);
  const glass=mat(pick('glass',0xb2c2cf),.21,{metalness:.82,map:facade,envMap:env,envMapIntensity:1.2,emissive:0xffda90,emissiveMap:windows,emissiveIntensity:.03});litMaterials.push(glass);
  const podiumGlass=glass.clone();podiumGlass.color.set(pick('podiumGlass',0xc3c9ce)).convertSRGBToLinear();podiumGlass.roughness=.29;litMaterials.push(podiumGlass);
  const trim=mat(pick('trim',0xb1bcc4),.32,{metalness:.8});
  const groundMaterial=mat(pick('ground',0x8c9991));
  const groundBase=groundMaterial.color.clone();
  box(1400,2,1400,0,-2,0,groundMaterial);
  box(145,1.2,118,-7,-.3,4,curb);
  // Perimeter roads, lane paint, crossings and pavements.
  box(950,.18,26,0,-.55,86,asphalt);box(26,.18,950,-96,-.54,0,asphalt);
  box(900,.18,22,0,-.54,-98,asphalt);box(22,.18,800,103,-.54,0,asphalt);
  const paint=[];
  for(let i=-440;i<440;i+=12){paint.push([6,.03,.23,i,-.42,85],[6,.03,.23,i,-.42,92],[6,.03,.23,i,-.42,79]);paint.push([.23,.03,6,-96,-.4,i],[.23,.03,6,-103,-.4,i],[.23,.03,6,-89,-.4,i]);}
  for(let i=0;i<10;i++){paint.push([2,.035,20,-78+i*3,-.39,86]);paint.push([20,.035,2,-96,-.38,52+i*3]);}
  instanceBoxes(paint,white);
  box(900,.05,.3,0,-.38,73,white);box(.3,.05,850,-83,-.38,0,white);
  box(900,.25,2,0,-.25,99,soil);box(3,.25,850,-110,-.25,0,soil);
  // Layered shared podium and terraces.
  box(116,11,79,-7,5.5,1,podiumGlass);
  box(119,.65,82,-7,11.2,1,curb);
  box(121,.6,84,-7,10.1,1,metal);
  box(118,.24,81,-7,11.67,1,mat(0xd1ccbe));
  box(24,7.9,1,-7,4,41.1,dark);box(28,.9,8,-7,8,44,metal);
  for(let i=0;i<7;i++) box(29+i*1.5,.24,1.2,-7,.12+i*.24,50-i*1.2,curb);
  const podiumFins=[];
  for(let x=-65;x<52;x+=2.6)podiumFins.push([.15,10,.2,x,5.8,40.7]);
  for(let z=-37;z<42;z+=2.6)podiumFins.push([.2,10,.15,51.2,5.8,z]);instanceBoxes(podiumFins,trim);
  const selectable=[];const buildingRefs=[];
  // Each tower is one merged geometry whose side faces carry per-floor slices of the
  // full-height facade texture, so it reads as one continuous curtain wall yet can still
  // be split into separate floor slabs by the explode animation.
  const plateMat=mat(0xc6cbc9,.92);
  const addTris=(arr,x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3,nx,ny,nz,vs,vt)=>{
    for(const [x,y,z,u,v] of [[x0,y0,z0,0,vs],[x1,y1,z1,1,vs],[x2,y2,z2,1,vt],[x0,y0,z0,0,vs],[x2,y2,z2,1,vt],[x3,y3,z3,0,vt]]){
      arr.pos.push(x,y,z);arr.nor.push(nx,ny,nz);arr.uv.push(u,v);
    }
  };
  function applyBuildingLift(ref){
    const arr=ref.geo.attributes.position.array;
    for(let f=0;f<ref.floors;f++){
      const dy=ref.cur[f];
      for(const [s,e] of ref.vRange[f])for(let i=s;i<e;i++)arr[i*3+1]=ref.basePos[i*3+1]+dy;
    }
    ref.geo.attributes.position.needsUpdate=true;
    ref.roof.forEach(r=>{r.mesh.position.y=r.y+ref.cur[r.floor];});
  }
  function sign(text,x,y,z,width){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#edf8ff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px Arial';ctx.fillText(text,512,64);
    const tex=new THREE.CanvasTexture(c);disposables.add(tex);const material=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
    const m=new THREE.Mesh(new THREE.PlaneBufferGeometry(width,width*160/1024),material);m.position.set(x,y,z);scene.add(m);return m;
  }
  BUILDINGS.forEach(b=>{
    const sf=b.h/b.floors,F=b.floors,w=b.w,d=b.d,y0=11.8,hw=w/2,hd=d/2;
    const arr={pos:[],nor:[],uv:[]},vRange=[];
    for(let f=0;f<F;f++){
      const yb=y0+f*sf,vt=yb+sf,vs=f/F,vEnd=(f+1)/F;
      addTris(arr,b.x-hw,yb,b.z+hd,b.x+hw,yb,b.z+hd,b.x+hw,vt,b.z+hd,b.x-hw,vt,b.z+hd,0,0,1,vs,vEnd);
      addTris(arr,b.x+hw,yb,b.z-hd,b.x-hw,yb,b.z-hd,b.x-hw,vt,b.z-hd,b.x+hw,vt,b.z-hd,0,0,-1,vs,vEnd);
      addTris(arr,b.x+hw,yb,b.z+hd,b.x+hw,yb,b.z-hd,b.x+hw,vt,b.z-hd,b.x+hw,vt,b.z+hd,1,0,0,vs,vEnd);
      addTris(arr,b.x-hw,yb,b.z-hd,b.x-hw,yb,b.z+hd,b.x-hw,vt,b.z+hd,b.x-hw,vt,b.z-hd,-1,0,0,vs,vEnd);
      vRange.push([[f*24,(f+1)*24],[F*24+f*12,F*24+(f+1)*12]]);
    }
    for(let f=0;f<F;f++){
      const yb=y0+f*sf,vt=yb+sf;
      addTris(arr,b.x-hw,vt,b.z-hd,b.x-hw,vt,b.z+hd,b.x+hw,vt,b.z+hd,b.x+hw,vt,b.z-hd,0,1,0,0,1);
      addTris(arr,b.x-hw,yb,b.z+hd,b.x-hw,yb,b.z-hd,b.x+hw,yb,b.z-hd,b.x+hw,yb,b.z+hd,0,-1,0,0,1);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(arr.pos),3));
    geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(arr.nor),3));
    geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(arr.uv),2));
    geo.addGroup(0,F*24,0);geo.addGroup(F*24,F*12,1);
    const wall=new THREE.Mesh(geo,[glass,plateMat]);
    wall.castShadow=true;wall.receiveShadow=true;scene.add(wall);
    wall.userData.building=b;wall.userData.isWall=true;selectable.push(wall);
    const ref={b,sf,floors:F,geo,basePos:geo.attributes.position.array.slice(),vRange,cur:new Float32Array(F),roof:[]};
    const top=F-1;
    ref.roof.push({mesh:box(b.w+.5,.8,b.d+.5,b.x,b.h+11.8,b.z,metal),y:b.h+11.8,floor:top});
    ref.roof.push({mesh:box(b.w-3,1,b.d-3,b.x,b.h+12.4,b.z,dark),y:b.h+12.4,floor:top});
    for(let i=0;i<3;i++)ref.roof.push({mesh:box(3,2.4,4,b.x-7+i*6,b.h+13,b.z,metal),y:b.h+13,floor:top});
    const signFloor=Math.min(top,Math.max(0,Math.round((b.h-8)/sf)));
    ref.roof.push({mesh:sign(b.id==='A'?'GEELY':b.id==='B'?'LYNK & CO':'吉 行',b.x,11.8+b.h-8,b.z+b.d/2+.45,b.w*.63),y:11.8+b.h-8,floor:signFloor});
    buildingRefs.push(ref);
  });
  // Roof landscaping: planted terraces, paths, pavilion, reflecting pool.
  const treePositions=[];
  const addTree=(x,y,z,size=1,tone=0)=>treePositions.push({x,y,z,size,tone});
  for(const [x,z,w,d] of [[-41,17,20,20],[-13,10,21,13],[-11,31,25,11],[27,33,26,8],[-46,-9,19,7]]){
    box(w+.5,.65,d+.5,x,12.15,z,curb);box(w,.35,d,x,12.58,z,lawn);
    for(let i=0;i<5;i++)addTree(x+(random()-.5)*(w-2),12.7,z+(random()-.5)*(d-2),.6+random()*.45,i%4===0?1:0);
  }
  box(18,.3,9,10,12.1,31,metal);const water=mat(0x528e9c,.09,{metalness:.75,envMap:env,envMapIntensity:1.3});box(17,.13,8,10,12.32,31,water);
  box(19,.25,8,-32,12.1,34,wood);
  for(let i=0;i<12;i++)box(.08,.05,8,-41+i*1.5,12.28,34,dark);
  box(22,5.8,10,-26,15,0,podiumGlass);box(24,.4,12,-26,18.1,0,lawn);
  for(let i=0;i<9;i++)box(.3,6,.3,-37+i*2.7,15,5.4,wood);
  for(let i=0;i<5;i++)box(24,.25,.25,-26,18.6,-5+i*2.7,wood);
  const benches=[];
  for(let i=0;i<7;i++){const x=-57+i*14;benches.push([4,.25,1.2,x,13,37],[.25,.85,1,x-1.4,12.55,37],[.25,.85,1,x+1.4,12.55,37]);}instanceBoxes(benches,wood);
  // Service equipment and railings.
  for(let i=0;i<6;i++){
    box(3.5,2,5,-61,13,-30+i*10,metal);
    const fan=new THREE.Mesh(new THREE.CylinderBufferGeometry(1.2,1.2,.12,12),dark);fan.position.set(-61,14.1,-30+i*10);scene.add(fan);
  }
  const railing=[];
  for(let x=-66;x<54;x+=3)railing.push([.09,1.2,.09,x,12.7,42]);
  railing.push([119,.09,.09,-7,13.3,42],[119,.09,.09,-7,12.7,42]);
  for(let z=-38;z<43;z+=3)railing.push([.09,1.2,.09,53,12.7,z]);railing.push([.09,.09,81,53,13.3,2]);instanceBoxes(railing,metal);
  // Campus plaza and street landscape.
  box(16,.25,128,-73,.48,5,mat(0xbdb8a6));box(18,.25,135,68,.48,0,curb);
  for(let i=0;i<18;i++){
    const z=-72+i*8;box(6,.3,5,-74,.65,z,soil);addTree(-74,.8,z,1.1+random()*.45);
    if(i<16){box(5,.3,5,67,.65,z,soil);addTree(67,.8,z,1+random()*.3);}
  }
  for(let i=0;i<26;i++){addTree(-117,.2,-130+i*12,1.4);addTree(-131,.2,-132+i*12,1.1);addTree(-145,.2,-127+i*12,1.25);}
  for(let i=0;i<26;i++){addTree(-140+i*13,.2,110,1.2);addTree(-145+i*13,.2,-80,1.3);}
  for(let i=0;i<9;i++){
    const disk=new THREE.Mesh(new THREE.CylinderBufferGeometry(5.5,5.5,.18,32),i%2?wood:curb);disk.position.set(-130,.03,-104+i*23);scene.add(disk);
    const inset=new THREE.Mesh(new THREE.CylinderBufferGeometry(3.4,3.4,.2,32),lawn);inset.position.copy(disk.position);inset.position.y=.15;scene.add(inset);
  }
  const trunkGeo=new THREE.CylinderBufferGeometry(.28,.43,4,6);const leafGeo=new THREE.IcosahedronBufferGeometry(2.7,2);
  const leafVertices=leafGeo.attributes.position.array;
  for(let i=0;i<leafVertices.length;i+=3){const wobble=.96+Math.sin(leafVertices[i]*4+leafVertices[i+1]*3+leafVertices[i+2]*6)*.1;leafVertices[i]*=wobble;leafVertices[i+1]*=wobble;leafVertices[i+2]*=wobble;}
  leafGeo.computeVertexNormals();
  const trunkMaterial=mat(0x685d46),leafMaterial=mat(0x4b6d32),autumnMaterial=mat(0x9e5f43);
  const trunks=new THREE.InstancedMesh(trunkGeo,trunkMaterial,treePositions.length);
  const leaves=new THREE.InstancedMesh(leafGeo,leafMaterial,treePositions.length*3);
  const autumn=new THREE.InstancedMesh(leafGeo,autumnMaterial,treePositions.filter(p=>p.tone===1).length*3);
  const obj=new THREE.Object3D();let autumnIndex=0;
  treePositions.forEach((p,i)=>{
    obj.position.set(p.x,p.y+1.7*p.size,p.z);obj.scale.set(p.size,p.size,p.size);obj.rotation.set(0,random()*6,0);obj.updateMatrix();trunks.setMatrixAt(i,obj.matrix);
    for(let j=0;j<3;j++){obj.position.set(p.x+(j===1?1.4:j===2?-1.3:0)*p.size,p.y+(j===0?5:3.9)*p.size,p.z+(j===1?.7:-.3)*p.size);obj.scale.set(p.size*(j===0?1:.8),p.size*.93,p.size);obj.updateMatrix();leaves.setMatrixAt(i*3+j,obj.matrix);if(p.tone===1)autumn.setMatrixAt(autumnIndex++,obj.matrix);}
  });trunks.castShadow=true;leaves.castShadow=true;leaves.receiveShadow=true;autumn.castShadow=true;scene.add(trunks,leaves,autumn);
  // Surrounding urban massing, individual window textures keep the distant city legible.
  const cityMaterials=[0x8d9a9f,0x9da5a6,0xb0b4b0,0x7f8e97].map(c=>mat(c,.6,{map:facade}));
  for(let i=0;i<75;i++){
    const x=(random()-.5)*1050,z=-150-random()*520,w=16+random()*44,d=18+random()*40,h=12+random()*76;
    box(w,h,d,x,h/2,z,cityMaterials[i%4],cityGroup);box(w+1,.8,d+1,x,h,z,concrete,cityGroup);
  }
  for(let i=0;i<12;i++){const x=145+random()*130,z=-50+random()*310,h=10+random()*32;box(25+random()*35,h,30+random()*30,x,h/2,z,cityMaterials[i%4],cityGroup);}
  // Entrance gate, bollards, flagpoles and parking bays.
  box(7,4,4,49,2,58,podiumGlass);box(8,.3,5,49,4.2,58,curb);
  for(let i=0;i<3;i++){
    box(.18,22,.18,45+i*3,11,48,metal);
    const flag=box(2.5,1.4,.06,46.2+i*3,20,48,mat(i===0?0xbe4140:0xe2e5e4));flag.rotation.y=-.3;
  }
  for(let i=0;i<12;i++)box(.45,.8,.45,-35+i*5,.4,60,i%2?dark:mat(0xd4ac58));
  const parking=[];for(let i=0;i<16;i++){parking.push([.1,.02,5.5,-62+i*4,.38,55]);}instanceBoxes(parking,white);
  const lightMat=new THREE.MeshStandardMaterial({color:0xe7f5ff,emissive:0xffd897,emissiveIntensity:.1});litMaterials.push(lightMat);
  const streetPoles=[];
  for(let i=0;i<16;i++){
    const x=-145+i*23;streetPoles.push([.15,9,.15,x,4.5,69],[2.7,.12,.12,x+1.2,8.8,69]);
    const lamp=box(1.3,.13,.5,x+2,8.7,69,lightMat);nightLights.push(lamp);
  }instanceBoxes(streetPoles,metal);
  const carBodyMaterials=[0xe9edec,0x334956,0x8499a2,0xc8cbd0,0x223340,0xb85b4e].map(c=>mat(c,.28,{metalness:.6,envMap:env}));
  const wheelGeo=new THREE.CylinderBufferGeometry(.56,.56,.32,8);const cars=[];
  function car(x,z,rotation=0,moving=false,index=0){
    const group=new THREE.Group();box(2.4,.9,4.6,0,1,0,carBodyMaterials[index%6],group);box(2,.7,2.5,0,1.7,-.3,glass,group);
    box(2.2,.13,.2,0,1.05,2.3,lightMat,group);
    for(const a of [-1,1])for(const b of [-1.4,1.4]){const wheel=new THREE.Mesh(wheelGeo,dark);wheel.rotation.z=Math.PI/2;wheel.position.set(a*1.13,.6,b);group.add(wheel);}
    group.position.set(x,0,z);group.rotation.y=rotation;scene.add(group);if(moving)cars.push({group,speed:7+random()*7,axis:Math.abs(rotation)>.5?'x':'z',sign:index%2?1:-1});
  }
  for(let i=0;i<12;i++)car(-59+i*8,55,0,false,i);
  for(let i=0;i<18;i++){const horizontal=i<10;car(horizontal?-240+i*53:-101+(i%2)*10,horizontal?81+(i%2)*10:-200+(i-10)*59,horizontal?(i%2?Math.PI/2:-Math.PI/2):(i%2?0:Math.PI),true,i);}
  // Selection outline is aligned with the actual tower geometry.
  const selection=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1,1,1)),new THREE.LineBasicMaterial({color:0x71e5ff,transparent:true,opacity:.9}));selection.visible=false;scene.add(selection);
  let weather='sunny',hour=14,frame,previous=performance.now(),elapsed=0,disposed=false,paused=false,fly=null,lastLabels=0,frames=0,fpsStart=performance.now();
  const count=2800,positions=new Float32Array(count*3);
  for(let i=0;i<count;i++){positions[i*3]=(random()-.5)*330;positions[i*3+1]=random()*170;positions[i*3+2]=(random()-.5)*330;}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const snowSprite=document.createElement('canvas');snowSprite.width=snowSprite.height=32;
  const snowContext=snowSprite.getContext('2d'),snowGradient=snowContext.createRadialGradient(16,16,1,16,16,16);snowGradient.addColorStop(0,'rgba(255,255,255,1)');snowGradient.addColorStop(.4,'rgba(255,255,255,.85)');snowGradient.addColorStop(1,'rgba(255,255,255,0)');snowContext.fillStyle=snowGradient;snowContext.fillRect(0,0,32,32);
  const snowTexture=new THREE.CanvasTexture(snowSprite);disposables.add(snowTexture);
  const particleMat=new THREE.PointsMaterial({color:0xe9f5ff,map:snowTexture,size:.45,transparent:true,opacity:.75,alphaTest:.04,depthWrite:false});
  const particles=new THREE.Points(particleGeo,particleMat);particles.visible=false;scene.add(particles);
  const rainPositions=new Float32Array(count*6),rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:0xbdd8ed,transparent:true,opacity:.36,depthWrite:false}));rain.visible=false;rain.frustumCulled=false;scene.add(rain);
  const snowCap=mat(0xf2f5f6);const snowMeshes=[];
  buildingRefs.forEach(ref=>{const m=box(ref.b.w,.18,ref.b.d,ref.b.x,ref.b.h+12.3,ref.b.z,snowCap);m.visible=false;snowMeshes.push(m);ref.roof.push({mesh:m,y:ref.b.h+12.3,floor:ref.floors-1});});
  function environment(nextWeather=weather,nextHour=hour){
    weather=nextWeather;hour=Number(nextHour);
    const night=hour<6||hour>19;const dusk=!night&&(hour>=17||hour<8);
    skyUniforms.night.value=night?1:0;skyUniforms.dusk.value=dusk?1:0;
    skyUniforms.cloud.value=weather==='sunny'?.35:weather==='cloudy'?.95:1.4;
    const overcast=weather==='rain'||weather==='snow'||weather==='fog';
    hemi.intensity=night?.16:overcast?.45:.55;sun.intensity=night?.12:overcast?.45:dusk?1.15:1.45;
    sun.color.set(night?pick('sunNight',0x8dbaff):dusk?pick('sunDusk',0xffaf69):pick('sun',0xffefd2));
    const angle=(hour-6)/12*Math.PI;sun.position.set(Math.cos(angle)*160,Math.max(20,Math.sin(angle)*180),85);
    const fogColor=night?pick('fogNight',0x0c172b):dusk?pick('fogDusk',0xb7a6a2):overcast?0x94aab9:pick('fogDay',0x9fb8ce);
    scene.fog.color.set(studio?studioSky:fogColor);scene.fog.density=studio?0:(weather==='fog'?.012:weather==='rain'?.0045:weather==='snow'?.005:.00165);
    renderer.toneMappingExposure=night?.8:.85;
    litMaterials.forEach(m=>m.emissiveIntensity=night?1.2:dusk?.4:.025);
    glass.envMapIntensity=night?.18:1.2;glass.color.set(night?pick('glassNight',0x66758b):pick('glass',0xb2c2cf)).convertSRGBToLinear();
    asphalt.roughness=weather==='rain'?.24:.92;asphalt.metalness=weather==='rain'?.45:0;asphalt.envMap=env;
    particles.visible=weather==='snow';rain.visible=weather==='rain';particleMat.size=1.05;particleMat.opacity=.9;
    snowMeshes.forEach(m=>m.visible=weather==='snow');
    // 白底模式把阴影压淡一点，否则地面会被楼影压成一片灰
    if(studio){hemi.intensity=Math.max(hemi.intensity,.95);sun.intensity=Math.min(sun.intensity,1.1);}
  }
  // 白底模式要把整块场地刷白：这些材质原来都是灰的/绿的，留着就不像白模
  const studioWash=pick('studioWash',.92);
  // 树、车、水面也一起刷，否则白底模式里会留下一片绿
  const washTargets=[concrete,curb,asphalt,soil,white,lawn,wood,metal,dark,trim,podiumGlass,
    trunkMaterial,leafMaterial,autumnMaterial,water].concat(carBodyMaterials);
  const washBase=washTargets.map(m=>m.color.clone());
  const studioWhiteLinear=new THREE.Color(studioGround).convertSRGBToLinear();
  const studioGroundLinear=new THREE.Color(studioGround).convertSRGBToLinear();
  const toneMappingBase=renderer.toneMapping;
  const exposureBase=renderer.toneMappingExposure;
  function applyStudio(){
    skyUniforms.flatMix.value=studio?1:0;
    skyUniforms.flatColor.value.set(studioSky);
    // 场地材质整体朝白色靠
    washTargets.forEach((material,index)=>{
      material.color.copy(washBase[index]);
      if(studio)material.color.lerp(studioWhiteLinear,studioWash);
    });
    groundMaterial.color.copy(studio?studioGroundLinear:groundBase);
    cityGroup.visible=!studio;
    // 关键：ACES 色调映射会把纯白压到 ~0.8，白底模式下必须关掉，否则天和地永远是灰的
    renderer.toneMapping=studio?THREE.NoToneMapping:toneMappingBase;
    renderer.toneMappingExposure=studio?1:exposureBase;
    scene.fog.color.set(studio?studioSky:scene.fog.color);
    scene.fog.density=studio?0:scene.fog.density;
    environment(weather,hour);
  }
  const bRefOf=id=>buildingRefs.find(r=>r.b.id===id);
  function setSelection(b,floor){
    if(!b){selection.visible=false;return;}
    const ref=bRefOf(b.id),sf=ref.sf;
    selection.visible=true;
    if(floor==null){selection.scale.set(b.w+.8,b.h+1,b.d+.8);selection.position.set(b.x,b.h/2+11.8,b.z);}
    else{const yb=11.8+(floor-1)*sf+ref.cur[floor-1];selection.scale.set(b.w+.8,sf+1,b.d+.8);selection.position.set(b.x,yb+sf/2,b.z);}
  }
  let explode=null;let closingRefs=[];
  function explodeFloor(buildingId,floor){
    const ref=bRefOf(buildingId);if(!ref)return;
    const sel=Math.max(1,Math.min(ref.floors,Math.floor(Number(floor)||1)));
    if(explode&&explode.id===buildingId&&explode.sel===sel)return;
    if(explode&&explode.id!==buildingId)closingRefs.push(bRefOf(explode.id));
    explode={id:buildingId,sel};
    controls.autoRotate=false;
    const b=ref.b,sf=ref.sf,selY=11.8+(sel-1)*sf+sf/2+8;
    fly={position:new THREE.Vector3(b.x+b.w+60,selY+6,b.z+b.d+55),target:new THREE.Vector3(b.x,selY,b.z)};
    setSelection(b,sel);
  }
  function closeFloor(){
    if(explode){closingRefs.push(bRefOf(explode.id));explode=null;}
    setSelection(null);fly={position:home.clone(),target:homeTarget.clone()};controls.autoRotate=false;
  }
  function focus(id){
    const b=BUILDINGS.find(v=>v.id===id);if(!b)return;
    if(explode&&explode.id!==id)closeFloor();
    if(explode)return;
    selection.visible=true;selection.scale.set(b.w+.8,b.h+1,b.d+.8);selection.position.set(b.x,b.h/2+11.8,b.z);
    fly={position:new THREE.Vector3(b.x+80,b.h*.85+30,b.z+110),target:new THREE.Vector3(b.x,b.h*.42+12,b.z)};
    controls.autoRotate=false;callbacks.onSelect?.(b);
  }
  function reset(){closeFloor();selection.visible=false;fly={position:home.clone(),target:homeTarget.clone()};controls.autoRotate=false;}
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  function onDown(e){down={x:e.clientX,y:e.clientY};fly=null;}
  function onClick(e){
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(selectable)[0];if(!hit)return;
    const b=hit.object.userData.building;
    if(explode&&explode.id===b.id&&hit.object.userData.isWall){
      const fi=hit.faceIndex,F=b.floors;
      explodeFloor(b.id,fi<F*8?(fi/8|0)+1:((fi-F*8)/4|0)+1);return;
    }
    focus(b.id);
  }
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onClick);
  const resize=()=>{if(disposed)return;camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();renderer.setSize(container.clientWidth,container.clientHeight);};
  const observer=new ResizeObserver(resize);observer.observe(container);
  function snapshots(){
    const pos=camera.position.clone(),target=controls.target.clone();const images=[];
    for(const view of [[-83,13,100,-12,22,0],[73,23,79,-30,24,-10]]){camera.position.set(view[0],view[1],view[2]);camera.lookAt(view[3],view[4],view[5]);renderer.render(scene,camera);const c=document.createElement('canvas');c.width=480;c.height=270;c.getContext('2d').drawImage(renderer.domElement,0,0,480,270);images.push(c.toDataURL('image/jpeg',.82));}
    camera.position.copy(pos);camera.lookAt(target);renderer.render(scene,camera);callbacks.onSnapshots?.(images);
  }
  function animate(now){
    if(disposed)return;frame=requestAnimationFrame(animate);const delta=Math.min((now-previous)/1000,.05);previous=now;if(paused)return;elapsed+=delta;skyUniforms.time.value=elapsed;
    if(fly){camera.position.lerp(fly.position,.045);controls.target.lerp(fly.target,.045);if(camera.position.distanceTo(fly.position)<.2)fly=null;}
    if(explode){
      const ref=bRefOf(explode.id);const k=Math.min(1,delta*2.8);let dirty=false;
      for(let f=0;f<ref.floors;f++){const target=f<explode.sel?0:8+(f-explode.sel)*2.2;const c=ref.cur[f]+(target-ref.cur[f])*k;if(Math.abs(c-ref.cur[f])>.0005){ref.cur[f]=c;dirty=true;}}
      if(dirty){applyBuildingLift(ref);setSelection(ref.b,explode.sel);}
    }
    if(closingRefs.length){
      const k=Math.min(1,delta*2.8);const done=[];
      closingRefs.forEach(ref=>{let dirty=false;for(let f=0;f<ref.floors;f++){const c=ref.cur[f]*(1-k);if(Math.abs(c-ref.cur[f])>.0005)dirty=true;ref.cur[f]=c;}if(dirty)applyBuildingLift(ref);else{ref.cur.fill(0);done.push(ref);}});
      if(done.length)closingRefs=closingRefs.filter(r=>!done.includes(r));
    }
    controls.update();sky.position.copy(camera.position);
    cars.forEach(c=>{c.group.position[c.axis]+=c.speed*delta*c.sign;if(Math.abs(c.group.position[c.axis])>340)c.group.position[c.axis]*=-1;});
    if(particles.visible||rain.visible){const a=particleGeo.attributes.position.array;for(let i=0;i<count;i++){a[i*3+1]-=delta*(weather==='snow'?4:65);a[i*3]+=delta*(weather==='snow'?Math.sin(elapsed+i)*1.5:-9);if(a[i*3+1]<0){a[i*3+1]=170;a[i*3]=(random()-.5)*330;}if(rain.visible){const j=i*6;rainPositions[j]=a[i*3];rainPositions[j+1]=a[i*3+1];rainPositions[j+2]=a[i*3+2];rainPositions[j+3]=a[i*3]+.6;rainPositions[j+4]=a[i*3+1]+3;rainPositions[j+5]=a[i*3+2];}}particleGeo.attributes.position.needsUpdate=true;rainGeometry.attributes.position.needsUpdate=true;}
    renderer.render(scene,camera);
    if(now-lastLabels>50){lastLabels=now;const labels=BUILDINGS.map(b=>{const v=new THREE.Vector3(b.x,b.h+20,b.z).project(camera);const minimumY=container.clientWidth<700?175:container.clientHeight<780?152:172;return{id:b.id,x:(v.x*.5+.5)*container.clientWidth,y:Math.max(minimumY,(-.5*v.y+.5)*container.clientHeight),visible:v.z<1&&v.z>-1};});callbacks.onLabels?.(labels);}
    frames++;if(now-fpsStart>1200){callbacks.onStats?.(Math.round(frames*1000/(now-fpsStart)));frames=0;fpsStart=now;}
  }
  applyStudio();animate(performance.now());
  const snapshotTimer=setTimeout(snapshots,800);
  return {
    environment,focus,reset,snapshots,
    explodeFloor,closeFloor,
    isExploded(){return explode?{id:explode.id,floor:explode.sel}:null;},
    pause(value){paused=value;frames=0;fpsStart=performance.now();},
    orbit(enabled){controls.autoRotate=enabled;fly=null;},
    studio(value){studio=Boolean(value);applyStudio();},
    top(){fly={position:new THREE.Vector3(0,280,65),target:new THREE.Vector3(-7,0,0)};controls.autoRotate=false;},
    view(state){if(!state)return{camera:camera.position.toArray(),target:controls.target.toArray()};const p=state.position,t=state.target;if(!Array.isArray(p)||p.length<3)return undefined;fly={position:new THREE.Vector3(p[0],p[1],p[2]),target:Array.isArray(t)&&t.length>=3?new THREE.Vector3(t[0],t[1],t[2]):controls.target.clone()};controls.autoRotate=false;return undefined;},
    dispose(){disposed=true;cancelAnimationFrame(frame);clearTimeout(snapshotTimer);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onClick);scene.traverse(o=>{if(o.geometry)disposables.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>disposables.add(m));});disposables.forEach(d=>d.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
  };
}
