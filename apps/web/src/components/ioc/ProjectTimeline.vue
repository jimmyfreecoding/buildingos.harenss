<template>
  <div class="plan">
    <aside class="plan-side">
      <b class="plan-side-title"><Icon name="chart"/>{{ sideTitle }}</b>
      <div v-for="stat in stats" :key="stat.label" class="plan-stat">
        <div><strong>{{ stat.value }}</strong><em>{{ stat.unit }}</em></div>
        <span>{{ stat.label }}</span>
      </div>
      <div class="plan-legend">
        <b>工程分期</b>
        <div v-for="lane in lanes" :key="lane.name"><i :style="{ background: lane.color }"></i>{{ lane.name }}</div>
      </div>
    </aside>

    <section class="plan-main">
      <header class="plan-head">
        <b>{{ title }}</b>
        <span v-if="range"><i></i>{{ range }}</span>
      </header>

      <div class="plan-lanes">
        <div v-for="(lane, i) in lanes" :key="lane.name" class="plan-lane">
          <div class="plan-lane-head">
            <em :style="{ background: lane.color }">{{ String(i + 1).padStart(2, '0') }}</em>
            <div><b>{{ lane.name }}</b><small>{{ lane.range }}</small></div>
          </div>
          <div class="plan-track" :style="{ '--line': lane.color }">
            <i class="plan-line"></i>
            <div v-for="mark in lane.marks" :key="mark.label" class="plan-mark" :class="{ hot: mark.hot }" :style="{ '--line': lane.color }">
              <span>{{ mark.date }}</span>
              <b>{{ mark.label }}</b>
              <ul v-if="mark.items && mark.items.length" class="plan-mark-items">
                <li v-for="it in mark.items" :key="it">{{ it }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部月份轴也单独一张白底卡 -->
      <div class="plan-axiscard">
        <div class="plan-axis">
          <i v-for="tick in ticks" :key="tick.label" :style="{ left: tick.x + '%' }">
            <b>{{ tick.label }}</b><small v-if="tick.sub">{{ tick.sub }}</small>
          </i>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import Icon from '../../widgets/Icon.vue';

defineProps({
  title: { type: String, default: '' },
  sideTitle: { type: String, default: '总体工期概览' },
  range: { type: String, default: '' },
  stats: { type: Array, default: () => [] },
  lanes: { type: Array, default: () => [] },
  ticks: { type: Array, default: () => [] },
});
</script>