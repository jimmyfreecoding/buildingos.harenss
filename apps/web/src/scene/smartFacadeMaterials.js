import * as THREE from 'three';

// A repeat spans one 5.4 m structural bay and the full three-storey elevation.
// These are layered visual cues from the photo, not a claim about the real interior.
export function createSmartFacadeMaterials(renderer) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, 0, 1024);
  base.addColorStop(0, '#14282d'); base.addColorStop(.3, '#243c40');
  base.addColorStop(.55, '#698185'); base.addColorStop(.82, '#334c50'); base.addColorStop(1, '#172d31');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 1024);
  // Recessed columns, ceiling members and slabs visible through tinted glazing.
  for (let floor = 0; floor < 3; floor++) {
    const y = floor * 341;
    ctx.fillStyle = 'rgba(10,23,27,.6)'; ctx.fillRect(0, y + 6, 512, 43);
    for (let x = -64; x < 576; x += 64) {
      ctx.strokeStyle = 'rgba(16,31,34,.65)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, y + 38); ctx.lineTo(x + 52, y + 105); ctx.lineTo(x + 52, y + 319); ctx.stroke();
      ctx.strokeStyle = 'rgba(166,189,187,.32)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 7, y + 40); ctx.lineTo(x + 59, y + 105); ctx.lineTo(x + 59, y + 319); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(157,173,170,.4)'; ctx.fillRect(0, y + 274, 512, 14);
    ctx.fillStyle = 'rgba(13,29,32,.75)'; ctx.fillRect(0, y + 291, 512, 11);
    ctx.strokeStyle = 'rgba(30,48,51,.6)'; ctx.lineWidth = 3;
    for (let x = 18; x < 512; x += 85) { ctx.strokeRect(x, y + 145, 48, 99); ctx.strokeRect(x + 7, y + 152, 34, 84); }
  }
  for (let col = 0; col < 4; col++) {
    const x = col * 128;
    ctx.fillStyle = col % 2 ? 'rgba(142,175,180,.09)' : 'rgba(8,32,38,.12)'; ctx.fillRect(x, 0, 128, 1024);
    ctx.fillStyle = 'rgba(7,23,29,.7)'; ctx.fillRect(x, 0, 5, 1024); ctx.fillRect(x + 120, 0, 4, 1024);
    ctx.fillStyle = 'rgba(176,205,205,.42)'; ctx.fillRect(x + 7, 0, 2, 1024); ctx.fillRect(x + 116, 0, 2, 1024);
    for (let y = 0; y < 1024; y += 170.5) {
      ctx.fillStyle = 'rgba(12,31,36,.55)'; ctx.fillRect(x, y, 128, 4);
      ctx.fillStyle = 'rgba(163,191,194,.36)'; ctx.fillRect(x, y + 5, 128, 2);
    }
  }
  const reflectionWash = ctx.createLinearGradient(0, 0, 512, 600);
  reflectionWash.addColorStop(0, 'rgba(192,222,233,.03)'); reflectionWash.addColorStop(.48, 'rgba(169,201,211,.18)'); reflectionWash.addColorStop(1, 'rgba(130,169,183,0)');
  ctx.fillStyle = reflectionWash; ctx.fillRect(0, 0, 512, 1024);
  const facadeTexture = new THREE.CanvasTexture(canvas);
  facadeTexture.encoding = THREE.sRGBEncoding; facadeTexture.wrapS = THREE.RepeatWrapping;
  facadeTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const faces = [];
  for (let side = 0; side < 6; side++) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#688bad'); sky.addColorStop(.5, '#b5cbd4'); sky.addColorStop(.63, '#829491'); sky.addColorStop(1, '#344941');
    g.fillStyle = sky; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 12; i++) {
      const x = (i * 83 + side * 39) % 256, y = 20 + (i * 37) % 105;
      const cloud = g.createRadialGradient(x, y, 2, x, y, 36);
      cloud.addColorStop(0, 'rgba(245,250,250,.4)'); cloud.addColorStop(1, 'rgba(245,250,250,0)');
      g.fillStyle = cloud; g.fillRect(0, 0, 256, 256);
    }
    faces.push(c);
  }
  const reflection = new THREE.CubeTexture(faces); reflection.encoding = THREE.sRGBEncoding; reflection.needsUpdate = true;
  const facadeGlass = new THREE.MeshStandardMaterial({
    color: 0xc5dbd9, map: facadeTexture, roughness: .28, metalness: .22,
    envMap: reflection, envMapIntensity: .32, emissive: 0x658277, emissiveMap: facadeTexture, emissiveIntensity: 0,
  });
  facadeGlass.color.convertSRGBToLinear();
  return { facadeGlass, facadeTexture, reflection };
}
