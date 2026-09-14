import { FT, HOUSTON } from './modelConfig.js';
const INCH = .0254;
export const ROUTER_SPEC = {
  width: 4.33 * INCH, depth: 4.33 * INCH, height: 6.08 * INCH,
  mountHeight: 30 * FT, floorY: 1.37,
  // 30 ft is interpreted as device centre above the finished warehouse floor.
  wallStandOff: .12,
};
// Trace ONLY the last annotated plan: shell x=85..566, red marks below.
// These are image-derived longitudinal positions, not surveyed coordinates.
export const NETWORK_GROUPS = [
  { id:'inbound', name:'入库墙', prefix:'IN', side:-1, color:'#ef8b39', pixels:[172,268,347,453] },
  { id:'outbound', name:'出库墙', prefix:'OUT', side:1, color:'#169dba', pixels:[174,260,374,437] },
];
export const ROUTERS = NETWORK_GROUPS.flatMap(group => group.pixels.map((pixel,index) => ({
  id:`${group.prefix}-${String(index+1).padStart(2,'0')}`,
  name:`${group.name} ${index+1}`, group:group.id, side:group.side, color:group.color,
  x:((pixel-85)/(566-85)-.5)*HOUSTON.width,
  y:ROUTER_SPEC.floorY+ROUTER_SPEC.mountHeight,
  z:group.side*(HOUSTON.depth/2-.16-ROUTER_SPEC.wallStandOff),
})));
// Group connectivity only: no unprovided master node, WAN or switch is asserted.
export const NETWORK_LINKS = NETWORK_GROUPS.flatMap(group => {
  const nodes=ROUTERS.filter(node=>node.group===group.id);
  return nodes.slice(1).map((node,index)=>({from:nodes[index].id,to:node.id,group:group.id}));
});
