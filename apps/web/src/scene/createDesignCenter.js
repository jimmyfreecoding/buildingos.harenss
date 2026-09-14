import * as THREE from 'three';

// Layout reference: centre sits beside headquarters, approximately 2/3 its width,
// with a similar depth. Photo reference: two storeys, blue glass and stone fins.
export function createDesignCenter({ scene, building, material, box, mesh, reflection, selectable, road, white, green }) {
  const {x,z,w,d,h}=building;
  const outline=new THREE.Shape();const r=4,hw=w/2,hd=d/2;
  outline.moveTo(-hw+r,-hd);outline.lineTo(hw-r,-hd);outline.quadraticCurveTo(hw,-hd,hw,-hd+r);
  outline.lineTo(hw,hd-r);outline.quadraticCurveTo(hw,hd,hw-r,hd);outline.lineTo(-hw+r,hd);
  outline.quadraticCurveTo(-hw,hd,-hw,hd-r);outline.lineTo(-hw,-hd+r);outline.quadraticCurveTo(-hw,-hd,-hw+r,-hd);
  const courtyard=new THREE.Path();courtyard.moveTo(-27,-10);courtyard.lineTo(-27,13);courtyard.lineTo(-3,13);courtyard.lineTo(-3,-10);courtyard.closePath();outline.holes.push(courtyard);
  const blue=material(0x26394f,{metalness:.48,roughness:.22,envMap:reflection,envMapIntensity:.7});
  const stone=material(0xaaa9a3,{metalness:.18,roughness:.6}),roof=material(0x9b9fa0),trim=material(0x414b55);
  function plate(height,y,mat){const geo=new THREE.ExtrudeBufferGeometry(outline,{depth:height,bevelEnabled:false,curveSegments:24});geo.rotateX(Math.PI/2);const m=mesh(geo,mat,x,y+height,z);m.userData.building=building;selectable.push(m);return m;}
  box(w+30,.4,d+30,x,-.35,z,road);
  box(w+4,.25,d+4,x,0,z,white);
  plate(h,0,blue);plate(.32,h,roof);plate(.15,0,trim);
  // Open rectangular lightwell, including ground and two landscaped strips.
  box(23.5,.15,22.5,x-15,.18,z+1.5,white);
  box(4,.22,15,x-23,.32,z+1.5,green);box(4,.22,15,x-7,.32,z+1.5,green);
  const perimeter=new THREE.Path();perimeter.copy(outline); // sample outer boundary only
  const length=perimeter.getLength();
  for(let step=0,index=0;step<length;step+=2.4,index++){
    const p=perimeter.getPointAt(step/length),t=perimeter.getTangentAt(step/length);
    // Alternating wide pale panels and narrow metal mullions, like the photo.
    const width=index%4===0?1.4:index%4===2?.6:.07;
    const m=box(width,h-.15,.12,x+p.x+t.y*.08,h/2,z+p.y-t.x*.08,index%2===0?stone:trim);
    m.rotation.y=-Math.atan2(t.y,t.x);
    if(index%2===1){const panel=box(.5,3,.13,x+p.x+t.y*.1,1.5,z+p.y-t.x*.1,stone);panel.rotation.y=m.rotation.y;}
  }
  for(const y of [3,6,9])for(const zz of [-hd,hd])box(w-8,.035,.1,x,y,z+zz+.02,trim);
  for(const xx of [-hw,hw])box(.1,.055,d-8,x+xx,6,z,trim);
  const lime=material(0xbac900);
  const entrance=x-18;
  box(8,2.8,.35,entrance,1.4,z+hd+.2,blue,building);
  box(9,.6,1.2,entrance,3.2,z+hd+.55,lime);
  for(const side of [-1,1])box(.55,3.5,1.2,entrance+side*4.25,1.75,z+hd+.55,lime);
  box(11,.15,5,entrance,.13,z+hd+3,white);
  // Parking aisles between the two buildings and along the north edge.
  for(let zz=-3;zz<60;zz+=5.2){box(8,.03,.1,x+hw+18,-.1,zz,white);box(.1,.03,5.1,x+hw+14,-.1,zz+2.55,white);}
  for(let xx=x-hw;xx<x+hw;xx+=5.2){box(.1,.03,6,xx,-.1,z-hd-9,white);}
  box(w+20,.2,4,x,-.1,z+hd+14,green);
  // Front fence has fine repeated pickets rather than a solid retaining wall.
  for(let xx=x-hw-6;xx<x+hw+7;xx+=.8)box(.09,1.3,.09,xx,.65,z+hd+16,white);
}
