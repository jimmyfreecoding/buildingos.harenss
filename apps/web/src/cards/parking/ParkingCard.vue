<template>
  <section class="ioc-panel parking-panel">
    <div class="panel-heading"><Icon name="car"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><button aria-label="停车统计详情" @click="emit('detail','parking')"><Icon name="chevron"/></button></div>
    <div class="panel-body donut-layout"><div class="donut parking-donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" class="ring-track"/><circle cx="60" cy="60" r="48" stroke="#7ee7aa" stroke-dasharray="253 302"/><circle cx="60" cy="60" r="48" stroke="#fb9c7f" stroke-dasharray="42 302" stroke-dashoffset="-258"/></svg><div><strong>{{ parking.rate }}<em>%</em></strong><span>车位空闲率</span></div></div><div class="donut-legend"><p class="parking-total">已启用泊位 <b>{{ parking.enabled }}</b></p><div><i class="green"></i><span>空闲</span><b>{{ parking.free }}</b></div><div><i class="orange"></i><span>占用</span><b>{{ parking.used }}</b></div><p>预留 / 维护 <b>{{ parking.reserved }}</b></p></div></div>
  </section>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';

defineProps({
  title: { type: String, default: '今日车辆统计' },
  eyebrow: { type: String, default: 'PARKING' },
});
const emit = defineEmits(['detail']);

const parking = useDataSlot('parking.today', null, {});
</script>
