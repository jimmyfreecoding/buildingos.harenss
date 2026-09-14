<template>
  <section class="smart-floor" aria-label="Smart 总部 1F 室内模型">
    <div ref="host" class="smart-floor-canvas" aria-label="1F 三维平面，拖动平移，滚轮缩放"></div>
    <header class="smart-floor-header"><div><small>SMART HEADQUARTERS / INTERIOR</small><h2>总部 · 1F 室内空间</h2></div><div class="smart-floor-actions"><button :class="{active:mode==='plan'}" @click="setView('plan')">2D 平面</button><button :class="{active:mode==='three'}" @click="setView('three')">3D 室内</button><button @click="reset">重置视角</button><button @click="$emit('close')">返回园区 ×</button></div></header>
    <div class="smart-floor-filter"><label>定位房间 <select v-model="selectedId" @change="locate"><option value="">全部空间</option><option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.name }}</option></select></label><label><input v-model="showNames" type="checkbox"/>房间名称</label><span>办公区 <i class="office-dot"></i> 会议室 <i class="meeting-dot"></i> 服务 / 设备 <i class="service-dot"></i></span></div>
    <button v-for="p in labelPositions" v-show="showNames&&p.visible" :key="p.id" class="smart-room-label" :class="{active:selectedId===p.id}" :style="{left:p.x+'px',top:p.y+'px'}" @click="selectRoom(p.id)">{{p.name}}</button>
    <aside v-if="selected" class="smart-room-info"><button @click="selectedId='';highlightRoom()">×</button><small>1F / {{ selected.id }}</small><h3>{{selected.name}}</h3><p>{{typeNames[selected.type]}} · 按参考图重建</p><p>隔墙、门洞及家具为可旋转三维几何。</p></aside>
    <div v-if="opening" class="smart-floor-opening">正在抬升外壳，展开 1F…</div>
    <div v-if="error" class="smart-floor-opening">{{error}}</div>
    <footer>1F 图纸重建 · 房间布局按参考图描绘，尺寸与不可辨细节为近似 <span>左键{{mode==='plan'?'平移':'旋转'}} · 滚轮缩放 · 点击房间查看</span></footer>
  </section>
</template>

<script setup>
import {ref,computed,onMounted,onBeforeUnmount} from 'vue';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {BufferGeometryUtils} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {SMART_ROOMS as rooms,SMART_POIS} from '../../scene/smartFirstFloor';
defineEmits(['close']);
// bare：当作页面背景用时是白底浅色，嵌在大屏里时保持原来的深色
const bare=computed(()=>props.bare);
const host=ref(null),mode=ref('plan'),selectedId=ref(''),showNames=ref(true),labelPositions=ref([]),opening=ref(true),error=ref('');
const selected=computed(()=>rooms.find(r=>r.id===selectedId.value));
const typeNames={office:'办公空间',meeting:'会议空间',service:'公共服务',plant:'设备与档案'};
let scene,renderer,camera,controls,observer,frame,highlight,roof,start,disposed=false;
const picks=[],resources=new Set();
const coord=(x,y,z)=>new THREE.Vector3(x-75,y,(z-36)*5/6);
function setView(value){mode.value=value;if(!camera)return;camera.zoom=1;camera.position.copy(value==='plan'?coord(75,160,36.01):coord(125,115,144));camera.up.set(0,1,0);controls.target.copy(coord(75,0,36));controls.enableRotate=value==='three';controls.mouseButtons.LEFT=value==='three'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN;camera.updateProjectionMatrix();controls.update();}
function reset(){selectedId.value='';highlightRoom();setView(mode.value);}
function selectRoom(id){selectedId.value=id;highlightRoom();}
function locate(){highlightRoom();if(!selected.value){setView(mode.value);return;}const r=selected.value,delta=coord(r.x+r.w/2,0,r.z+r.d/2).sub(controls.target);controls.target.add(delta);camera.position.add(delta);camera.zoom=1.5;camera.updateProjectionMatrix();controls.update();}
function highlightRoom(){if(!highlight)return;highlight.visible=Boolean(selected.value);if(selected.value){const r=selected.value;highlight.position.copy(coord(r.x+r.w/2,.25,r.z+r.d/2));highlight.scale.set(r.w,.12,r.d*5/6);}}
onMounted(()=>{try{
  scene=new THREE.Scene();scene.background=new THREE.Color(bare.value?0xffffff:0x17232b);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;host.value.appendChild(renderer.domElement);
  camera=new THREE.OrthographicCamera(-90,90,45,-45,.1,600);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.6;controls.maxZoom=5;controls.maxPolarAngle=Math.PI*.47;
  scene.add(new THREE.HemisphereLight(0xffffff,0x687a84,1.1));const sun=new THREE.DirectionalLight(0xffffff,.6);sun.position.set(-30,100,40);scene.add(sun);
  const mat=c=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.85});m.color.convertSRGBToLinear();return m;};
  const floorMat=mat(0x566166),wall=mat(0xd2dcda),wood=mat(0xb88c64),chair=mat(0x475e63),metal=mat(0x73838a),glazing=mat(0x799caa);
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
    const slab=box(r.x,r.z,r.w,r.d,.12,isNested?.05:.02,zoneMats[r.type]);slab.userData.room=r.id;picks.push(slab);
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
  const staticParts=scene.children.filter(o=>o.isMesh&&o.geometry===unit&&!o.userData.room&&o!==highlight);
  for(const m of new Set(staticParts.map(o=>o.material))){const parts=staticParts.filter(o=>o.material===m);const gs=parts.map(o=>{o.updateMatrix();scene.remove(o);return unit.clone().applyMatrix4(o.matrix);});scene.add(new THREE.Mesh(BufferGeometryUtils.mergeBufferGeometries(gs),m));gs.forEach(g=>g.dispose());}
  const resize=()=>{const w=host.value.clientWidth,h=host.value.clientHeight;renderer.setSize(w,h);const aspect=w/Math.max(1,h),width=Math.max(174,100*aspect);camera.left=-width/2;camera.right=width/2;camera.top=width/aspect/2;camera.bottom=-width/aspect/2;camera.updateProjectionMatrix();};
  observer=new ResizeObserver(resize);observer.observe(host.value);resize();setView('plan');start=performance.now();let down;
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
.smart-floor{position:fixed;inset:70px 0 0;z-index:45;background:#17232b;color:#e3edef}.smart-floor-canvas{position:absolute;inset:0}.smart-floor-header{position:absolute;top:20px;left:28px;right:28px;display:flex;align-items:center;justify-content:space-between;gap:16px}.smart-floor-header small{color:#7d9ca9;font-size:10px;letter-spacing:2px}.smart-floor-header h2{font-size:22px;margin:6px 0}.smart-floor-actions{display:flex;gap:8px}.smart-floor button,.smart-floor select{background:#253843;color:#d7e5e9;border:1px solid #56717e;border-radius:5px;padding:9px 13px;cursor:pointer}.smart-floor button.active{background:#256374;border-color:#68dce8}.smart-floor-filter{position:absolute;left:28px;top:95px;display:flex;gap:20px;align-items:center;font-size:12px}.smart-floor-filter select{margin-left:8px;padding:6px}.smart-floor-filter i{display:inline-block;width:9px;height:9px;margin:0 10px 0 3px}.office-dot{background:#81928f}.meeting-dot{background:#9e998d}.service-dot{background:#68848a}.smart-floor .smart-room-label{position:absolute;transform:translate(-50%,-50%);font-size:10px;padding:2px 4px;border:0;background:#17232bb0;color:#fff;white-space:nowrap;max-width:125px}.smart-room-info{position:absolute;right:24px;bottom:60px;width:240px;padding:18px;background:#203540ef;border:1px solid #526e7d;border-radius:8px}.smart-room-info button{float:right;padding:0 6px}.smart-room-info p{font-size:12px;line-height:1.7;color:#b4c8ce}.smart-floor footer{position:absolute;bottom:14px;left:28px;right:28px;font-size:11px;color:#a8bec6;display:flex;justify-content:space-between}.smart-floor-opening{position:absolute;top:45%;left:40%;padding:20px;background:#152b3de8;border-radius:10px}@media(max-width:800px){.smart-floor-header{left:12px;right:12px;align-items:flex-start}.smart-floor-header h2{font-size:16px}.smart-floor-actions{flex-wrap:wrap;max-width:230px}.smart-floor-actions button{padding:7px;font-size:11px}.smart-floor-filter{left:12px;top:115px;gap:8px}.smart-floor-filter>span{display:none}.smart-floor footer span{display:none}}
</style>
