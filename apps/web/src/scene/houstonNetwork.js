import * as THREE from 'three';
import { ROUTERS, ROUTER_SPEC as S, NETWORK_GROUPS, NETWORK_LINKS } from '../sites/houston/networkConfig.js';

/** Eight metre-scale photo-based routers, removable independently of the shell. */
export function createHoustonNetwork(scene) {
  const devices=new THREE.Group(), links=new THREE.Group();
  devices.name='houston-routers';links.name='houston-wired-mesh';scene.add(devices,links);
  const geometries=new Set(),materials=new Set();
  function material(color,extra={}) {
    const m=new THREE.MeshStandardMaterial({color,roughness:.7,...extra});m.color.convertSRGBToLinear();materials.add(m);return m;
  }
  // Dedicated materials: r115 must not share these with instanced warehouse meshes.
  const white=material(0xf1f0e9),bracket=material(0xe1e3df),vent=material(0x505853),black=material(0x292c2c),silver=material(0x899393,{metalness:.5});
  const led=material(0xe0f7f5,{emissive:0x8cffff,emissiveIntensity:.4});
  function mesh(parent,geometry,mat,x=0,y=0,z=0) {
    geometries.add(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  const boxGeo=new THREE.BoxBufferGeometry(1,1,1);geometries.add(boxGeo);
  function box(parent,mat,x,y,z,w,h,d){const m=mesh(parent,boxGeo,mat,x,y,z);m.scale.set(w,h,d);return m;}
  function cable(parent,points,mat,radius=.002) {
    return mesh(parent,new THREE.TubeBufferGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,5,false),mat);
  }
  const radius=S.width/2,half=S.height/2;
  // A lathed rim rounds the cylinder without changing the given body envelope.
  const bodyGeo=new THREE.LatheBufferGeometry([
    new THREE.Vector2(0,-half),new THREE.Vector2(radius-.006,-half),
    new THREE.Vector2(radius-.001,-half+.005),new THREE.Vector2(radius,half-.02),
    new THREE.Vector2(radius-.002,half-.011),new THREE.Vector2(0,half-.011),
  ],48);geometries.add(bodyGeo);
  for(const node of ROUTERS) {
    const root=new THREE.Group();root.name=node.id;root.userData={...node,bodySize:[S.width,S.height,S.depth],heightAboveFloor:S.mountHeight};
    root.position.set(node.x,node.y,node.z);root.rotation.y=node.side<0?0:Math.PI;devices.add(root);
    mesh(root,bodyGeo,white);
    mesh(root,new THREE.CylinderBufferGeometry(radius-.002,radius-.002,.01,48),white,0,half-.005);
    mesh(root,new THREE.CylinderBufferGeometry(radius*.63,radius*.63,.001,40),bracket,0,half+.0005);
    for(let i=0;i<52;i++) {
      const a=i/52*Math.PI*2,r=radius*.81;
      const slot=box(root,vent,Math.sin(a)*r,half+.0002,Math.cos(a)*r,.0017,.0006,.014);
      slot.rotation.y=a;
    }
    // Wall plate, two projecting arms, triangular braces and an open retaining ring.
    box(root,bracket,0,-.009,-S.wallStandOff+.006,.084,.18,.006);
    for(const x of [-.034,.034]) {
      box(root,bracket,x,.05,-.065,.01,.005,.108);
      const strut=box(root,bracket,x,-.022,-.064,.008,.007,.119);strut.rotation.x=-.83;
      for(const y of [-.072,.06])mesh(root,new THREE.SphereBufferGeometry(.003,8,6),silver,x,y,-S.wallStandOff+.011);
    }
    const ring=mesh(root,new THREE.TorusBufferGeometry(radius+.001,.003,6,52,Math.PI*1.65),bracket,0,.047,0);
    ring.rotation.x=Math.PI/2;ring.rotation.z=-Math.PI*.32;
    // Narrow retention straps loop over the vented end, as shown in the photos.
    for(const x of [-.023,.023]) {
      box(root,bracket,x,half+.002,0,.008,.0015,.095);
      box(root,bracket,x,half-.012,.047,.008,.027,.0015);
    }
    // Rear ports, white Ethernet lead and a separate black power lead.
    box(root,black,-.018,half-.014,-radius-.001,.012,.01,.003);
    box(root,silver,-.018,half-.014,-radius-.008,.009,.008,.016);
    box(root,black,.016,half-.014,-radius-.005,.007,.007,.012);
    cable(root,[[-.018,half-.014,-.061],[-.02,.063,-.085],[-.05,.008,-.106],[-.06,-.23,-.113]],bracket,.0018);
    cable(root,[[.016,half-.014,-.061],[.018,.09,-.089],[.035,.07,-.106],[.041,-.24,-.114]],black,.0015);
    // Two short light bars recreate the small front status chevron (appearance only).
    for(const side of [-1,1]) {const light=box(root,led,side*.0027,.047,radius-.0005,.007,.0018,.0012);light.rotation.z=-side*.6;}
  }
  for(const group of NETWORK_GROUPS) {
    const mat=new THREE.LineDashedMaterial({color:group.color,dashSize:1.2,gapSize:.65,transparent:true,opacity:.9,depthTest:false});materials.add(mat);
    for(const link of NETWORK_LINKS.filter(link=>link.group===group.id)) {
      const a=ROUTERS.find(n=>n.id===link.from),b=ROUTERS.find(n=>n.id===link.to);
      const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,a.y,a.z),new THREE.Vector3(b.x,b.y,b.z)]);geometries.add(geometry);
      const line=new THREE.Line(geometry,mat);line.name=`${link.from}--${link.to}`;line.computeLineDistances();line.renderOrder=4;links.add(line);
    }
  }
  links.visible=false;
  return {devices,links,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.remove(devices,links);}};
}
