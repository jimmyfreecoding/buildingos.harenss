<template>
  <section class="ioc-panel warehouse-panel">
    <div class="panel-heading"><Icon :name="panel==='facts'?'building':'layers'"/><h2>{{ panel==='facts'?'仓库档案':'模型图层' }}</h2><small>{{ panel==='facts'?'BUILDING 6':'SCENE' }}</small></div>
    <div v-if="panel==='facts'" class="panel-body warehouse-body">
      <span class="warehouse-eyebrow">HOUSTON / TEXAS</span><h2 class="warehouse-title">一座仓库，<br>完整的空间视图。</h2>
      <div class="warehouse-area"><strong>314,589</strong><span>SF · CAD 标注建筑面积</span></div>
      <div class="warehouse-metrics"><div><b>728′</b><span>建筑长度</span></div><div><b>420′</b><span>建筑进深</span></div><div><b>185′</b><span>两侧货车场深</span></div><div><b>4</b><span>CAD 货架分区</span></div></div>
      <h3>场地规划 <small>依据 cad2.jpg</small></h3>
      <div class="warehouse-row"><span>货车泊位 · 图上侧 / 下侧</span><b>35 / 38</b></div>
      <div class="warehouse-row"><span>小车泊位 · 图左 / 右</span><b>96 / 149</b></div>
      <div class="warehouse-row"><span>远期小车泊位</span><b>151</b></div>
      <p class="warehouse-note">灰白预制板立面、转角玻璃入口、双侧月台，结合现场照片建模。车辆与货物用于空间展示。</p>
    </div>
    <div v-else class="panel-body warehouse-body">
      <span class="warehouse-eyebrow">EXPLORE THE WAREHOUSE</span><h2 class="warehouse-title">从园区，到货架。</h2>
      <p class="warehouse-note">顶部切换外观、去顶总览、货架及入库区。拖动旋转，滚轮缩放，右键平移。</p>
      <div class="warehouse-layers"><label v-for="item in layerItems" :key="item.id"><span><Icon :name="item.icon"/>{{ item.name }}</span><input type="checkbox" :checked="layers[item.id]" @change="setLayer(item.id,$event.target.checked)" :aria-label="item.name"/></label></div>
      <h3>仓储布局 <small>依据 cad.pdf</small></h3>
      <div class="warehouse-utility"><span><Icon name="energy"/><b>ELEC ROOM</b></span><button @click="scene?.focus('elec-interior')" aria-label="查看电气间内侧">内侧</button><button @click="scene?.focus('elec-exterior')" aria-label="查看电气间外侧">外侧</button></div>
      <button v-for="zone in zones" :key="zone.id" class="warehouse-zone" @click="scene?.focus(zone.id)"><span>{{ zone.id }}</span><div><b>{{ zone.name.split(' · ')[1] }}</b><small>定位至 {{ zone.id }} 区</small></div><Icon name="arrow"/></button>
      <p class="warehouse-note warehouse-assumption">建模说明：建筑高约 12.8 m、货架高约 8.4 m 为照片推定。分区和通道参考 CAD，货架单元与装载为简化表达；未接入实时运营数据。</p>
    </div>
  </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useIocContext } from '../../core/context.js';
import { ZONES } from '../../sites/houston/modelConfig.js';
defineProps({ panel: { type: String, default: 'facts' } });
const { scene } = useIocContext();
const zones = ZONES;
const layers = ref({ roof: true, structure: true, racks: true, cargo: true, vehicles: true });
const layerItems = [{id:'roof',name:'屋面与外墙',icon:'building'},{id:'structure',name:'钢柱与屋架',icon:'layers'},{id:'racks',name:'仓储货架',icon:'grid'},{id:'cargo',name:'托盘与货物',icon:'layers'},{id:'vehicles',name:'场地车辆',icon:'car'}];
let off;
watch(scene, host => { off?.(); if(host?.can('layer')) { layers.value=host.layer(); off=host.on('layers',v=>{layers.value=v;}); } }, {immediate:true});
function setLayer(id,value){scene.value?.layer(id,value);}
onBeforeUnmount(()=>off?.());
</script>
<style>
.warehouse-utility{display:flex;align-items:center;gap:7px;padding:9px 0;border-bottom:1px solid var(--ioc-card-line);font-size:11px}.warehouse-utility>span{display:flex;align-items:center;gap:6px;flex:1}.warehouse-utility svg{color:var(--ioc-accent);width:15px!important;height:15px!important}.ioc-shell .warehouse-utility button{padding:4px 8px;border-radius:4px;background:#f9731614;color:var(--ioc-accent)}
.warehouse-body{padding:24px!important}.warehouse-eyebrow{font-size:10px;letter-spacing:2px;color:var(--ioc-accent)}.warehouse-title{font-size:25px;line-height:1.45;font-weight:500;margin:12px 0 20px}.warehouse-area{border-bottom:1px solid var(--ioc-card-line);padding-bottom:24px}.warehouse-area strong{font-size:40px;font-weight:500;letter-spacing:-1px;display:block}.warehouse-area>span,.warehouse-metrics span{display:block;font-size:11px;color:var(--ioc-text-muted);margin-top:6px}.warehouse-metrics{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:24px 0}.warehouse-metrics b{font-size:24px;font-weight:500}.warehouse-body h3{font-size:13px;margin:20px 0 12px}.warehouse-body h3 small{font-size:10px;font-weight:400;color:var(--ioc-text-muted);margin-left:8px}.warehouse-row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--ioc-card-line);padding:13px 0;font-size:11px}.warehouse-row b{font-size:14px;font-weight:500;white-space:nowrap}.warehouse-note{font-size:11px;line-height:1.85;color:var(--ioc-text-dim);margin:18px 0 0}.warehouse-layers{margin:20px 0}.warehouse-layers label{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--ioc-card-line);font-size:12px;cursor:pointer}.warehouse-layers label span{display:flex;gap:10px;align-items:center}.warehouse-layers svg{width:16px;height:16px;color:var(--ioc-accent)}.warehouse-layers input{accent-color:#f97316;width:16px;height:16px}.warehouse-zone{display:flex;align-items:center;gap:12px;background:transparent;border:0;border-bottom:1px solid var(--ioc-card-line);width:100%;padding:12px 0;text-align:left;color:inherit;cursor:pointer}.warehouse-zone>span{background:#f9731612;color:var(--ioc-accent);width:30px;height:30px;display:grid;place-items:center;border-radius:7px}.warehouse-zone div{flex:1}.warehouse-zone b{font-size:12px;font-weight:500}.warehouse-zone small{display:block;font-size:10px;margin-top:4px;color:var(--ioc-text-muted)}.warehouse-zone svg{width:14px;height:14px}.warehouse-assumption{border-left:2px solid var(--ioc-accent);padding-left:12px}@media(max-height:850px){.warehouse-body{padding:16px!important}.warehouse-title{font-size:21px;margin:10px 0}.warehouse-metrics{gap:14px;padding:16px 0}.warehouse-layers label,.warehouse-zone{padding:8px 0}.warehouse-note{margin-top:12px}}
</style>
