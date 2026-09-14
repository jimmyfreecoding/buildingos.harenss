<template>
  <svg class="ioc-chart" viewBox="0 0 310 150" preserveAspectRatio="none" role="img" :aria-label="label">
    <defs><linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" :stop-color="series[0].color" stop-opacity=".3"/><stop offset="100%" :stop-color="series[0].color" stop-opacity="0"/></linearGradient></defs>
    <text x="4" y="11" class="unit">{{ unit }}</text>
    <g v-for="i in 4" :key="i"><path :d="`M30 ${20+(i-1)*32} H303`" class="grid-line"/><text x="24" :y="23+(i-1)*32" text-anchor="end">{{ Math.round(max*(4-i)/3) }}</text></g>
    <path v-if="fill" :d="area(series[0].values)" :fill="`url(#${gradientId})`"/>
    <g v-for="s in series" :key="s.name"><path :d="line(s.values)" fill="none" :stroke="s.color" stroke-width="1.7"/><circle v-for="(v,i) in s.values" :key="i" :cx="x(i,s.values.length)" :cy="y(v)" r="2.3" :fill="s.color"/></g>
    <text v-for="(t,i) in ticks" :key="t" :x="30+i*273/(ticks.length-1)" y="138" text-anchor="middle">{{ t }}</text>
  </svg>
</template>
<script setup>
import { useId } from 'vue';
const props = defineProps({ series:Array, max:Number, unit:String, label:String, ticks:{ type:Array, default:()=>['00','04','08','12','16','20','24'] }, fill:{type:Boolean,default:true} });
const gradientId = `chart-${useId()}`;
const x=(i,len)=>30+i*273/(len-1); const y=v=>116-Math.min(v,props.max)/props.max*96;
const line=values=>values.map((v,i)=>`${i?'L':'M'}${x(i,values.length)},${y(v)}`).join(' ');
const area=values=>`${line(values)} L303,116 L30,116Z`;
</script>
<style scoped>.ioc-chart{width:100%;height:100%;overflow:visible}.ioc-chart text{fill:var(--ioc-chart-text,#a4bdd2);font-size:9px;font-family:Arial,sans-serif}.ioc-chart .unit{font-size:8px;fill:#7896ad}.grid-line{stroke:var(--ioc-chart-grid,#bed9ef);stroke-opacity:.14;stroke-dasharray:3 4;stroke-width:.6}</style>
