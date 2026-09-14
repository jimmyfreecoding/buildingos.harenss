<template>
  <section class="ioc-panel traffic-panel">
    <div class="panel-heading"><Icon name="chart"/><h2>{{ heading }}</h2><small>{{ eyebrowText }}</small></div>
    <div class="panel-body"><div class="chart-legend"><span v-for="s in colored" :key="s.name"><i :style="{background:s.color}"></i>{{ s.name }}</span></div><Chart :series="colored" :max="chart.max" :unit="chart.unit" :label="chartLabel"/></div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';
import { useIocContext } from '../../core/context.js';

const props = defineProps({
  title: { type: String, default: '今日人流动态' },
  eyebrow: { type: String, default: 'TRAFFIC' },
  // 当前态势 id，由页面传进来
  viewId: { type: String, default: 'overview' },
});

// traffic.flow 这个槽按态势取，所以参数传函数，态势一变就重新取
const series = useDataSlot('traffic.flow', () => ({ view: props.viewId }), []);

// 态势文案（标题、图表范围、图注）现在写在园区文件的 views 里，不在数据槽里
const { spec, theme } = useIocContext();

// 主题可以声明「用自己的曲线配色」。默认那套没声明，所以数据里写什么色就是什么色。
const palette = computed(() => {
  const charts = theme.value && theme.value.charts;
  return charts && charts.overrideSeries && charts.palette ? charts.palette : [];
});
const colored = computed(() => {
  const list = series.value || [];
  if (!palette.value.length) return list;
  return list.map((item, index) => ({ ...item, color: palette.value[index % palette.value.length] }));
});
const currentView = computed(() => ((spec.value && spec.value.views) || []).find(v => v.id === props.viewId) || {});
const chartMeta = computed(() => currentView.value.chart || {});
const heading = computed(() => chartMeta.value.title || props.title);
const eyebrowText = computed(() => chartMeta.value.eyebrow || props.eyebrow);
const chart = computed(() => ({
  max: chartMeta.value.max === undefined ? 150 : chartMeta.value.max,
  unit: chartMeta.value.unit || '人次',
}));
const chartLabel = computed(() => chartMeta.value.label || chartMeta.value.title || '');
</script>
