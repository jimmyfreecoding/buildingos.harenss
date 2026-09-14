<template>
  <section class="ioc-panel energy-panel">
    <div class="panel-heading"><Icon name="energy"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><button aria-label="能耗统计详情" @click="emit('detail','energy')"><Icon name="chevron"/></button></div>
    <div class="panel-body"><div class="energy-summary"><span><strong>{{ energy.total }}<em>{{ energy.decimal }}</em></strong> {{ energy.unit }}</span><span class="energy-saving">↘ {{ energy.saving }} <small>较昨日</small></span></div><Chart :series="series" :max="900" unit="kWh" label="今日逐时能耗" :ticks="['00','04','08','12','16','20','24']"/></div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';
import { useIocContext } from '../../core/context.js';

defineProps({
  title: { type: String, default: '今日能耗统计' },
  eyebrow: { type: String, default: 'ENERGY' },
});
const emit = defineEmits(['detail']);

const energy = useDataSlot('energy.today', null, { series: [] });
const { theme } = useIocContext();

const series = computed(() => {
  const charts = theme.value && theme.value.charts;
  const palette = charts && charts.overrideSeries && charts.palette ? charts.palette : [];
  const list = energy.value.series || [];
  if (!palette.length) return list;
  return list.map((item, index) => ({ ...item, color: palette[index % palette.length] }));
});
</script>
