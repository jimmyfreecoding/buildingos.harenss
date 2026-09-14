// Metres. Plan axes follow cad.pdf: 1..14 left to right, A..J top to bottom.
export const FT = 0.3048;
export const HOUSTON = {
  width: 728 * FT, depth: 420 * FT, court: 185 * FT,
  areaSF: 314589, areaM2: Math.round(314589 * FT * FT),
  height: 12.8, rackHeight: 8.4, // Photo estimates, not surveyed heights.
  parking: { west: 96, east: 149, future: 151, upperTrailers: 35, lowerTrailers: 38 },
};
export const BUILDINGS = [{ id: '6', name: 'Building 6 · 休斯敦仓库', label: 'BUILDING 6', x: 0, z: 0,
  w: HOUSTON.width, d: HOUSTON.depth, h: HOUSTON.height, floors: 1,
  area: HOUSTON.areaM2.toLocaleString('en-US'), people: '—', equipment: '—' }];
// Service core immediately left of axis 8 at wall A; footprint traced from CAD.
// Heights/equipment shapes are schematic; the CAD does not supply elevations.
export const SERVICE_CORE = {
  x0: .3, x1: 8.5, partitionX: 4.4, wallZ: -HOUSTON.depth / 2,
  insideDepth: 7.5, outsideDepth: 7.4, height: 3.8, floorY: 1.4,
};
// Bounds traced from the rack plan, normalized against the 728 × 420 ft shell.
export const ZONES = [
  { id: 'A', name: 'A 区 · 高位备货', x0: -109, x1: -66, z0: -44, z1: 45, rows: 10, levels: 5 },
  { id: 'B', name: 'B 区 · 高位拣货', x0: -64, x1: -26, z0: -44, z1: 45, rows: 9, levels: 5 },
  { id: 'C', name: 'C 区 · 商品存储', x0: -20, x1: 54, z0: -44, z1: -12, rows: 27, levels: 5 },
  { id: 'D', name: 'D 区 · VNA 货架', x0: 60, x1: 102, z0: -44, z1: 45, rows: 12, levels: 6 },
];
export const MODES = [
  { id: 'overview', name: '园区外观', icon: 'building', title: 'Building 6 · 园区全景' },
  { id: 'interior', name: '去顶总览', icon: 'layers', title: '仓内布局 · A / B / C / D 分区' },
  { id: 'racks', name: '货架近景', icon: 'grid', title: '高位货架 · 绿柱橙梁与托盘货物' },
  { id: 'receiving', name: '入库区', icon: 'car', title: '入库月台 · 暂存与仓内钢结构' },
];
