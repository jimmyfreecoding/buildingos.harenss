<template>
  <section class="ioc-panel overview-panel">
    <div class="panel-heading"><Icon name="building"/><h2>{{ title }}</h2><small>{{ eyebrow }}</small><button title="查看园区档案" aria-label="查看园区档案" @click="emit('detail','park')"><Icon name="chevron"/></button></div>
    <div class="panel-body">
      <div class="overview-top"><div class="area-metric"><span>总建筑面积 <small>m²</small></span><strong>{{ site.area.total }}<em>{{ site.area.suffix }}</em></strong><div class="metric-baseline"></div></div><div class="floor-metric"><div v-for="b in buildings" :key="b.id"><strong>{{ b.floors }}</strong><span>{{ b.label || b.id+'座' }} / 层</span></div></div></div>
      <div class="space-layout"><div class="space-column"><button v-for="item in spaceLeft" :key="item.label" :class="{ 'no-detail': !item.detail }" :disabled="!item.detail" @click="item.detail && emit('detail', item.detail)"><strong>{{ item.value }}</strong><span>{{ item.label }} <small>{{ item.unit }}</small></span></button></div><button class="space-orbit" @click="emit('detail','park')"><span></span><Icon name="layers"/><b>空间<br>信息</b></button><div class="space-column right"><button v-for="item in spaceRight" :key="item.label" :class="{ 'no-detail': !item.detail }" :disabled="!item.detail" @click="item.detail && emit('detail', item.detail)"><strong>{{ item.value }}</strong><span>{{ item.label }} <small>{{ item.unit }}</small></span></button></div></div>
      <div class="panel-foot"><span><i class="live-dot"></i> {{ kpi.status }}</span><b>{{ kpi.runningDays }}</b></div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import Icon from '../../widgets/Icon.vue';
import { useDataSlot } from '../../data/dataContext.js';
import { useIocContext } from '../../core/context.js';

defineProps({
  title: { type: String, default: '大楼简介' },
  eyebrow: { type: String, default: 'OVERVIEW' },
});
const emit = defineEmits(['detail']);

const { site } = useIocContext();
const buildings = computed(() => site.value.buildings);
const kpi = useDataSlot('kpi.overview', null, { status: '', runningDays: '', space: {} });
const space = computed(() => kpi.value.space || {});
// 十项空间统计，左右各五 —— 卡片中间那个圆形「空间信息」把它分成两列
const spaceCells = computed(() => {
  const s = space.value;
  const cell = (label, key, detail) => ({
    label,
    value: (s[key] && s[key].value) || '—',
    unit: (s[key] && s[key].unit) || '',
    detail,
  });
  return [
    cell('会议室', 'meetingRooms', 'rooms'),
    cell('公共区域', 'commonAreas', 'commonAreas'),
    cell('办公区域', 'officeAreas', 'officeAreas'),
    cell('办公室', 'offices', 'offices'),
    cell('厕所', 'toilets', 'toilets'),
    // 下面五类只有汇总数，没有清单，所以不做点击
    cell('停车位', 'parking', null),
    cell('商业配套', 'amenities', null),
    cell('充电桩', 'chargers', null),
    cell('客梯', 'passengerLifts', null),
    cell('货梯', 'goodsLifts', null),
  ];
});
const spaceLeft = computed(() => spaceCells.value.slice(0, 5));
const spaceRight = computed(() => spaceCells.value.slice(5));
</script>
