<template>
  <section class="ioc-panel people-panel">
    <div class="panel-heading"><Icon name="users"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><button aria-label="人员统计详情" @click="emit('detail','people')"><Icon name="chevron"/></button></div>
    <div class="panel-body donut-layout"><div class="donut people-donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" class="ring-track"/><circle cx="60" cy="60" r="48" stroke="#ff947b" stroke-dasharray="224 302"/><circle cx="60" cy="60" r="48" stroke="#a8d6ff" stroke-dasharray="73 302" stroke-dashoffset="-228"/></svg><div><strong>{{ people.total }}</strong><span>在园总人数</span></div></div><div class="donut-legend"><div><i class="blue"></i><span>{{ people.groups[0].label }}</span><b>{{ people.groups[0].value }}</b><small>{{ people.groups[0].percent }}</small></div><div><i class="orange"></i><span>{{ people.groups[1].label }}</span><b>{{ people.groups[1].value }}</b><small>{{ people.groups[1].percent }}</small></div><div><i class="green"></i><span>{{ people.groups[2].label }}</span><b>{{ people.groups[2].value }}</b><small>{{ people.groups[2].percent }}</small></div><p><span class="live-dot"></span> 通行数据 · 演示</p></div></div>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';

defineProps({
  title: { type: String, default: '今日人员统计' },
  eyebrow: { type: String, default: 'PERSONNEL' },
});
const emit = defineEmits(['detail']);

// 三个圆弧长度是手调的几何，暂时留在模板里
const people = useDataSlot('people.today', null, { total: '', groups: [{}, {}, {}] });
</script>
