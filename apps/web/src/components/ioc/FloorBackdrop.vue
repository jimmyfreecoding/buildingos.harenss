<template>
  <div class="floor-bg">
    <div ref="host" class="floor-bg-canvas" aria-label="Smart 总部 1F 平面，拖动平移，滚轮缩放"></div>
    <button v-for="p in labelPositions" v-show="p.visible" :key="p.id" class="floor-bg-label" :style="{left:p.x+'px',top:p.y+'px'}">{{p.name}}</button>
    <div class="floor-bg-modes">
      <button type="button" :class="{ active: mode === 'plan' }" @click="setView('plan')">2.5D 平面</button>
      <button type="button" :class="{ active: mode === 'three' }" @click="setView('three')">3D 室内</button>
    </div>
    <div v-if="error" class="floor-bg-error">{{ error }}</div>
  </div>
</template>



<script setup>
import {ref,computed,onMounted,onBeforeUnmount,watch} from 'vue';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {SMART_ROOMS as rooms,SMART_POIS} from '../../scene/smartFirstFloor';
defineEmits(['close']);
// view：外层存下来的机位；currentView() 读当前机位，给演示模式的「保存视角」用
const props=defineProps({view:{type:Object,default:null},roomState:{type:Object,default:null}});
// 按房间上色：底色代表照明（亮=开灯，暗=关灯），自发光代表空调（冷蓝=运行中）。
// 没有策略覆盖的房间保持原样，不动它。
function applyRoomState(){
  const st=props.roomState;
  let slot=0;
  for(const slab of picks){
    const base=slab.userData.base;if(!base)continue;
    const s=st&&st[slab.userData.room];
    const mat=slab.material;
    mat.color.copy(base);
    mat.emissive.setHex(0x000000);
    if(!s)continue;
    if(s.light!==undefined){
      mat.color.multiplyScalar(s.light?1.35:0.32);
      let lm=lamps[slab.userData.room];
      if(!lm){lm=lamps[slab.userData.room]=new THREE.MeshBasicMaterial({color:0x2b3339});buildLamps(slab.userData.rect,lm);}
      lm.color.setHex(s.light?0xfff2c4:0x2b3339);
      // 点亮的房间用一盏点光源往地面打光，最多 8 盏
      if(s.light&&slot<8){
        let L=lightPool[slot];
        if(!L){L=new THREE.PointLight(0xffcf7a,0,26);scene.add(L);lightPool[slot]=L;}
        L.position.copy(coord(slab.userData.cx,2.0,slab.userData.cz));
        L.intensity=4.2;slot++;
      }
    }
    if(s.ac&&s.ac.on){mat.emissive.setHex(0x2f6fd0);mat.emissiveIntensity=0.35;}
  }
  for(let i=slot;i<lightPool.length;i++)if(lightPool[i])lightPool[i].intensity=0;
}
function applyView(){if(!camera||!props.view||!Array.isArray(props.view.position))return;
  if(props.view.mode&&props.view.mode!==mode.value){mode.value=props.view.mode;controls.enableRotate=props.view.mode==='three';controls.mouseButtons.LEFT=props.view.mode==='three'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;}
  camera.position.set(...props.view.position);
  if(Array.isArray(props.view.target))controls.target.set(...props.view.target);
  if(typeof props.view.zoom==='number')camera.zoom=props.view.zoom;
  camera.updateProjectionMatrix();controls.update();}
function currentView(){return camera?{camera:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom,mode:mode.value}:null;}
defineExpose({currentView,applyView,applyRoomState});
const host=ref(null),mode=ref('plan'),selectedId=ref(''),showNames=ref(true),labelPositions=ref([]),opening=ref(true),error=ref('');
const selected=computed(()=>rooms.find(r=>r.id===selectedId.value));
const typeNames={office:'办公空间',meeting:'会议空间',service:'公共服务',plant:'设备与档案'};
let scene,renderer,camera,controls,observer,frame,highlight,roof,start,disposed=false;
const picks=[],resources=new Set(),lamps={},lightPool=[];
// 只有被照明策略覆盖的房间才挂灯具：天花板下一组发光板，开灯亮成暖白。
// 没策略的房间一个灯都不放，平面图保持干净，亮暗对比也更清楚。
let lampGeo=null;
function buildLamps(r,mat){
  if(!lampGeo)lampGeo=new THREE.BoxBufferGeometry(1,1,1);
  const nx=Math.min(3,Math.max(1,Math.round(r.w/7))),nz=Math.min(3,Math.max(1,Math.round(r.d/7)));
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const lamp=new THREE.Mesh(lampGeo,mat);
    lamp.position.copy(coord(r.x+(i+.5)*r.w/nx,2.32,r.z+(j+.5)*r.d/nz));
    lamp.scale.set(3.4,.26,3.4*5/6);
    lamp.userData.lamp=true;scene.add(lamp);
  }
}
const coord=(x,y,z)=>new THREE.Vector3(x-75,y,(z-36)*5/6);
function setView(value){mode.value=value;if(!camera)return;camera.zoom=1;camera.position.copy(value==='plan'?coord(75,160,36.01):coord(125,115,144));camera.up.set(0,1,0);controls.target.copy(coord(75,0,36));controls.enableRotate=value==='three';controls.mouseButtons.LEFT=value==='three'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;camera.updateProjectionMatrix();controls.update();}
function reset(){selectedId.value='';highlightRoom();setView(mode.value);}
function selectRoom(id){selectedId.value=id;highlightRoom();}
function locate(){highlightRoom();if(!selected.value){setView(mode.value);return;}const r=selected.value,delta=coord(r.x+r.w/2,0,r.z+r.d/2).sub(controls.target);controls.target.add(delta);camera.position.add(delta);camera.zoom=1.5;camera.updateProjectionMatrix();controls.update();}
function highlightRoom(){if(!highlight)return;highlight.visible=Boolean(selected.value);if(selected.value){const r=selected.value;highlight.position.copy(coord(r.x+r.w/2,.25,r.z+r.d/2));highlight.scale.set(r.w,.12,r.d*5/6);}}
watch(()=>props.view,()=>applyView(),{deep:true});
watch(()=>props.roomState,()=>applyRoomState(),{deep:true});
onMounted(()=>{try{
  scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;host.value.appendChild(renderer.domElement);
  camera=new THREE.OrthographicCamera(-90,90,45,-45,.1,600);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.6;controls.maxZoom=5;controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xffffff,0x687a84,1.1));const sun=new THREE.DirectionalLight(0xffffff,.6);sun.position.set(-30,100,40);scene.add(sun);
    // 白底版本：所有材质统一往白里调，不逐个改色号
  const LIGHTEN=.3;
  const mat=c=>{const base=new THREE.Color(c).lerp(new THREE.Color(0xffffff),LIGHTEN);const m=new THREE.MeshStandardMaterial({color:base.getHex(),roughness:.9});m.color.convertSRGBToLinear();return m;};
  const floorMat=mat(0xf2f6f8),wall=mat(0xd2dcda),wood=mat(0xb88c64),chair=mat(0x475e63),metal=mat(0x73838a),glazing=mat(0x799caa);
  const zoneMats={office:mat(0x81928f),meeting:mat(0x9e998d),service:mat(0x68848a),plant:mat(0x6d7681)};
  const unit=new THREE.BoxBufferGeometry(1,1,1);resources.add(unit);
  function box(x,z,w,d,h,y,m){const obj=new THREE.Mesh(unit,m);obj.position.copy(coord(x+w/2,y+h/2,z+d/2));obj.scale.set(w,h,d*5/6);scene.add(obj);return obj;}
  const shape=new THREE.Shape();shape.moveTo(5,0);shape.lineTo(145,0);shape.quadraticCurveTo(150,0,150,5);shape.lineTo(150,67);shape.quadraticCurveTo(150,72,145,72);shape.lineTo(97,72);shape.lineTo(97,63.583);
  shape.absarc(85,53,16,Math.acos(12/16),Math.PI-Math.acos(12/16),true);shape.lineTo(73,72);shape.lineTo(5,72);shape.quadraticCurveTo(0,72,0,67);shape.lineTo(0,5);shape.quadraticCurveTo(0,0,5,0);
  const floorGeo=new THREE.ExtrudeBufferGeometry(shape,{depth:.35,bevelEnabled:false,curveSegments:48});floorGeo.rotateX(Math.PI/2);floorGeo.translate(-75,0,-36);floorGeo.scale(1,1,5/6);scene.add(new THREE.Mesh(floorGeo,floorMat));
  // Roof proxy follows the plan outline and lifts away on entry.
  roof=new THREE.Mesh(floorGeo,new THREE.MeshStandardMaterial({color:0xabbfc9,transparent:true,opacity:.9}));roof.position.y=4;scene.add(roof);
  const perimeter=shape.getPoints(60);
  for(let i=1;i<perimeter.length;i++){
    const a=coord(perimeter[i-1].x,0,perimeter[i-1].y),b=coord(perimeter[i].x,0,perimeter[i].y),len=a.distanceTo(b);
    const rail=new THREE.Mesh(unit,glazing);rail.position.copy(a).add(b).multiplyScalar(.5);rail.position.y=.75;rail.scale.set(len,1.5,.16);rail.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);scene.add(rail);
  }
  function seat(x,z){box(x-.24,z-.24,.48,.48,.45,.1,chair);box(x-.24,z+.19,.48,.07,.35,.55,chair);}
  function desk(x,z,w=1.7,d=.85){box(x,z,w,d,.1,.75,wood);box(x+.15,z+.12,.1,.1,.75,0,metal);box(x+w-.25,z+d-.22,.1,.1,.75,0,metal);box(x+w*.4,z+.1,.48,.07,.35,.85,metal);seat(x+w/2,z+d+.4);}
  function table(x,z,w,d){box(x,z,w,d,.14,.72,wood);for(let t=.8;t<w;t+=1.3){seat(x+t,z-.5);seat(x+t,z+d+.5);}seat(x-.5,z+d/2);seat(x+w+.5,z+d/2);}
  for(const r of rooms){
    const isNested=rooms.some(q=>q!==r&&r.x>=q.x&&r.z>=q.z&&r.x+r.w<=q.x+q.w&&r.z+r.d<=q.z+q.d);
    const slab=box(r.x,r.z,r.w,r.d,.12,isNested?.05:.02,zoneMats[r.type].clone());slab.userData.room=r.id;slab.userData.base=slab.material.color.clone();slab.userData.cx=r.x+r.w/2;slab.userData.cz=r.z+r.d/2;picks.push(slab);
    slab.userData.rect=r;   // 有照明策略时才按这个矩形建灯具
    // Door opening on the circulation-facing edge (approximate where illegible).
    const gap=Math.min(1.4,r.w/3),door=r.w*.55;
    box(r.x,r.z,r.w,.16,2.6,.15,wall);box(r.x,r.z,.16,r.d,2.6,.15,wall);box(r.x+r.w-.16,r.z,.16,r.d,2.6,.15,wall);
    box(r.x,r.z+r.d-.16,door-gap/2,.16,2.6,.15,wall);box(r.x+door+gap/2,r.z+r.d-.16,r.w-door-gap/2,.16,2.6,.15,wall);
    box(r.x+door-gap/2,r.z+r.d-.08,gap,.3,.04,.17,wood);
    const nested=rooms.filter(q=>q!==r&&q.x>=r.x&&q.z>=r.z&&q.x+q.w<=r.x+r.w&&q.z+q.d<=r.z+r.d);
    const free=(x,z)=>!nested.some(q=>x>=q.x-1&&x<=q.x+q.w+1&&z>=q.z-1&&z<=q.z+q.d+1);
    if(r.type==='office'){
      for(let x=r.x+1;x<r.x+r.w-2;x+=3.8)for(let z=r.z+1.2;z<r.z+r.d-2;z+=3.5)if(free(x,z)&&free(x+1.7,z+1.8))desk(x,z);
    }else if(r.type==='meeting')table(r.x+r.w*.28,r.z+1.5,Math.max(1.5,r.w*.44),Math.max(1.2,r.d-3));
    else if(r.id.startsWith('wc')){for(let z=r.z+1;z<r.z+r.d-1;z+=2){box(r.x+.6,z,1.8,1.5,1.7,.2,wall);box(r.x+1,z+.3,.6,.8,.45,.2,whiteMat());}box(r.x+r.w-1.5,r.z+1,.8,r.d-2,.85,.1,metal);}
    else if(r.id==='lift'){for(let z=r.z+1;z<r.z+r.d-2;z+=4)box(r.x+1,z,3,2.8,2.5,.15,metal);}
    else if(r.type==='plant'){for(let x=r.x+1;x<r.x+r.w-1;x+=2.3)box(x,r.z+1,1.1,Math.max(1,r.d-3),1.5,.2,metal);}
  }
  function whiteMat(){return wall;}
  // Shared lobby: reception, stairs, informal tables and seating along the atrium.
  table(29,31,2,1.2);table(33,31,2,1.2);table(31,39,3,1.4);
  for(let a=Math.PI*.98;a<Math.PI*2.03;a+=.25){const x=85+23*Math.cos(a),z=53+23*Math.sin(a);if(z>26&&z<69)table(x,z,1.2,1.2);}
  box(68,27,6,1,.95,.15,wood);box(68,27,1,3,.95,.15,wood);box(73,27,1,3,.95,.15,wood);
  for(const [, ,x,z] of SMART_POIS)for(let i=0;i<10;i++)box(x,z+i*.24,2,.24,.1+i*.15,.1,wall);
  for(let x=56;x<=113;x+=11){if(x>69&&x<101)continue;box(x,46,.5,23,.5,0,metal);}
  highlight=new THREE.Mesh(unit,new THREE.MeshBasicMaterial({color:0x51d9ec,transparent:true,opacity:.35,depthWrite:false}));highlight.visible=false;scene.add(highlight);
  // Batch furniture and partition pieces while retaining room slabs for picking.
  const staticParts=scene.children.filter(o=>o.isMesh&&o.geometry===unit&&!o.userData.room&&!o.userData.lamp&&o!==highlight);
  for(const m of new Set(staticParts.map(o=>o.material))){const parts=staticParts.filter(o=>o.material===m);const gs=parts.map(o=>{o.updateMatrix();scene.remove(o);return unit.clone().applyMatrix4(o.matrix);});scene.add(new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(gs),m));gs.forEach(g=>g.dispose());}
  const resize=()=>{const w=host.value.clientWidth,h=host.value.clientHeight;renderer.setSize(w,h);const aspect=w/Math.max(1,h),width=Math.max(174,100*aspect);camera.left=-width/2;camera.right=width/2;camera.top=width/aspect/2;camera.bottom=-width/aspect/2;camera.updateProjectionMatrix();};
  observer=new ResizeObserver(resize);observer.observe(host.value);resize();setView('plan');
  // 关键：应用页面配的机位 / 本机存的机位，盖过默认的俯视角度。
  // 之前这里只设默认角度就走，applyView 挂在 watch 上而 watch 不是 immediate，
  // 挂载时根本不触发 —— 所以镜头位置永远保持不住。
  applyView();
  applyRoomState();
  start=performance.now();let down;
  renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(picks)[0];if(hit)selectRoom(hit.object.userData.room);});
  let labelsAt=0;
  function animate(now){if(disposed)return;frame=requestAnimationFrame(animate);const t=Math.min(1,(now-start)/1300);roof.position.y=4+45*t;roof.material.opacity=.9*(1-t);roof.visible=t<1;opening.value=t<1;controls.update();renderer.render(scene,camera);
    if(now-labelsAt>100){labelsAt=now;labelPositions.value=rooms.map(r=>{const p=coord(r.x+r.w/2,3.2,r.id==='106'?r.z+r.d-2:r.z+r.d/2).project(camera);return{id:r.id,name:r.name,x:(p.x*.5+.5)*host.value.clientWidth,y:(-.5*p.y+.5)*host.value.clientHeight,visible:t===1&&p.x>-.94&&p.x<.94&&p.y>-.7&&p.y<.64};});}}
  animate(start);
}catch(e){error.value='1F 初始化失败：'+e.message;console.error(e);}});
onBeforeUnmount(()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();scene?.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.forEach(r=>r.dispose());renderer?.dispose();renderer?.forceContextLoss();renderer?.domElement.remove();});
</script>



<style scoped>
.floor-bg{position:absolute;inset:0;background:#fff;overflow:hidden}
.floor-bg-canvas{position:absolute;inset:0}
.floor-bg-canvas canvas{display:block;width:100%;height:100%;outline:none}
.floor-bg-label{position:absolute;transform:translate(-50%,-50%);padding:1px 6px;border:0;background:none;font:500 11px 'Noto Sans SC','Microsoft YaHei',sans-serif;color:#8b98a2;white-space:nowrap;pointer-events:none}
/* 演示顶栏占着上面约 70px，按钮必须放在它下面，否则被盖住点不到 */
.floor-bg-modes{position:absolute;right:22px;top:88px;z-index:80;display:flex;gap:6px;pointer-events:auto}
.floor-bg-modes button{padding:7px 18px;border-radius:6px;border:1px solid #cfd8e0;background:#fff;box-shadow:0 3px 10px rgba(20,45,70,.1);font:600 13px 'Noto Sans SC','Microsoft YaHei',sans-serif;color:#4a5a66;cursor:pointer}
.floor-bg-modes button:hover{border-color:#3d7ae0;color:#3d7ae0}
.floor-bg-modes button.active{background:#3d7ae0;border-color:#3d7ae0;color:#fff}
.floor-bg-error{position:absolute;left:16px;top:12px;padding:6px 12px;border-radius:4px;background:#fdeceb;color:#c0392b;font-size:12px}
</style>
